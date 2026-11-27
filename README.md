# ai-directory

A local, machine-readable copy of the [githits.com software-factories directory](https://githits.com/software-factories/).

Fetching and parsing are plain deterministic Python — no LLM or agent is involved in extraction decisions at runtime. Fetching and parsing are separate stages: every HTML response is kept as a local snapshot, and cached pages can be reparsed offline at any time.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e . pytest
```

Dependencies (declared in `pyproject.toml`): `beautifulsoup4` + `lxml` (HTML parsing), `requests` (HTTP).

## Commands

Run from the project root. All commands accept `--data-dir` (default `data`), `--delay`, `--timeout`, `--retries`, `--user-agent`, `--refresh`.

```bash
# pass 1 — discover categories dynamically, collect item URLs per category
.venv/bin/python -m githits_directory discover

# pass 2a — fetch every unique detail page once; resumable, serial, polite
.venv/bin/python -m githits_directory fetch

# pass 2b — reparse cached snapshots into listings.jsonl (offline, no network)
.venv/bin/python -m githits_directory parse

# verify completeness and consistency; writes data/verify-report.json
.venv/bin/python -m githits_directory verify

# tests (offline; use saved real HTML fixtures)
.venv/bin/python -m pytest tests/
```

`discover` and `fetch` are cache-aware: a page with a successful snapshot is never re-downloaded unless `--refresh` is passed, so an interrupted run resumes where it stopped. `parse` never touches the network. `verify` exits non-zero when any check fails, so a partial dataset is never reported as complete.

## Politeness

Requests are strictly serial with at least `--delay` seconds (default **0.5**) between the start of any two requests, retries included. Timeouts are bounded (`--timeout`, default 20s). Retries (`--retries`, default 3) use exponential backoff, honor `Retry-After` (seconds and HTTP-date forms), and only happen for transient failures: connection errors, timeouts, HTTP 429 and 5xx. Client errors like 404 are not retried. The scraper identifies itself with a descriptive User-Agent; every attempt is logged to `data/fetch-log.jsonl`.

## Layout

```
data/
  categories.json       pass 1: categories, topics, item URLs, inventory
  listings.jsonl        pass 2: one structured record per unique item
  fetch-log.jsonl       append-only log of every fetch attempt
  verify-report.json    machine-readable verification report
  cache/html/           raw response snapshots, mirroring URL paths
    githits.com/software-factories/aeon/
      index.html        verbatim response body
      meta.json         requested/final URL, timestamp, status, headers, hash
```

## Output fields

### categories.json

| field | meaning |
|---|---|
| `source` | directory index URL |
| `discovered_at` | ISO-8601 UTC timestamp of the discovery run |
| `categories[]` | `{name, slug, url, advertised_count, item_urls, collected_count}` — `advertised_count` is the number the site displays next to the category; `item_urls` are normalized absolute detail URLs in page order, deduplicated per category |
| `topics[]` | `{name, url, advertised_count, filter}` — the query-string filter links (`?tag=…`, `?oss=…`), kept distinct from categories |
| `directory_inventory` | the homepage's full results grid: `url_count`, `item_urls`, and `cards` mapping each URL to the grid's machine-readable data attributes (`added_ms` unix-ms timestamp, `category`, `tags`, `oss`, `featured`, `deployment`) |
| `unique_item_count` / `unique_item_urls` | deduplicated union across all categories |
| `items` | per-URL category membership (`categories` list) and `in_directory_inventory` flag |
| `observations` | advertised total and set differences between inventory and category union — discrepancies are recorded here, not hidden |
| `errors` | explicit per-category fetch failures, if any |

### listings.jsonl

One JSON object per line, exactly one per discovered unique item:

| field | meaning |
|---|---|
| `id` | stable slug from the URL path (`aeon`) |
| `url` | normalized absolute detail URL |
| `categories` | category slugs this item belongs to (from pass 1) |
| `name` | `h1` text |
| `logo_url` | absolute logo image URL; `null` when the site shows an initials placeholder instead of an image |
| `breadcrumbs[]` | `{text, url, current}` — the current page crumb has `url: null` |
| `byline` | `{text, category: {text, url}, badges[]}` — e.g. `Open source` badge; absent badges mean the site shows none |
| `actions[]` | header action links `{text, url, external, rel}` (e.g. *Visit website*, *View on GitHub*) |
| `summary` | the `p.listing-summary` text |
| `sections.overview.paragraphs[]` | `{text, links[]}` per paragraph; links carry `{text, href}` in document order |
| `sections.features.items[]` | `{text, links[]}` per feature |
| `sections.details.entries[]` | every Details row in document order: `{label, text, links[]}` plus structured extras — `repositories[]` (`{url, text, stars, stars_approximate, stars_raw}`) for Repository rows, `topics[]` (`{text, url}`) for Topics rows, `time` (`{text, datetime}`) when a `<time datetime>` element exists. Rows absent from the page are absent here; explicit text such as `None found` is preserved as-is. Labels outside the known set are kept and flagged `unrecognized_label` |
| `sections.similar.cards[]` | similar-item cards `{name, url, summary, category, badges[], stars, stars_approximate, stars_raw, logo_url}` |
| `sections.similar.more_link` | `{text, url}` of the "All \<category\>" link |
| `section_order` | section ids in document order |
| `fallback[]` | structured retention of any markup the parser does not understand: `{type, tag, id, classes, heading, text, html}` — nothing is silently dropped |
| `source_snapshot` | provenance: `requested_url`, `final_url`, `fetched_at`, `status`, `body_sha256`, `snapshot_path` |
| `parser_version` / `parsed_at` | parser version and parse timestamp |

**Star counts.** The site displays either exact counts (`777 stars`) or thousand-abbreviated ones (`53.1K stars`). `stars` is the exact integer and is set *only* when the display is exact; `stars_approximate` is the numeric form of whatever was displayed (scaled for `K`, e.g. `53100`); `stars_raw` is the verbatim element text. When the site shows no count at all, all three are `null`. No precision is invented.

**Dates.** `Last verified` rows carry a `<time datetime="2026-10-26">` element; both the display text and the verbatim `datetime` attribute are captured. `Listed` rows are plain text (e.g. `October 2026`) with no machine-readable form in the source — none is fabricated. Homepage `added_ms` inventory timestamps are unix milliseconds as-published.

## Completeness model

There is no pagination: every category page server-renders all its cards, and the homepage embeds the full directory in its `[data-directory-grid]` results list (visible previews on the homepage are a curated subset — the grid, not the previews, is the inventory). `verify` checks, without any hard-coded expectations:

- per-category collected unique URLs vs. the site's advertised counts
- category union vs. the directory-wide inventory, both directions
- advertised total explained by (multi-)category membership
- inventory card categories vs. category-page membership
- valid JSONL, unique ids, **exactly one detail record per discovered unique item**
- a successful snapshot on disk for every unique item

As of the first run: 8 categories, advertised total 239 = 239 unique items = 239 inventory items, zero discrepancies, zero multi-category items.

## Tests

`tests/` runs fully offline against real saved HTML (`tests/fixtures/`), with expected values hand-checked against the source — never generated by the parser under test. Coverage: Aeon's five features, repository, MIT license, exact verification date and four similar-item cards; 8090's headquarters and absent repository/license rows; explicit failure on missing `.listing` markup; cached replay making zero network requests while reproducing identical output; retry paths honoring delay, backoff and `Retry-After`; incomplete datasets failing verification.
