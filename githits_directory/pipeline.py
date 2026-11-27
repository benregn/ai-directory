"""Pipeline stages: discover, fetch, parse, verify.

Fetching and parsing are strictly separate: discover/fetch move bytes into the
snapshot cache; parse reads only the cache and never touches the network.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .cache import SnapshotStore, normalize_url
from .fetcher import Fetcher
from .parse import (
    INDEX_URL,
    ListingParseError,
    parse_cards,
    parse_listing,
    parse_results_grid,
    parse_topic_chips,
    soup,
)

PARSER_VERSION = "0.1.0"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class FetchFailed(Exception):
    def __init__(self, url: str, error: str):
        super().__init__(f"{url}: {error}")
        self.url = url
        self.error = error


def get_page(
    url: str,
    store: SnapshotStore,
    fetcher: Fetcher,
    refresh: bool = False,
    log_events: list | None = None,
) -> bytes:
    """Cache-aware page retrieval shared by every online stage.

    Returns the body bytes of a successful snapshot. Raises FetchFailed when
    the page is neither cached nor fetchable. Never re-downloads a URL that
    already has a successful snapshot unless refresh=True."""
    url = normalize_url(url)
    if not refresh and store.has_success(url):
        snap = store.load(url)
        return snap.body
    result = fetcher.fetch(url)
    store.save(result)
    if log_events is not None:
        log_events.append(
            {
                "at": result.fetched_at,
                "url": url,
                "status": result.status,
                "final_url": result.final_url,
                "attempts": result.attempts,
                "error": result.error,
                "elapsed_ms": result.elapsed_ms,
            }
        )
    if not result.ok:
        raise FetchFailed(url, result.error or "unknown fetch failure")
    return result.body


# ---------------------------------------------------------------------------
# pass 1: discovery
# ---------------------------------------------------------------------------

def run_discovery(
    store: SnapshotStore,
    fetcher: Fetcher,
    refresh: bool = False,
    log_events: list | None = None,
) -> dict:
    """Fetch the index and every category page; build the categories.json
    document with per-category item URLs and directory-wide inventory."""
    errors = []

    index_html = get_page(INDEX_URL, store, fetcher, refresh=refresh, log_events=log_events)
    page = soup(index_html)
    chips = parse_topic_chips(page)
    inventory_cards = parse_results_grid(page)

    inventory_urls = []
    inventory_items = {}
    for card in inventory_cards:
        u = normalize_url(card["url"])
        if u not in inventory_items:
            inventory_urls.append(u)
            inventory_items[u] = card

    categories = []
    membership: dict[str, list[str]] = {}
    for cat in chips["categories"]:
        cat_url = normalize_url(cat["url"])
        try:
            cat_html = get_page(cat_url, store, fetcher, refresh=refresh, log_events=log_events)
        except FetchFailed as exc:
            errors.append({"stage": "discover", "url": cat_url, "error": exc.error})
            categories.append(
                {
                    **cat,
                    "url": cat_url,
                    "item_urls": [],
                    "collected_count": 0,
                    "fetch_error": exc.error,
                }
            )
            continue
        cards = parse_cards(soup(cat_html))
        seen: dict[str, None] = {}
        for card in cards:
            item_url = normalize_url(card["url"])
            seen.setdefault(item_url)
            membership.setdefault(item_url, [])
            if cat["slug"] not in membership[item_url]:
                membership[item_url].append(cat["slug"])
        item_urls = list(seen.keys())
        categories.append(
            {
                **cat,
                "url": cat_url,
                "item_urls": item_urls,
                "collected_count": len(item_urls),
            }
        )

    union_urls = []
    for cat in categories:
        for u in cat["item_urls"]:
            if u not in union_urls:
                union_urls.append(u)

    union_set = set(union_urls)
    inventory_set = set(inventory_urls)
    doc = {
        "source": INDEX_URL,
        "discovered_at": utcnow(),
        "categories": categories,
        "topics": chips["topics"],
        "directory_inventory": {
            "url_count": len(inventory_urls),
            "item_urls": inventory_urls,
            # machine-readable data attributes carried by the homepage's
            # results grid (data-added is a unix-ms timestamp)
            "cards": {
                u: inventory_items[u].get("data", {})
                for u in inventory_urls
            },
        },
        "unique_item_count": len(union_urls),
        "unique_item_urls": union_urls,
        "items": {
            u: {
                "categories": membership.get(u, []),
                "in_directory_inventory": u in inventory_set,
            }
            for u in union_urls
        },
        "observations": {
            "advertised_total": sum(c["advertised_count"] or 0 for c in categories),
            "collected_total_with_duplicates": sum(len(c["item_urls"]) for c in categories),
            "in_inventory_not_in_categories": sorted(inventory_set - union_set),
            "in_categories_not_in_inventory": sorted(union_set - inventory_set),
        },
        "errors": errors,
    }
    return doc


# ---------------------------------------------------------------------------
# pass 2a: fetch detail pages
# ---------------------------------------------------------------------------

def run_fetch(
    store: SnapshotStore,
    fetcher: Fetcher,
    item_urls: list[str],
    refresh: bool = False,
    log_events: list | None = None,
    progress=None,
) -> dict:
    """Fetch every unique detail URL once. Resumable: URLs with a successful
    snapshot are skipped. Failures are logged and reported, never hidden."""
    fetched, skipped, failed = 0, 0, []
    for i, url in enumerate(item_urls, 1):
        url = normalize_url(url)
        if not refresh and store.has_success(url):
            skipped += 1
            if progress:
                progress(f"[{i}/{len(item_urls)}] cached {url}")
            continue
        try:
            get_page(url, store, fetcher, refresh=True, log_events=log_events)
        except FetchFailed as exc:
            failed.append({"url": url, "error": exc.error})
            if progress:
                progress(f"[{i}/{len(item_urls)}] FAILED {url}: {exc.error}")
            continue
        fetched += 1
        if progress:
            progress(f"[{i}/{len(item_urls)}] fetched {url}")
    return {
        "total": len(item_urls),
        "fetched": fetched,
        "skipped_cached": skipped,
        "failed": failed,
        "complete": not failed,
    }


# ---------------------------------------------------------------------------
# pass 2b: parse detail pages from cache only
# ---------------------------------------------------------------------------

def slug_from_url(url: str) -> str:
    path = url.rstrip("/")
    return path.rsplit("/", 1)[-1]


def parse_one(store: SnapshotStore, url: str) -> dict:
    snap = store.load(url)
    if snap is None or not snap.ok:
        raise ListingParseError(f"no successful snapshot for {url}")
    record = parse_listing(snap.body, url)
    record["id"] = slug_from_url(url)
    record["url"] = url
    return record


def run_parse(store: SnapshotStore, categories_doc: dict) -> tuple[list[dict], list[dict]]:
    """Parse every unique item from its cached snapshot. Purely offline.
    Returns (records, failures)."""
    records, failures = [], []
    items = categories_doc.get("items", {})
    for url in categories_doc.get("unique_item_urls", []):
        url = normalize_url(url)
        try:
            record = parse_one(store, url)
        except ListingParseError as exc:
            failures.append({"url": url, "error": str(exc)})
            continue
        record["categories"] = items.get(url, {}).get("categories", [])
        record["source_snapshot"] = store.source_ref(url)
        record["parser_version"] = PARSER_VERSION
        record["parsed_at"] = utcnow()
        records.append(record)
    return records, failures


def write_jsonl(records: list[dict], path: Path) -> None:
    with open(path, "w") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")


# ---------------------------------------------------------------------------
# verification
# ---------------------------------------------------------------------------

def run_verify(store: SnapshotStore, data_dir: Path) -> dict:
    """Completeness and consistency checks. Observations are reported, never
    hidden; nothing here is a hard-coded expectation."""
    data_dir = Path(data_dir)
    report = {"checked_at": utcnow(), "checks": [], "ok": True}

    def check(name: str, ok: bool, detail):
        report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
        if not ok:
            report["ok"] = False

    cat_path = data_dir / "categories.json"
    if not cat_path.exists():
        check("categories.json exists", False, str(cat_path))
        return report
    doc = json.loads(cat_path.read_text())
    check("categories.json exists", True, str(cat_path))

    # per-category advertised vs collected
    per_cat = []
    cats_ok = True
    for cat in doc.get("categories", []):
        advertised = cat.get("advertised_count")
        collected = cat.get("collected_count")
        unique_collected = len(set(cat.get("item_urls", [])))
        row = {
            "slug": cat.get("slug"),
            "advertised": advertised,
            "collected_unique": unique_collected,
            "fetch_error": cat.get("fetch_error"),
        }
        match = advertised == unique_collected and not cat.get("fetch_error")
        row["match"] = match
        cats_ok = cats_ok and match
        per_cat.append(row)
    check("per-category advertised counts match collected unique URLs", cats_ok, per_cat)

    # union vs directory-wide inventory
    inv = set(doc.get("directory_inventory", {}).get("item_urls", []))
    union = set(doc.get("unique_item_urls", []))
    check(
        "category union equals directory-wide inventory",
        inv == union,
        {
            "inventory_count": len(inv),
            "union_count": len(union),
            "only_in_inventory": sorted(inv - union),
            "only_in_categories": sorted(union - inv),
        },
    )

    # advertised total vs union: any difference must be explained by items
    # belonging to multiple categories (each extra membership is one extra
    # advertised reference)
    advertised_total = sum(c.get("advertised_count") or 0 for c in doc.get("categories", []))
    multi = {
        u: cats
        for u, cats in ((u, v.get("categories", [])) for u, v in doc.get("items", {}).items())
        if len(cats) > 1
    }
    duplicates = sum(len(cats) - 1 for cats in multi.values())
    check(
        "advertised total explained by category membership",
        advertised_total - duplicates == len(union),
        {
            "advertised_total": advertised_total,
            "union_count": len(union),
            "multi_category_items": len(multi),
            "extra_references": duplicates,
        },
    )

    # inventory card metadata agrees with category-page membership
    cards = doc.get("directory_inventory", {}).get("cards", {})
    mismatches = []
    for u, data in cards.items():
        inv_cat = data.get("category")
        page_cats = doc.get("items", {}).get(u, {}).get("categories", [])
        if inv_cat and page_cats and page_cats != [inv_cat]:
            mismatches.append({"url": u, "inventory": inv_cat, "categories": page_cats})
    check(
        "inventory card categories agree with category-page membership",
        not mismatches,
        {"mismatches": mismatches[:10], "checked": len(cards)},
    )

    # listings.jsonl: exactly one successful detail record per unique item
    jsonl_path = data_dir / "listings.jsonl"
    if not jsonl_path.exists():
        check("listings.jsonl exists", False, str(jsonl_path))
        return report
    records = []
    bad_lines = []
    with open(jsonl_path) as fh:
        for n, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                bad_lines.append({"line": n, "error": str(exc)})
    check("listings.jsonl is valid JSONL", not bad_lines, bad_lines[:5])

    ids = [r.get("id") for r in records]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    check("record ids are unique", not dupes, {"duplicates": dupes})

    expected = set(doc.get("unique_item_urls", []))
    got = set(r.get("url") for r in records)
    check(
        "exactly one detail record per discovered unique item",
        expected == got and len(records) == len(expected),
        {
            "expected": len(expected),
            "records": len(records),
            "missing_records": sorted(expected - got),
            "unexpected_records": sorted(got - expected),
        },
    )

    # every record ties back to a successful snapshot on disk
    missing_snap = []
    for url in sorted(expected):
        if not store.has_success(url):
            missing_snap.append(url)
    check(
        "successful snapshot exists for every unique item",
        not missing_snap,
        {"missing": missing_snap},
    )

    # parse-failure fallback usage across the dataset (informational)
    fallback_kinds = {}
    for r in records:
        for fb in r.get("fallback", []):
            key = fb.get("type")
            fallback_kinds[key] = fallback_kinds.get(key, 0) + 1
    report["fallback_usage"] = fallback_kinds
    report["record_count"] = len(records)
    return report
