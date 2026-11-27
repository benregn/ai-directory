# Design brief: high-information-density directory viewer — image-generated mockups

You are one of two agents independently designing the same page. Produce **image-generated UI mockups**: use whatever image-generation capability you have (a native image model, an MCP image tool, or an image API) to create them. Do **not** hand-code HTML/CSS and screenshot it — the point of this exercise is visual exploration through generative images, which reaches compositions hand-coding doesn't.

## What the product is

`ai-directory` is a local, machine-readable copy of the [githits.com software-factories directory](https://githits.com/software-factories/) — a catalog of **239 products** in the AI coding-agent space: agent orchestration platforms, prompt-to-app builders, engineering factories, code-review agents, agent infrastructure. Think of it as a dense crunchy database of "who makes what in AI software factories."

We need a **single viewer page** for this data. The target user is a technical evaluator — someone comparing dozens of agent products to shortlist them. They want maximum scan-throughput: see everything at once, filter fast, drill in only when interested. This is a *tool*, not a website.

## The data the page must show (all real, measured from the dataset)

**239 rows total.** Categories and exact counts:

| category | count |
|---|---|
| Agent orchestration | 74 |
| App builders | 65 |
| Engineering factories | 56 |
| Agent infrastructure | 19 |
| Code review & quality | 10 |
| Agent workspaces | 9 |
| AI labs | 4 |
| Development platforms | 2 |

Per-row fields available for display:

- **name** + small square logo (some rows have none — letter-tile fallback)
- **summary** — one line, ~12–16 words ("Open-source framework that runs unattended on GitHub Actions, dispatching markdown-defined skills…")
- **category** — one of the 8 above
- **topics** — 1–4 tags per row, from ~30 distinct: MCP (77 rows), Prompt to app (63), Works with your agents (57), Web apps (50), Code review (43), CLI (40), Issue to pull request (39), Enterprise (37), Multi-agent systems (37), Testing & QA (34), Background agents (28), Sandboxes (28), Governance & audit (25), Mobile apps (25), IDE (19)…
- **license** — MIT (46), Apache-2.0 (27), AGPL-3.0, a few others; or proprietary/absent. **102 rows are open source, 111 proprietary**
- **deployment** — combinations of Cloud / Self-hosted / Local (Cloud-only 43, Self-hosted 19, mixes for the rest)
- **GitHub stars** — only ~40% of rows have a repo; max 861, typical 10–500. Null for most rows
- **commercial offering** — yes/none found
- **verified** — month-year, e.g. "Oct 2026"; **listed** similar
- **links** — website, GitHub repo
- long-form (detail only): 1–3 overview paragraphs (~440 chars total), 3–6 feature bullets, a details key/value grid, 3–4 "similar products" cards

**`sample-rows.json` (next to this brief) has 12 real rows — use these names, summaries and values verbatim in your mockups.** Realistic data density is the whole point; lorem ipsum or invented names ruin the exercise. If you need more than 12 rows visible, repeat/vary them plausibly.

## The design direction

**High information density is the explicit goal.** Reference points: Bloomberg/Reuters terminals, Linear's issue list, dense database GUIs, Grafana table panels, lobste.rs, mc/ncurses TUIs translated into modern web aesthetics. The baseline composition (you may adopt, adapt, or deliberately break it):

1. **Sticky one-line toolbar** — text filter, category chips with counts, small dropdowns (license/deploy/topic), OSS-only + has-stars toggles, live "n / 239" counter
2. **Dense sortable table as the hero** — rows ~20–28px tall, 11–12.5px type, 8–10 columns, truncated cells, zebra or hover state, sort indicators. All 239 rows conceptually on one page — no pagination, no cards-with-big-images grid
3. **Master-detail** — clicking a row fills a side panel (~380–440px) with overview, features, detail grid, similar items; the table stays visible. Keyboard navigation implied
4. Restrained color: near-monochrome chrome, color reserved for category coding, OSS/commercial semantics, stars

There is an existing static HTML baseline you can look at for the *information architecture only* (not as a visual ceiling): `docs/directory-page-mock.html` and its render `docs/mock-shot.png` in the same repo. Your job is to push beyond it visually.

**Anti-goals** — mockups showing these are failures: marketing landing-page hero, large whitespace, big cards with 16:9 images, 16px+ body text in the table, pastel-gradient SaaS-template look, fewer than ~15 rows visible at once.

## Deliverables

In **your assigned output directory** (given in your launch prompt, `docs/mockups/<agent>/`):

1. **2–3 distinct design directions**, one full-page PNG each at **1440×900** desktop scale — e.g. `variant-a.png`, `variant-b.png`, `variant-c.png`. Distinct means genuinely different compositions/density strategies, not recolors. At least one should show the master-detail state (a row selected, detail panel open)
2. **`NOTES.md`** — per variant, 3–5 sentences: what the density strategy is, what you deliberately traded away, anything the static screenshot can't convey

Quality bar: iterate. Generate, inspect the result critically (open the image and look at it), refine the prompt, regenerate — at least 2–3 iterations per kept variant. Text in generated images tends to blur or garble: prefer compositions and prompt wording that keep UI text short and crisp (column headers, names, numbers), and re-generate when words mangle. A mockup that looks like a real, opinionated, shipping product is the bar — not a wireframe, not a vibe.

## Constraints

- Desktop only, 1440×900, light or dark theme is your choice per variant
- Everything legible at 100% zoom in the final PNG — if the image model can't resolve tiny text, that's a prompt-composition problem to solve (fewer words visible, larger effective UI scale), not a license to ship mush
- Use the real product names/values from `sample-rows.json`
- Don't ask questions — make the call, write the reasoning in NOTES.md

When done, make sure the PNGs and NOTES.md are in your output directory, then stop.
