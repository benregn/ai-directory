"""Filesystem snapshot cache: raw HTML bodies plus fetch metadata.

Layout mirrors the URL path under the cache root, so snapshots stay
human-browsable:

    <root>/html/githits.com/software-factories/aeon/index.html
    <root>/html/githits.com/software-factories/aeon/meta.json

The cache is the single source of truth for parsing: the parse pass never
touches the network, and the fetch pass skips URLs that already have a
successful snapshot unless told to refresh.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from .fetcher import FetchResult

BODY_NAME = "index.html"
META_NAME = "meta.json"


def normalize_url(url: str) -> str:
    """Normalization used for dedup keys: lowercase scheme/host, drop fragment
    and default ports, keep path and query byte-for-byte."""
    parts = urlsplit(url.strip())
    scheme = (parts.scheme or "https").lower()
    host = parts.netloc.lower()
    if host.endswith(":443") and scheme == "https":
        host = host[:-4]
    if host.endswith(":80") and scheme == "http":
        host = host[:-3]
    return parts._replace(scheme=scheme, netloc=host, fragment="").geturl()


def url_to_relpath(url: str) -> Path:
    """Map a URL to a cache-relative directory path. Trailing slashes are
    insignificant for this site; a query string, if any, is folded into a
    short hash suffix on the last segment."""
    parts = urlsplit(normalize_url(url))
    segments = [s for s in parts.path.split("/") if s]
    if parts.query:
        digest = hashlib.sha256(parts.query.encode()).hexdigest()[:10]
        if segments:
            segments[-1] = f"{segments[-1]}_q{digest}"
        else:
            segments = [f"_root_q{digest}"]
    safe = []
    for seg in [parts.netloc] + segments:
        seg = re.sub(r"[^A-Za-z0-9._-]", "_", seg)
        safe.append(seg or "_")
    return Path(*safe)


@dataclass
class Snapshot:
    url: str
    dir: Path
    body: bytes | None
    meta: dict

    @property
    def ok(self) -> bool:
        return (
            self.body is not None
            and self.meta.get("status") == 200
            and not self.meta.get("error")
        )


class SnapshotStore:
    def __init__(self, root: Path):
        self.root = Path(root)

    def dir_for(self, url: str) -> Path:
        return self.root / "html" / url_to_relpath(url)

    def body_path(self, url: str) -> Path:
        return self.dir_for(url) / BODY_NAME

    def meta_path(self, url: str) -> Path:
        return self.dir_for(url) / META_NAME

    def save(self, result: FetchResult) -> Path:
        d = self.dir_for(result.requested_url)
        d.mkdir(parents=True, exist_ok=True)
        meta = {
            "requested_url": result.requested_url,
            "final_url": result.final_url,
            "fetched_at": result.fetched_at,
            "status": result.status,
            "headers": result.headers,
            "elapsed_ms": result.elapsed_ms,
            "attempts": result.attempts,
            "error": result.error,
            "retry_events": result.retry_events,
        }
        if result.body is not None:
            body = result.body
            (d / BODY_NAME).write_bytes(body)
            meta["body_sha256"] = hashlib.sha256(body).hexdigest()
            meta["body_bytes"] = len(body)
        else:
            meta["body_sha256"] = None
            meta["body_bytes"] = None
        (d / META_NAME).write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n")
        return d

    def load(self, url: str) -> Snapshot | None:
        d = self.dir_for(url)
        meta_path = d / META_NAME
        if not meta_path.exists():
            return None
        meta = json.loads(meta_path.read_text())
        body_path = d / BODY_NAME
        body = body_path.read_bytes() if body_path.exists() else None
        return Snapshot(url=url, dir=d, body=body, meta=meta)

    def has_success(self, url: str) -> bool:
        snap = self.load(url)
        return bool(snap and snap.ok)

    def source_ref(self, url: str) -> dict:
        """Provenance reference embedded into output records."""
        snap = self.load(url)
        if snap is None:
            return {"requested_url": url, "snapshot": None}
        meta = snap.meta
        return {
            "requested_url": meta.get("requested_url"),
            "final_url": meta.get("final_url"),
            "fetched_at": meta.get("fetched_at"),
            "status": meta.get("status"),
            "body_sha256": meta.get("body_sha256"),
            "snapshot_path": str(self.dir_for(url).relative_to(self.root)),
        }
