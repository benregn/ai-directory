# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Viewer: a framework app (React/Svelte/etc.) with a build step — confirmed by the owner, who chose interaction headroom over zero-dependency static HTML. The specific framework is **not yet chosen**; record it here once decided. Pipeline: existing Python 3.11 CLI (`githits-directory`, deps: beautifulsoup4, lxml, requests).

## Users

Primary: the owner **plus the people he shares it with** — teammates and peers evaluating the same space, who receive the data or the viewer from him. Their job: scanning, comparing, and shortlisting products in the AI software-factory / coding-agent space (agent orchestration, app builders, engineering factories, code review, infrastructure). They are technical evaluators who need scan-throughput, not onboarding.

## Product Purpose

A local, machine-readable mirror of the [githits.com software-factories directory](https://githits.com/software-factories/) plus a dense comparison viewer for it. The mirror makes the directory's data available offline, verbatim, and computable; the viewer makes 239 products scannable and comparable at a glance. Success: an evaluator can scan the whole space in minutes and trust every number they see.

## Positioning

Local-first, offline-reproducible mirror with full provenance and a strict no-invented-data discipline, paired with a dense analytical viewing surface. The canonical githits.com site is live and browseable but offers neither offline machine-readable access nor high-density comparison; generic scraping throws away exactly the fidelity this product preserves.

## Operating Context

- Pipeline rituals: `discover` → `fetch` → `parse` → `verify`, all cache-aware and resumable; parsing is fully offline; verification exits non-zero on any inconsistency so a partial dataset is never reported complete.
- Data artifacts: `data/categories.json`, `data/listings.jsonl` (239 records), `data/fetch-log.jsonl`, `data/verify-report.json`, raw HTML snapshots in `data/cache/html/`.
- The viewer is consumed as a shared artifact among peers — how it is shared (hosted, build output, repo) is **not yet decided**.
- Design exploration to date: image-generated composition studies in `docs/mockups/` (codex variants A–C) and a static HTML baseline mock `docs/directory-page-mock.html` with a master–detail dense-table plan.

## Capabilities and Constraints

- 239 listings across 8 categories; per-record structure documented in README (overview, features, details entries, similar items, provenance).
- Fidelity constraints future work must preserve: exact star counts only when the source is exact (approximations flagged, never invented); absent data stays absent (`null`, `None found` as published); unknown markup retained in `fallback[]`, nothing silently dropped; discrepancies recorded in `observations`, never hidden.
- Fetching is serial and polite (delay, bounded timeouts, honoring `Retry-After`); re-download only with `--refresh`.
- Whether sources beyond githits.com are ever in scope: **undecided**.

## Evidence on Hand

- `data/listings.jsonl` — the full 239-record dataset; `data/verify-report.json` — all checks green as of 2026-11-26.
- `docs/mockups/codex/variant-{a,b,c}.png` + NOTES.md — image-generated composition studies (variant C demonstrates the ~28px-row, 30-rows-visible density target).
- `docs/directory-page-mock.html`, `docs/mock-shot.png` — static baseline mock of the dense table + master-detail plan.
- `docs/provenance/` — field-by-field mapping explainer of one record to its source HTML.
- No testimonials, press, or external users exist; future work must not fabricate any.

## Product Principles

1. **Never invent data.** Absence, approximation, and discrepancy are all first-class facts and are displayed as such; precision is never fabricated.
2. **Offline-first and reproducible.** Snapshots before parsing, cache-aware everything, network only when the operator asks.
3. **Density is the viewer's virtue.** The audience is expert evaluators; scan-throughput outranks onboarding, decoration, and familiarity-for-its-own-sake.
4. **Dataset and viewer are both first-class.** The pipeline holds the fidelity bar; the viewer holds the craft bar; neither is a disposable accessory of the other.
5. **Provenance is always reachable.** Every rendered fact traces back to a snapshot and a source region of the page it came from.
