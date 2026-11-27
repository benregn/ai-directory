"""Deterministic BeautifulSoup parsers for githits.com directory pages.

No extraction decision is made heuristically at runtime: every rule below is a
fixed, declarative mapping from the site's documented markup to output fields.
Unknown structure is preserved verbatim in `fallback` lists rather than
dropped.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

BASE_URL = "https://githits.com"
INDEX_URL = "https://githits.com/software-factories/"
CATEGORY_PREFIX = "/software-factories/category/"

KNOWN_DETAIL_LABELS = {
    "Website",
    "Company",
    "Headquarters",
    "Category",
    "Source",
    "Repository",
    "License",
    "Commercial offering",
    "Deployment",
    "Topics",
    "Listed",
    "Last verified",
}

KNOWN_SECTION_IDS = {"overview", "features", "details", "similar"}


class ListingParseError(Exception):
    """Raised when a detail page has no usable .listing markup."""


def soup(html: bytes | str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def text_of(tag: Tag | None) -> str:
    if tag is None:
        return ""
    return " ".join(tag.get_text(" ", strip=True).split())


def absolute(href: str, base: str = BASE_URL) -> str:
    return urljoin(base, href)


def rich_text(tag: Tag, base: str = BASE_URL) -> dict:
    """Plain text plus every link's text and destination, in document order."""
    links = []
    for a in tag.find_all("a"):
        href = a.get("href")
        links.append(
            {
                "text": text_of(a),
                "href": absolute(href, base) if href else None,
            }
        )
    return {"text": text_of(tag), "links": links}


def parse_stars(text: str) -> dict:
    """Parse a displayed star count into its honest machine-readable forms.

    The site displays either exact counts ('777 stars', '★ 857') or
    thousand-abbreviated ones ('53.1K stars'). Exact displays fill both
    `stars` and `stars_approximate`; K-displays fill only
    `stars_approximate` (scaled, e.g. 53100) — never `stars`, because the
    exact count is not in the source. `stars_raw` is always the verbatim
    display text.
    """
    result = {"stars": None, "stars_approximate": None, "stars_raw": None}
    stripped = text.strip()
    # K-form first: '1.3K stars' or trailing '16.6K'
    m = re.search(r"(\d+(?:\.\d+)?)\s*K\b", stripped, re.IGNORECASE)
    if m:
        approx = round(float(m.group(1)) * 1000)
        result["stars_approximate"] = approx
        result["stars_raw"] = stripped or None
        return result
    m = re.search(r"([\d][\d,]*)\s*stars?\b", stripped, re.IGNORECASE)
    if not m:
        # card format: star glyph then bare number, e.g. '★ 857'
        m = re.search(r"([\d][\d,]*)\s*$", stripped)
    if m:
        try:
            exact = int(m.group(1).replace(",", ""))
        except ValueError:
            exact = None
        if exact is not None:
            result["stars"] = exact
            result["stars_approximate"] = exact
    result["stars_raw"] = stripped or None
    return result


# ---------------------------------------------------------------------------
# index / category pages
# ---------------------------------------------------------------------------

def parse_topic_chips(page: BeautifulSoup) -> dict:
    """Discover category and topic links from the topic-chips section.

    Categories are links under /software-factories/category/; everything else
    in the section is a topic/filter link. Names exclude the trailing count
    badge; counts are the site's advertised numbers."""
    section = page.select_one('[aria-labelledby="topic-chips-heading"]')
    if section is None:
        raise ListingParseError("no [aria-labelledby=topic-chips-heading] section found")
    categories, topics = [], []
    for a in section.select("a[href]"):
        href = a.get("href", "")
        badge = a.select_one("span")
        count = None
        if badge is not None:
            raw = text_of(badge)
            if raw.isdigit():
                count = int(raw)
        # link text without the count badge
        name = text_of(a)
        if badge is not None:
            badge_text = text_of(badge)
            if name.endswith(badge_text):
                name = name[: -len(badge_text)].strip()
        entry = {
            "name": name,
            "url": absolute(href),
            "advertised_count": count,
        }
        if urlsplit_path(href).startswith(CATEGORY_PREFIX):
            entry["slug"] = urlsplit_path(href).strip("/").split("/")[-1]
            categories.append(entry)
        else:
            query = urlsplit(href).query
            if query:
                entry["filter"] = query
            topics.append(entry)
    return {"categories": categories, "topics": topics}


def urlsplit_path(href: str) -> str:
    return urlsplit(href).path


