# Design brief — Factory Index directory viewer

## Job and audience
Owner and technical peers evaluating AI-agent products for real adoption decisions. They arrive to scan, not to browse: desktop-first, keyboard-comfortable, allergic to marketing. Both dataset and viewer are first-class deliverables; peers must be able to open a hosted URL and trust what they see.

## Outcome and proof
Primary task: scan/filter 239 products down to a personal shortlist, then share or export that shortlist. Success = a peer finishes a meaningful first-pass triage in minutes and can defend every row's provenance. Never invent data: sparse fields render as absence (—), never filler.

## Selected direction (seed:8b778f23578b8025, user-pinned)
**The Parametric Parts Catalog**, as fused by the owner:
- Base: round-1 Parts — dark masthead with CAT. NO. furniture, checkbox facet rail exactly as v1, spec-matrix table with monospaced machine facts, parameter strip showing active filters. Barlow + Red Hat Mono. Palette: `#ffffff / #14181d / #6b7280 / #0057b8`.
- Fusion: right detail drawer in the canon's clean structure (category pill, name, three actions, sections) carrying the Printed directory's full information at its density — 25px mono fact rows with hairlines: category, license, stars, open source, topics, deployment, commercial, listed, verified; then overview, same-class compare, entry-position footer.
- Reference implementation: `.impeccable/mocks/decision/model-pick-v3.html`.
- Honest risk to respect: rail + matrix + drawer compete for width; the drawer is additive, not a compromise.

## Scope and boundaries
One surface: the directory index. Lightweight shortlisting — mark/hide rows, share/export, state in URL + localStorage, no backend, no accounts. React + Vite + ui-sdk.dev (virtualizer, selection, typeahead), built code-led, deployed as static files peers open via URL. Anti-goals: pagination as a tax (the 239 must scan as one register), marketing chrome, invented filler data, mobile-first compromises that cost desktop density.

## States and ranges
239 rows; 8 categories (74/65/56/19/10/9/4/2); stars on ~101 rows (max 861); 102 OSS / 111 proprietary / 26 unspecified; ~30 topics; licenses sparse (MIT 46, Apache-2.0 27, AGPL-3.0 5). Material states: drawer open/closed, filter combinations incl. empty-result, shortlist marks, missing data, first-visit (no shortlist) vs returning (shortlist restored).

## Interaction and layout
Dense table is the scan instrument; row click opens the drawer; facet rail multi-selects with checkboxes; parameter strip reflects and clears active filters; columns sort; virtualization keeps 239 rows in one scroll. Density target: rows near 26–28px equivalents, not canon's airy 36px+pagination.

## Constraints and open decisions
Static hosting, no server-side anything. Open, not blocking: exact share/export mechanics (copy link vs file), whether non-githits sources ever join the dataset. Builder must not invent: the fusion's fact-row grammar, the checkbox rail, a different accent color, or a pagination control.
