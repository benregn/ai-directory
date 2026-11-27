"""Build the self-contained static HTML explainer mapping each extracted
field of one listings.jsonl record (Aeon) to its source region on the
detail page. Images are embedded as base64 so the file stands alone."""

import base64
import html as htmlmod
import json
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent


def b64(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def esc(s) -> str:
    return htmlmod.escape(str(s))


aeon = None
for line in open(ROOT / "data" / "listings.jsonl"):
    r = json.loads(line)
    if r["id"] == "aeon":
        aeon = r
        break

det = {e["label"]: e for e in aeon["sections"]["details"]["entries"]}

LEGEND_HEADER = [
    (1, "breadcrumbs[]", "nav.breadcrumbs ol li",
     "Software Factory Directory → Agent orchestration → Aeon (current, no link)",
     "link text + href per crumb; the current page crumb keeps url: null"),
    (2, "logo_url", "header .listing-logo img[src]",
     aeon["logo_url"],
     "resolved to absolute; null when the site shows an initials placeholder instead"),
    (3, "name", ".listing-identity h1", aeon["name"], ""),
    (4, "byline", ".listing-byline",
     'category "Agent orchestration" (linked) + badge "Open source"',
     "badge list is empty for proprietary items (e.g. 8090)"),
    (5, "actions[0]", ".listing-actions a[0] (first anchor)",
     '"Visit website" → https://www.aeon.fun/ (external)',
     "link text and destination both kept; outbound sites are never crawled"),
    (6, "actions[1]", ".listing-actions a[1] (second anchor)",
     '"View on GitHub" → https://github.com/aeonfun/aeon',
     "absent entirely for items without a repository (e.g. 8090 has only action[0])"),
    (7, "summary", "p.listing-summary", aeon["summary"], ""),
]

LEGEND_BODY = [
    (8, "sections.overview.paragraphs[]", "section#overview .listing-prose p",
     "2 paragraphs, full text kept",
     "each paragraph is {text, links[]} — link text+href preserved in document order (Aeon has none)"),
    (9, "sections.features.items[]", "section#features ul.listing-features li",
     "5 items, e.g. \"" + aeon["sections"]["features"]["items"][0]["text"] + '"',
     "the checkmark is a decorative SVG and carries no text"),
]

rows = [
    (10, "Website", det["Website"]["links"][0]["href"] + ' (text "' + det["Website"]["links"][0]["text"] + '")',
     "generic {label, text, links[]} — every row is captured, in document order"),
    (11, "Company", det["Company"]["text"], "plain text row"),
    (12, "Category", det["Category"]["links"][0]["href"], "internal link, kept absolute"),
    (13, "Source", det["Source"]["text"], '"Open source" here; "Proprietary" on 8090'),
    (14, "Repository", det["Repository"]["repositories"][0]["url"] + " — stars 777",
     "ul.listing-repositories → repositories[]{url, text, stars, stars_approximate, stars_raw}; "
     "exact here — K-form displays like 53.1K never fill stars, only stars_approximate"),
    (15, "License", det["License"]["text"], "row absent entirely on 8090 — absence is not text"),
    (16, "Commercial offering", '"' + det["Commercial offering"]["text"] + '"',
     'explicit "None found" text is preserved verbatim — distinct from a missing row'),
    (17, "Topics", " / ".join(t["text"] for t in det["Topics"]["topics"]),
     "ul.listing-tags → topics[]{text, url} — links to the directory's own tag filters"),
    (18, "Listed", '"' + det["Listed"]["text"] + '"',
     "plain text in source — NO machine date exists here and none is invented"),
    (19, "Last verified", det["Last verified"]["time"]["datetime"] + ' (displayed as "' + det["Last verified"]["time"]["text"] + '")',
     "<time datetime> — the exact machine-readable date is captured verbatim"),
]

LEGEND_DETAILS = [
    (n, f'sections.details.entries[] — "{label}"', f'dl.listing-details div:has(dt "{label}")', val, note)
    for n, label, val, note in rows
]

LEGEND_SIMILAR = [
    (20, "sections.similar.cards[]", "section#similar li.listing-card-item",
     "4 cards: AI-Ready Nx Workspace, Alfred (★4), Beadhive (★9), Cyrus (★857)",
     "each card: {name, url, summary, category, badges[], stars…, logo_url}"),
    (21, "sections.similar.more_link", "p.listing-more a",
     '"All agent orchestration" → category page',
     ""),
]


def legend_table(items) -> str:
    out = ['<table><thead><tr><th class="num">#</th><th>JSON field in listings.jsonl</th>'
           "<th>CSS selector in source HTML</th><th>extracted value (Aeon)</th><th>notes</th></tr></thead><tbody>"]
    for num, field, selector, value, note in items:
        out.append(
            f'<tr><td class="num"><span class="badge">{num}</span></td>'
            f"<td><code>{esc(field)}</code></td><td><code>{esc(selector)}</code></td>"
            f"<td>{esc(value)}</td><td>{esc(note)}</td></tr>"
        )
    out.append("</tbody></table>")
    return "\n".join(out)


def json_html(obj) -> str:
    """Pretty-printed JSON with light syntax highlighting, HTML-escaped."""
    import re

    text = json.dumps(obj, indent=2, ensure_ascii=False)
    escaped = esc(text)
    strpat = r"&quot;(?:\\&quot;|[^&]|&(?!quot;))*?&quot;"
    token = re.compile(
        rf"(?P<key>{strpat}(?=\s*:))"
        rf"|(?P<str>{strpat})"
        rf"|(?P<lit>\bnull\b|\btrue\b|\bfalse\b|-?\d+(?:\.\d+)?)"
    )

    def repl(m):
        cls = {"key": "jk", "str": "js", "lit": "jn"}[m.lastgroup]
        return f'<span class="{cls}">{m.group(0)}</span>'

    return token.sub(repl, escaped)


def json_block(obj, caption=None) -> str:
    cap = f'<div class="jcap">{esc(caption)}</div>' if caption else ""
    return f'{cap}<pre class="json"><code>{json_html(obj)}</code></pre>'


# -- JSON fragments per region group ----------------------------------------

FRAG_HEADER = {
    "breadcrumbs": aeon["breadcrumbs"],
    "name": aeon["name"],
    "logo_url": aeon["logo_url"],
    "byline": aeon["byline"],
    "actions": aeon["actions"],
    "summary": aeon["summary"],
}
FRAG_BODY = {
    "sections": {
        "overview": aeon["sections"]["overview"],
        "features": aeon["sections"]["features"],
    }
}
FRAG_DETAILS = {"sections": {"details": aeon["sections"]["details"]}}
FRAG_SIMILAR = {"sections": {"similar": aeon["sections"]["similar"]}}
FRAG_PROVENANCE = {
    "id": aeon["id"],
    "url": aeon["url"],
    "categories": aeon["categories"],
    "section_order": aeon["section_order"],
    "fallback": aeon["fallback"],
    "source_snapshot": aeon["source_snapshot"],
    "parser_version": aeon["parser_version"],
    "parsed_at": aeon["parsed_at"],
}


imgs = {
    "full": b64(HERE / "annotated-full.png"),
    "header": b64(HERE / "crop-header.png"),
    "body": b64(HERE / "crop-body.png"),
    "details": b64(HERE / "crop-details.png"),
    "similar": b64(HERE / "crop-similar.png"),
}

page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Where each field comes from — Aeon detail page → listings.jsonl</title>
<style>
  :root {{ --bg:#101114; --panel:#181a1f; --ink:#e8e6e3; --muted:#9c978f;
           --accent:#ffd60a; --line:#2c2f36; --code:#7ee0c3; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--ink);
         font:15px/1.55 -apple-system, "Helvetica Neue", Arial, sans-serif; }}
  main {{ max-width:1560px; margin:0 auto; padding:32px 28px 80px; }}
  h1 {{ font-size:26px; margin:0 0 6px; }}
  h2 {{ font-size:19px; margin:42px 0 4px; border-top:1px solid var(--line); padding-top:28px; }}
  h2 .step {{ color:var(--muted); font-weight:400; font-size:14px; display:block; }}
  p.sub {{ color:var(--muted); margin:4px 0 14px; max-width:1100px; }}
  code {{ color:var(--code); font-family:"SF Mono", Menlo, monospace; font-size:12.5px; }}
  img {{ display:block; max-width:100%; border:1px solid var(--line); border-radius:6px;
        background:#000; margin:10px 0 6px; }}
  .imgnote {{ color:var(--muted); font-size:12.5px; margin-bottom:18px; }}
  .split {{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,470px); gap:20px; align-items:start; }}
  @media (max-width:1150px) {{ .split {{ grid-template-columns:minmax(0,1fr); }} }}
  .jsonside {{ position:sticky; top:12px; }}
  @media (max-width:1150px) {{ .jsonside {{ position:static; }} }}
  pre.json {{ background:#0b0c0e; border:1px solid var(--line); border-radius:6px; padding:12px 14px;
             overflow:auto; max-height:560px; margin:4px 0 18px; font-size:11.5px; line-height:1.45; }}
  pre.json code {{ color:#c9c4bc; font-family:"SF Mono", Menlo, monospace; }}
  pre.json .jk {{ color:#7ee0c3; }}
  pre.json .js {{ color:#e8b76a; }}
  pre.json .jn {{ color:#ce8fe8; }}
  .jcap {{ color:var(--muted); font-size:12px; margin:10px 0 2px; text-transform:uppercase; letter-spacing:.05em; }}
  pre.full {{ max-height:none; }}
  table {{ border-collapse:collapse; width:100%; margin:8px 0 10px; background:var(--panel); }}
  th, td {{ text-align:left; vertical-align:top; padding:8px 10px; border:1px solid var(--line); font-size:13px; }}
  th {{ color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }}
  td.num {{ white-space:nowrap; width:1%; }}
  .badge {{ display:inline-block; background:var(--accent); color:#141414; font-weight:700;
           min-width:22px; text-align:center; border-radius:3px; padding:1px 5px; font-size:12.5px; }}
  .flow {{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:14px 0; }}
  .flow span {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:7px 12px; font-size:13px; }}
  .flow b {{ color:var(--accent); font-weight:400; }}
  .notes li {{ margin:5px 0; }}
  .wide {{ max-width:100%; overflow-x:auto; }}
</style></head><body><main>

<h1>Where each field of one record comes from</h1>
<p class="sub">Item: <b>Aeon</b> — <code>https://githits.com/software-factories/aeon/</code> → one line in
<code>data/listings.jsonl</code>. The parser is deterministic BeautifulSoup over the cached HTML snapshot:
no JavaScript execution, no embedded JSON dataset (the page's only JSON-LD is SEO boilerplate), no LLM.
Numbers on the screenshots match the tables below.</p>

<div class="flow">
  <span><b>fetch</b> — one polite HTTP GET, response stored verbatim</span> →
  <span><b>snapshot</b> — <code>cache/html/…/aeon/index.html</code> + <code>meta.json</code></span> →
  <span><b>parse</b> — BeautifulSoup, fixed CSS-selector mapping</span> →
  <span><b>record</b> — <code>listings.jsonl</code> id <code>aeon</code></span>
</div>

<h2><span class="step">the whole page at a glance</span>Full-page map</h2>
<p class="sub">All 21 annotated regions on the complete detail page. Zoomed crops with legends follow.</p>
<div class="wide"><img src="{imgs['full']}" alt="full annotated page" style="max-width:900px"></div>

<h2><span class="step">regions 1–7</span>Header: breadcrumbs, identity, actions, summary</h2>
<div class="split"><div>
<img src="{imgs['header']}" alt="annotated header crop">
<div class="imgnote">Screenshot crop of the live page, boxes measured with getBoundingClientRect(), chip numbers match the table.</div>
{legend_table(LEGEND_HEADER)}
</div><div class="jsonside">
{json_block(FRAG_HEADER, 'resulting JSON — regions 1–7')}
</div></div>

<h2><span class="step">regions 8–9</span>Overview and features</h2>
<div class="split"><div>
<img src="{imgs['body']}" alt="annotated overview/features crop">
{legend_table(LEGEND_BODY)}
</div><div class="jsonside">
{json_block(FRAG_BODY, 'resulting JSON — regions 8–9')}
</div></div>

<h2><span class="step">regions 10–19</span>The Details rows — every label/value pair</h2>
<div class="split"><div>
<img src="{imgs['details']}" alt="annotated details crop">
<p class="sub">Rows are captured generically as <code>{{label, text, links[]}}</code> in document order —
so labels the parser has never seen before are kept (flagged <code>unrecognized_label</code>), never dropped.
Three row shapes get extra structure: Repository (repo list + stars), Topics (tag links), and any row with a
<code>&lt;time datetime&gt;</code> element.</p>
{legend_table(LEGEND_DETAILS)}
</div><div class="jsonside">
{json_block(FRAG_DETAILS, 'resulting JSON — regions 10–19')}
</div></div>

<h2><span class="step">regions 20–21</span>Similar-item cards</h2>
<div class="split"><div>
<img src="{imgs['similar']}" alt="annotated similar crop">
{legend_table(LEGEND_SIMILAR)}
</div><div class="jsonside">
{json_block(FRAG_SIMILAR, 'resulting JSON — regions 20–21')}
</div></div>

<h2><span class="step">not from the page</span>Provenance fields — added by the pipeline, not the HTML</h2>
<p class="sub">These record fields come from the fetch/parse pipeline itself: the inventory membership of pass 1,
the snapshot metadata, the parser run. Everything else in the record is extracted from the markup shown above.</p>
{json_block(FRAG_PROVENANCE, 'pipeline-added fields')}

<h2><span class="step">complete record</span>The full JSON — one line of listings.jsonl, pretty-printed</h2>
<p class="sub">Exactly what the parser emits for Aeon (in the file it is one line; keys are sorted there).
<code>parsed_at</code> varies per run; everything else is deterministic.</p>
<pre class="json full"><code>{json_html(aeon)}</code></pre>

<h2><span class="step"></span>What is deliberately not extracted</h2>
<ul class="notes">
<li><b>No JSON dataset exists on the page.</b> The single <code>application/ld+json</code> block is schema.org SEO
boilerplate (Organization, WebSite, BreadcrumbList, a thin WebPage node) — no features, details rows, license,
repositories, stars or topics. Everything above comes from semantic HTML.</li>
<li><b>The JSON-LD <code>dateModified</code></b> duplicates the Last-verified date at page granularity; redundant with
<code>&lt;time datetime&gt;</code>, so not extracted.</li>
<li><b>Outbound sites are never crawled</b> — aeon.fun and github.com URLs are recorded as strings, not followed.</li>
<li><b>The on-page tab navigation</b> (<code>nav.listing-tabs</code>: Overview/Features/Details/Similar anchors) is pure
in-page navigation and skipped by design.</li>
<li><b>Star glyphs and checkmark SVGs</b> are decorative markup; the counts and feature texts are what get captured.</li>
<li><b>Anything the parser does not understand</b> (an unknown section, an unexpected element) would land in the record's
<code>fallback[]</code> with its raw HTML — across all 239 live records this has never fired, because the site's
markup is uniform.</li>
</ul>

</main></body></html>
"""

out = HERE / "index.html"
out.write_text(page)
print("written", out, f"{out.stat().st_size/1024:.0f} KB")