def parse_card(li: Tag, base: str = BASE_URL) -> dict | None:
    """Parse one li.listing-card-item. Returns None when no card link exists."""
    a = li.select_one("a.listing-card[href]")
    if a is None:
        return None
    card: dict = {"url": absolute(a["href"], base)}
    name = a.select_one(".listing-card-name")
    card["name"] = text_of(name) if name else None
    summary = a.select_one(".listing-card-summary")
    card["summary"] = text_of(summary) if summary else None
    logo = a.select_one(".listing-logo img[src]")
    card["logo_url"] = absolute(logo["src"], base) if logo else None
    badges = [text_of(b) for b in a.select(".listing-card-badge")]
    card["badges"] = [b for b in badges if b]
    meta = a.select_one(".listing-card-meta")
    category = None
    stars = {"stars": None, "stars_approximate": None, "stars_raw": None}
    if meta is not None:
        for span in meta.find_all("span", recursive=False):
            classes = span.get("class") or []
            if "listing-card-stars" in classes:
                stars = parse_stars(text_of(span))
            elif not classes and category is None:
                category = text_of(span)
    card["category"] = category
    card.update(stars)
    # machine-readable data attributes exist on homepage results-grid items
    data = {}
    for attr in ("name", "category", "tags", "oss", "added"):
        if li.has_attr(f"data-{attr}"):
            data[attr] = li[f"data-{attr}"]
    for flag in ("deployment", "featured"):
        if li.has_attr(f"data-{flag}"):
            data[flag] = True
    if data:
        if "added" in data and str(data["added"]).isdigit():
            data["added_ms"] = int(data["added"])
        card["data"] = data
    return card


def parse_cards(page: BeautifulSoup, base: str = BASE_URL) -> list[dict]:
    cards = []
    for li in page.select("li.listing-card-item"):
        card = parse_card(li, base)
        if card is not None:
            cards.append(card)
    return cards


def parse_results_grid(page: BeautifulSoup) -> list[dict]:
    """The homepage's directory-wide inventory lives in [data-directory-grid]."""
    grid = page.select_one("[data-directory-grid]")
    if grid is None:
        return []
    cards = []
    for li in grid.select("li.listing-card-item"):
        card = parse_card(li)
        if card is not None:
            cards.append(card)
    return cards


# ---------------------------------------------------------------------------
# detail pages
# ---------------------------------------------------------------------------

def parse_listing(html: bytes | str, page_url: str) -> dict:
    page = soup(html)
    article = page.select_one("article.listing")
    if article is None:
        article = page.select_one(".listing")
    if article is None or not isinstance(article, Tag):
        raise ListingParseError(f"no .listing element in {page_url}")

    record: dict = {}
    fallback: list[dict] = []

    # -- breadcrumbs ------------------------------------------------------
    crumbs = []
    nav = article.select_one("nav.breadcrumbs")
    if nav is not None:
        for li in nav.select("ol li"):
            a = li.select_one("a[href]")
            crumbs.append(
                {
                    "text": text_of(li),
                    "url": absolute(a["href"]) if a else None,
                    "current": li.has_attr("aria-current"),
                }
            )
    record["breadcrumbs"] = crumbs

    # -- header: identity, logo, byline, actions ---------------------------
    header = article.select_one("header.listing-header")
    if header is not None:
        h1 = header.select_one("h1")
        record["name"] = text_of(h1) if h1 else None
        logo = header.select_one(".listing-logo img[src]")
        record["logo_url"] = absolute(logo["src"]) if logo else None
        byline = header.select_one(".listing-byline")
        record["byline"] = parse_byline(byline) if byline else None
        actions = []
        for a in header.select(".listing-actions a[href]"):
            href = absolute(a["href"])
            host = urlsplit(href).netloc
            actions.append(
                {
                    "text": text_of(a),
                    "url": href,
                    "external": a.get("target") == "_blank" or host not in ("", "githits.com"),
                    "rel": a.get("rel"),
                }
            )
        record["actions"] = actions
    else:
        record["name"] = None
        record["logo_url"] = None
        record["byline"] = None
        record["actions"] = []
        fallback.append(fallback_entry("missing-header", header))

    summary = article.select_one("p.listing-summary")
    record["summary"] = text_of(summary) if summary else None

    # -- sections -----------------------------------------------------------
    sections: dict = {}
    seen_section_ids = []
    for element in article.find_all(recursive=False):
        if not isinstance(element, Tag):
            continue
        if element.name == "section":
            sid = element.get("id") or ""
            seen_section_ids.append(sid)
            if sid == "overview":
                sections["overview"] = parse_overview(element, fallback)
            elif sid == "features":
                sections["features"] = parse_features(element, fallback)
            elif sid == "details":
                sections["details"] = parse_details(element, fallback)
            elif sid == "similar":
                sections["similar"] = parse_similar(element)
            else:
                fallback.append(fallback_entry("unknown-section", element))
        elif element.name in ("nav", "header"):
            continue  # handled above; listing-tabs nav is on-page navigation only
        elif element.name == "p" and "listing-summary" in (element.get("class") or []):
            continue
        else:
            fallback.append(fallback_entry("unexpected-element", element))

    record["sections"] = sections
    record["section_order"] = seen_section_ids
    record["fallback"] = fallback
    return record


