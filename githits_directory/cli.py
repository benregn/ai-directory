"""Command-line interface.

    python -m githits_directory discover   # pass 1: categories + inventory
    python -m githits_directory fetch      # pass 2a: download detail pages (resumable)
    python -m githits_directory parse      # pass 2b: cache-only parse into listings.jsonl
    python -m githits_directory verify     # completeness + consistency report
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .cache import SnapshotStore
from .fetcher import DEFAULT_USER_AGENT, Fetcher
from .pipeline import run_discovery, run_fetch, run_parse, run_verify, write_jsonl


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="githits-directory", description=__doc__)
    p.add_argument("--data-dir", default="data", type=Path, help="output directory (default: data)")
    p.add_argument("--delay", type=float, default=0.5, help="minimum seconds between request starts, including retries (default: 0.5)")
    p.add_argument("--timeout", type=float, default=20.0, help="per-request timeout in seconds (default: 20)")
    p.add_argument("--retries", type=int, default=3, help="maximum retries after the initial attempt (default: 3)")
    p.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help="User-Agent header identifying this scraper")
    p.add_argument("--refresh", action="store_true", help="re-download even URLs with a successful snapshot")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("discover", help="pass 1: discover categories and item URLs into categories.json")
    sub.add_parser("fetch", help="pass 2a: fetch detail pages into the snapshot cache (resumable)")
    sub.add_parser("parse", help="pass 2b: parse cached snapshots into listings.jsonl (offline, no network)")
    sub.add_parser("verify", help="verify completeness and consistency of all outputs")
    return p


def make_fetcher(args) -> Fetcher:
    return Fetcher(
        user_agent=args.user_agent,
        delay=args.delay,
        timeout=args.timeout,
        max_retries=args.retries,
    )


def append_fetch_log(data_dir: Path, events: list) -> None:
    if not events:
        return
    data_dir.mkdir(parents=True, exist_ok=True)
    with open(data_dir / "fetch-log.jsonl", "a") as fh:
        for event in events:
            fh.write(json.dumps(event, sort_keys=True) + "\n")


def cmd_discover(args) -> int:
    store = SnapshotStore(args.data_dir / "cache")
    fetcher = make_fetcher(args)
    events: list = []
    try:
        doc = run_discovery(store, fetcher, refresh=args.refresh, log_events=events)
    finally:
        append_fetch_log(args.data_dir, events)
    args.data_dir.mkdir(parents=True, exist_ok=True)
    out = args.data_dir / "categories.json"
    out.write_text(json.dumps(doc, indent=2, ensure_ascii=False, sort_keys=True) + "\n")

    print(f"categories: {len(doc['categories'])}")
    for cat in doc["categories"]:
        flag = "" if cat["advertised_count"] == cat["collected_count"] else "  <-- MISMATCH"
        err = f"  FETCH ERROR: {cat['fetch_error']}" if cat.get("fetch_error") else ""
        print(f"  {cat['slug']}: advertised={cat['advertised_count']} collected={cat['collected_count']}{flag}{err}")
    print(f"topics: {len(doc['topics'])}")
    print(f"unique items across categories: {doc['unique_item_count']}")
    print(f"directory-wide inventory: {doc['directory_inventory']['url_count']}")
    obs = doc["observations"]
    print(f"advertised total: {obs['advertised_total']}")
    if obs["in_inventory_not_in_categories"]:
        print(f"WARNING inventory items not in any category: {obs['in_inventory_not_in_categories']}")
    if obs["in_categories_not_in_inventory"]:
        print(f"WARNING category items missing from inventory: {obs['in_categories_not_in_inventory']}")
    print(f"written: {out}")
    return 1 if doc["errors"] else 0


def cmd_fetch(args) -> int:
    cat_path = args.data_dir / "categories.json"
    if not cat_path.exists():
        print("categories.json missing — run discover first", file=sys.stderr)
        return 2
    doc = json.loads(cat_path.read_text())
    urls = doc.get("unique_item_urls", [])
    if not urls:
        print("categories.json contains no item urls", file=sys.stderr)
        return 2
    store = SnapshotStore(args.data_dir / "cache")
    fetcher = make_fetcher(args)
    events: list = []
    try:
        summary = run_fetch(store, fetcher, urls, refresh=args.refresh, log_events=events, progress=print)
    finally:
        append_fetch_log(args.data_dir, events)
    print(
        f"fetch: total={summary['total']} fetched={summary['fetched']} "
        f"cached={summary['skipped_cached']} failed={len(summary['failed'])}"
    )
    for fail in summary["failed"]:
        print(f"  FAILED {fail['url']}: {fail['error']}")
    if summary["failed"]:
        print("INCOMPLETE: re-run fetch to resume; successful pages are not re-downloaded")
        return 1
    return 0


def cmd_parse(args) -> int:
    cat_path = args.data_dir / "categories.json"
    if not cat_path.exists():
        print("categories.json missing — run discover first", file=sys.stderr)
        return 2
    doc = json.loads(cat_path.read_text())
    store = SnapshotStore(args.data_dir / "cache")
    records, failures = run_parse(store, doc)
    out = args.data_dir / "listings.jsonl"
    write_jsonl(records, out)
    print(f"parsed {len(records)} records -> {out} (offline, network unused)")
    if failures:
        print(f"PARSE FAILURES: {len(failures)}")
        for fail in failures:
            print(f"  {fail['url']}: {fail['error']}")
        print("dataset is INCOMPLETE — fix snapshots or parser and re-run parse")
        return 1
    return 0


def cmd_verify(args) -> int:
    store = SnapshotStore(args.data_dir / "cache")
    report = run_verify(store, args.data_dir)
    out = args.data_dir / "verify-report.json"
    report_path_written = False
    try:
        args.data_dir.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
        report_path_written = True
    except OSError as exc:
        print(f"could not write verify report: {exc}", file=sys.stderr)

    for chk in report["checks"]:
        mark = "ok  " if chk["ok"] else "FAIL"
        print(f"[{mark}] {chk['name']}")
        detail = chk["detail"]
        if not chk["ok"] or chk["name"].startswith("per-category"):
            print(f"      {json.dumps(detail, default=str)[:2000]}")
    print(f"records: {report.get('record_count', 0)}")
    if report.get("fallback_usage"):
        print(f"fallback usage (retained unexpected markup): {report['fallback_usage']}")
    if report_path_written:
        print(f"report: {out}")
    print("VERIFY: PASS" if report["ok"] else "VERIFY: FAIL")
    return 0 if report["ok"] else 1


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return {
        "discover": cmd_discover,
        "fetch": cmd_fetch,
        "parse": cmd_parse,
        "verify": cmd_verify,
    }[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
