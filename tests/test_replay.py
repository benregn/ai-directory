"""Cached-replay tests: once a page is cached, re-running a stage must make
zero network requests and reproduce the same output.

The 'online' passes run against a stub transport serving the saved real HTML
from tests/fixtures; the replay passes run against a transport that raises if
it is ever called.
"""

import json
from pathlib import Path

import pytest

from githits_directory.cache import SnapshotStore
from githits_directory.fetcher import Fetcher, TransportResponse
from githits_directory.parse import INDEX_URL
from githits_directory.pipeline import run_discovery, run_fetch, run_parse, run_verify, write_jsonl

FIXTURES = Path(__file__).parent / "fixtures"

CATEGORY_SLUGS = [
    "agent-orchestration",
    "engineering-factories",
    "app-builders",
    "agent-workspaces",
    "code-review",
    "agent-infrastructure",
    "development-platforms",
    "ai-labs",
]

# hand-checked against the fixture HTML, not parser output
EXPECTED_CATEGORY_COUNTS = {
    "agent-orchestration": 74,
    "engineering-factories": 56,
    "app-builders": 65,
    "agent-workspaces": 9,
    "code-review": 10,
    "agent-infrastructure": 19,
    "development-platforms": 2,
    "ai-labs": 4,
}


def fixture_transport(calls: list):
    def transport(url, headers, timeout):
        calls.append(url)
        if url == INDEX_URL:
            body = (FIXTURES / "index.html").read_bytes()
        elif "/category/" in url:
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            body = (FIXTURES / "category" / f"{slug}.html").read_bytes()
        else:
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            body = (FIXTURES / "detail" / f"{slug}.html").read_bytes()
        return TransportResponse(status=200, headers={"Content-Type": "text/html"}, body=body, final_url=url)

    return transport


def exploding_transport(url, headers, timeout):
    raise AssertionError(f"network request during offline replay: {url}")


def strip_timestamps(doc):
    doc = json.loads(json.dumps(doc))
    doc.pop("discovered_at", None)
    return doc


def test_discover_replay_makes_no_network_and_reproduces_content(tmp_path):
    store = SnapshotStore(tmp_path / "cache")
    calls: list = []
    fetcher = Fetcher(transport=fixture_transport(calls), delay=0)

    doc_first = run_discovery(store, fetcher)
    # one request for the index plus one per discovered category — no more
    assert len(calls) == 1 + len(EXPECTED_CATEGORY_COUNTS)

    # hand-checked expectations against the real saved HTML
    assert len(doc_first["categories"]) == 8
    assert len(doc_first["topics"]) == 25
    for cat in doc_first["categories"]:
        assert cat["advertised_count"] == EXPECTED_CATEGORY_COUNTS[cat["slug"]]
        assert cat["collected_count"] == EXPECTED_CATEGORY_COUNTS[cat["slug"]]
    assert doc_first["unique_item_count"] == 239
    assert doc_first["directory_inventory"]["url_count"] == 239
    assert doc_first["observations"]["advertised_total"] == 239
    assert doc_first["observations"]["in_inventory_not_in_categories"] == []
    assert doc_first["observations"]["in_categories_not_in_inventory"] == []

    # replay: same store, network disabled
    offline = Fetcher(transport=exploding_transport, delay=0)
    doc_replayed = run_discovery(store, offline)
    assert strip_timestamps(doc_replayed) == strip_timestamps(doc_first)


def mini_doc() -> dict:
    return json.loads((FIXTURES / "categories-mini.json").read_text())


def strip_parse_timestamps(records):
    out = []
    for rec in records:
        rec = json.loads(json.dumps(rec))
        rec.pop("parsed_at", None)
        out.append(rec)
    return out


def test_detail_fetch_parse_replay(tmp_path):
    store = SnapshotStore(tmp_path / "cache")
    doc = mini_doc()
    urls = doc["unique_item_urls"]

    # pass 1: 'online' against fixtures — exactly one request per unique item
    calls: list = []
    fetcher = Fetcher(transport=fixture_transport(calls), delay=0)
    summary = run_fetch(store, fetcher, urls)
    assert summary["fetched"] == 2
    assert summary["failed"] == []
    assert len(calls) == 2

    # pass 2: replay — nothing re-downloaded, network never touched
    offline = Fetcher(transport=exploding_transport, delay=0)
    summary2 = run_fetch(store, offline, urls)
    assert summary2["fetched"] == 0
    assert summary2["skipped_cached"] == 2

    # parse is offline by construction and deterministic modulo timestamps
    records_first, failures_first = run_parse(store, doc)
    assert failures_first == []
    assert len(records_first) == 2
    records_second, failures_second = run_parse(store, doc)
    assert strip_parse_timestamps(records_first) == strip_parse_timestamps(records_second)

    # records identify their source snapshot
    for rec in records_first:
        snap = rec["source_snapshot"]
        assert snap["status"] == 200
        assert snap["body_sha256"]
        assert snap["snapshot_path"]
        assert snap["requested_url"] == rec["url"]

    # verify passes end-to-end on this dataset
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "categories.json").write_text(json.dumps(doc))
    write_jsonl(records_first, data_dir / "listings.jsonl")
    store_in_data = SnapshotStore(tmp_path / "cache")  # same cache layout as live use
    report = run_verify(store_in_data, data_dir)
    assert report["ok"], json.dumps(report["checks"], indent=2)
    assert report["record_count"] == 2


def test_verify_detects_missing_detail_record(tmp_path):
    store = SnapshotStore(tmp_path / "cache")
    doc = mini_doc()
    calls: list = []
    fetcher = Fetcher(transport=fixture_transport(calls), delay=0)
    # fetch only one of the two items
    run_fetch(store, fetcher, doc["unique_item_urls"][:1])

    records, failures = run_parse(store, doc)
    # the unfetched item must surface as an explicit failure, not silent absence
    assert len(records) == 1
    assert len(failures) == 1
    assert failures[0]["url"] == doc["unique_item_urls"][1]

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "categories.json").write_text(json.dumps(doc))
    write_jsonl(records, data_dir / "listings.jsonl")
    report = run_verify(store, data_dir)
    assert not report["ok"]
    one_per_item = [c for c in report["checks"] if c["name"] == "exactly one detail record per discovered unique item"][0]
    assert not one_per_item["ok"]
    assert one_per_item["detail"]["missing_records"] == [doc["unique_item_urls"][1]]