def parse_byline(byline: Tag) -> dict:
    category = None
    a = byline.select_one("a[href]")
    if a is not None:
        category = {"text": text_of(a), "url": absolute(a["href"])}
    badges = [text_of(b) for b in byline.select(".listing-badge")]
    return {
        "text": text_of(byline),
        "category": category,
        "badges": [b for b in badges if b],
    }


def parse_overview(section: Tag, fallback: list) -> dict:
    prose = section.select_one(".listing-prose")
    if prose is None:
        return {"paragraphs": []}
    paragraphs = []
    for child in prose.find_all(recursive=False):
        if child.name == "p":
            paragraphs.append(rich_text(child))
        else:
            fallback.append(fallback_entry("unexpected-overview-element", child))
    return {"paragraphs": paragraphs}


def parse_features(section: Tag, fallback: list) -> dict:
    ul = section.select_one("ul.listing-features")
    if ul is None:
        return {"items": []}
    items = []
    for li in ul.find_all("li", recursive=False):
        items.append(rich_text(li))
    return {"items": items}


def parse_details(section: Tag, fallback: list) -> dict:
    dl = section.select_one("dl.listing-details")
    if dl is None:
        return {"entries": []}
    entries = []
    for div in dl.find_all("div", recursive=False):
        dt = div.select_one("dt")
        dd = div.select_one("dd")
        if dt is None or dd is None:
            fallback.append(fallback_entry("malformed-detail-row", div))
            continue
        label = text_of(dt)
        entry = {
            "label": label,
            "text": text_of(dd),
            "links": rich_text(dd)["links"],
        }
        if label not in KNOWN_DETAIL_LABELS:
            entry["unrecognized_label"] = True
        repos = dd.select_one("ul.listing-repositories")
        if repos is not None:
            entry["repositories"] = [parse_repo(li) for li in repos.find_all("li", recursive=False)]
        tags = dd.select_one("ul.listing-tags")
        if tags is not None:
            entry["topics"] = [
                {"text": text_of(a), "url": absolute(a["href"])}
                for a in tags.select("a[href]")
            ]
        time_el = dd.select_one("time")
        if time_el is not None:
            entry["time"] = {
                "text": text_of(time_el),
                "datetime": time_el.get("datetime"),
            }
        entries.append(entry)
    return {"entries": entries}


def parse_repo(li: Tag) -> dict:
    a = li.select_one("a[href]")
    muted = li.select_one(".listing-muted")
    stars = {"stars": None, "stars_approximate": None, "stars_raw": None}
    if muted is not None:
        stars = parse_stars(text_of(muted))
    return {
        "url": absolute(a["href"]) if a else None,
        "text": text_of(a) if a else None,
        **stars,
    }


def parse_similar(section: Tag) -> dict:
    grid = section.select_one("ul.listing-grid")
    cards = []
    if grid is not None:
        for li in grid.select("li.listing-card-item"):
            card = parse_card(li)
            if card is not None:
                cards.append(card)
    more = section.select_one("p.listing-more a[href]")
    return {
        "cards": cards,
        "more_link": {"text": text_of(more), "url": absolute(more["href"])} if more else None,
    }


def fallback_entry(kind: str, element: Tag | None) -> dict:
    """Structured retention of markup this parser does not understand."""
    if element is None:
        return {"type": kind, "text": None, "html": None}
    heading = None
    for level in ("h2", "h3", "h4"):
        h = element.select_one(level)
        if h is not None:
            heading = text_of(h)
            break
    return {
        "type": kind,
        "tag": element.name,
        "id": element.get("id"),
        "classes": element.get("class"),
        "heading": heading,
        "text": text_of(element),
        "html": str(element),
    }
