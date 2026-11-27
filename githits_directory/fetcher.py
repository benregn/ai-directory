"""Polite, serial HTTP fetching with bounded timeouts and retries.

The transport is injectable so tests can exercise retry/delay logic without
network access. Fetching never depends on parsing and never makes extraction
decisions; it only moves bytes.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Callable, Optional

DEFAULT_USER_AGENT = (
    "githits-directory-scraper/0.1 "
    "(+https://github.com/local/ai-directory; respectful personal archive, "
    "serial requests with delay)"
)

# statuses that justify another attempt
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
# never wait longer than this for a single backoff/Retry-After, seconds
MAX_RETRY_WAIT = 120.0


@dataclass
class TransportResponse:
    status: int
    headers: dict
    body: bytes
    final_url: str


# transport signature: (url, headers, timeout) -> TransportResponse
Transport = Callable[[str, dict, float], TransportResponse]


def requests_transport(url: str, headers: dict, timeout: float) -> TransportResponse:
    """Default transport backed by requests. Raises on connection errors/timeouts."""
    import requests

    resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
    return TransportResponse(
        status=resp.status_code,
        headers=dict(resp.headers),
        body=resp.content,
        final_url=resp.url,
    )


@dataclass
class FetchResult:
    requested_url: str
    final_url: Optional[str]
    fetched_at: str
    status: Optional[int]
    headers: dict
    body: Optional[bytes]
    elapsed_ms: float
    attempts: int
    error: Optional[str] = None
    retry_events: list = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.error is None and self.status == 200 and self.body is not None


def parse_retry_after(value: str) -> Optional[float]:
    """Retry-After may be seconds or an HTTP-date. Returns seconds from now, or None."""
    value = value.strip()
    if value.isdigit():
        return float(value)
    try:
        dt = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0.0, (dt - datetime.now(timezone.utc)).total_seconds())


class Fetcher:
    """Serial fetcher. Enforces `delay` seconds between the start of any two
    requests, including retries. Retries use exponential backoff and honor
    Retry-After. Everything is injectable for tests."""

    def __init__(
        self,
        user_agent: str = DEFAULT_USER_AGENT,
        delay: float = 0.5,
        timeout: float = 20.0,
        max_retries: int = 3,
        backoff_base: float = 1.0,
        transport: Optional[Transport] = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ):
        if delay < 0:
            raise ValueError("delay must be >= 0")
        self.user_agent = user_agent
        self.delay = delay
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.transport = transport or requests_transport
        self.sleep = sleep
        self.clock = clock
        self._last_attempt_start: Optional[float] = None

    def _polite_wait(self) -> float:
        """Wait so attempts start at least `delay` apart. Returns waited seconds."""
        if self._last_attempt_start is None:
            return 0.0
        elapsed = self.clock() - self._last_attempt_start
        wait = self.delay - elapsed
        if wait > 0:
            self.sleep(wait)
            return wait
        return 0.0

    def fetch(self, url: str) -> FetchResult:
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml",
        }
        events = []
        started = self.clock()
        fetched_at = datetime.now(timezone.utc).isoformat()
        attempts = 0
        last_error = None
        last_resp: Optional[TransportResponse] = None

        for attempt in range(1, self.max_retries + 2):  # 1 initial + max_retries
            waited = self._polite_wait()
            if waited:
                events.append({"event": "polite_delay", "seconds": round(waited, 3)})
            attempts = attempt
            attempt_started = self.clock()
            self._last_attempt_start = attempt_started
            try:
                resp = self.transport(url, dict(headers), self.timeout)
            except Exception as exc:  # connection error, timeout, ...
                last_error = f"{type(exc).__name__}: {exc}"
                events.append({"event": "transport_error", "attempt": attempt, "error": last_error})
                retryable = True
                status = None
                retry_after = None
            else:
                last_resp = resp
                status = resp.status
                retryable = status in RETRYABLE_STATUS
                retry_after = parse_retry_after(resp.headers.get("Retry-After", "")) if retryable else None
                if not retryable:
                    elapsed = (self.clock() - started) * 1000
                    return FetchResult(
                        requested_url=url,
                        final_url=resp.final_url,
                        fetched_at=fetched_at,
                        status=status,
                        headers=resp.headers,
                        body=resp.body,
                        elapsed_ms=round(elapsed, 1),
                        attempts=attempts,
                        error=None if status == 200 else f"HTTP {status}",
                        retry_events=events,
                    )
                events.append({"event": "retryable_status", "attempt": attempt, "status": status})
                last_error = f"HTTP {status}"

            if attempt > self.max_retries:
                break

            backoff = self.backoff_base * (2 ** (attempt - 1))
            wait = max(backoff, retry_after or 0.0)
            wait = min(wait, MAX_RETRY_WAIT)
            events.append({"event": "backoff", "seconds": round(wait, 3), "attempt": attempt})
            self.sleep(wait)
            # note: the polite delay before the next attempt still applies on top

        elapsed = (self.clock() - started) * 1000
        return FetchResult(
            requested_url=url,
            final_url=last_resp.final_url if last_resp else None,
            fetched_at=fetched_at,
            status=status,
            headers=last_resp.headers if last_resp else {},
            body=last_resp.body if last_resp else None,
            elapsed_ms=round(elapsed, 1),
            attempts=attempts,
            error=f"exhausted {attempts} attempt(s): {last_error}",
            retry_events=events,
        )
