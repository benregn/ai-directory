"""Retry, backoff, Retry-After and polite-delay tests with a stub transport.

No network is involved: the transport is a scripted fake, and the clock/sleep
are simulated so the timing contract can be asserted exactly.
"""

from githits_directory.fetcher import Fetcher, TransportResponse


class Sim:
    """Simulated clock: sleep() advances time, so polite waits and backoffs
    interplay exactly as they would live."""

    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


def make_transport(script, log):
    """script: list of either TransportResponse or Exception instances.
    Each call pops the next entry; exceptions are raised."""

    def transport(url, headers, timeout):
        log.append({"url": url, "timeout": timeout, "at": None})  # 'at' filled by harness below
        item = script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    return transport


def response(status, body=b"<html></html>", headers=None):
    return TransportResponse(
        status=status,
        headers=headers or {},
        body=body,
        final_url="https://githits.com/software-factories/x/",
    )


def build(script, delay=0.5, backoff_base=1.0, max_retries=3):
    sim = Sim()
    calls = []

    def transport(url, headers, timeout):
        calls.append({"at": sim.clock(), "timeout": timeout, "ua": headers.get("User-Agent")})
        item = script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    fetcher = Fetcher(
        delay=delay,
        backoff_base=backoff_base,
        max_retries=max_retries,
        transport=transport,
        sleep=sim.sleep,
        clock=sim.clock,
    )
    return fetcher, sim, calls


def gaps_between_attempts(calls):
    return [b["at"] - a["at"] for a, b in zip(calls, calls[1:])]


def test_retry_after_is_honored():
    fetcher, sim, calls = build([
        response(429, headers={"Retry-After": "2"}),
        response(200),
    ])
    result = fetcher.fetch("https://githits.com/software-factories/x/")
    assert result.ok
    assert result.attempts == 2
    # a wait of at least the Retry-After seconds happened after the 429
    assert any(s >= 2.0 for s in sim.sleeps)


def test_backoff_escalates_on_server_errors():
    fetcher, sim, calls = build([
        response(500),
        response(502),
        response(200),
    ])
    result = fetcher.fetch("https://githits.com/software-factories/x/")
    assert result.ok
    assert result.attempts == 3
    backoff_sleeps = [s for s in sim.sleeps if s >= 1.0]
    assert backoff_sleeps[:2] == [1.0, 2.0]  # base * 2^(n-1)


def test_every_attempt_start_respects_min_delay():
    fetcher, sim, calls = build([
        response(500),
        response(500),
        response(200),
    ], delay=0.5)
    fetcher.fetch("https://githits.com/software-factories/x/")
    assert len(calls) == 3
    for gap in gaps_between_attempts(calls):
        assert gap >= 0.5, f"attempt started {gap}s after the previous one (< delay)"


def test_polite_delay_applies_between_independent_fetches():
    fetcher, sim, calls = build([response(200), response(200)], delay=0.5)
    fetcher.fetch("https://githits.com/software-factories/a/")
    fetcher.fetch("https://githits.com/software-factories/b/")
    assert len(calls) == 2
    assert calls[1]["at"] - calls[0]["at"] >= 0.5


def test_client_error_is_not_retried():
    fetcher, sim, calls = build([response(404)])
    result = fetcher.fetch("https://githits.com/software-factories/x/")
    assert not result.ok
    assert result.attempts == 1
    assert result.error == "HTTP 404"


def test_transport_errors_are_retried_then_succeed():
    fetcher, sim, calls = build([
        ConnectionError("connection reset"),
        TimeoutError("read timed out"),
        response(200),
    ])
    result = fetcher.fetch("https://githits.com/software-factories/x/")
    assert result.ok
    assert result.attempts == 3


def test_exhaustion_reports_failure():
    always503 = [response(503) for _ in range(10)]
    fetcher, sim, calls = build(always503, max_retries=2)
    result = fetcher.fetch("https://githits.com/software-factories/x/")
    assert not result.ok
    assert result.attempts == 3  # 1 initial + 2 retries
    assert "exhausted" in result.error
    assert len(calls) == 3  # transport was not hammered beyond the bound


def test_timeout_is_bounded_and_user_agent_sent():
    fetcher, sim, calls = build([response(200)])
    assert fetcher.timeout == 20.0
    fetcher.fetch("https://githits.com/software-factories/x/")
    assert calls[0]["timeout"] == 20.0
    assert "githits-directory-scraper" in calls[0]["ua"]


def test_http_date_retry_after():
    from githits_directory.fetcher import parse_retry_after

    assert parse_retry_after("3") == 3.0
    assert parse_retry_after("garbage") is None
