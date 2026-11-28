/**
 * Pure view-model for the detail drawer: every displayed string is derived
 * here, so the component only renders what these functions decide and the
 * tests pin every judgment call. No React, no DOM.
 *
 * Documented decisions:
 *
 * - License/deployment/stars reuse the matrix model's derivations verbatim
 *   (license: null + oss false → "Proprietary"; stars carry the `~` prefix
 *   when approximate): one product truth, one derivation.
 * - Absence renders as `—` (flagged `absent` so the component dims it) —
 *   never filler, never invention. The one exception is commercial data
 *   the source itself states: "None found" is the entry's literal text,
 *   rendered lowercase as the mock does. When the source omits the
 *   commercial entry entirely (97 of 239 records — verified against the
 *   scraped HTML), the row renders `—`: the source makes no claim, so
 *   neither do we.
 * - OPEN SOURCE is a three-state fact: yes / no / —. The matrix renders
 *   oss as binary YES-or-absence because false and null are visually one
 *   group there; the drawer's labeled fact row can carry the distinction
 *   the data honestly carries (oss === false is explicit data).
 * - The same-class list is the record's real `similar` items in source
 *   order — the source's own similarity ranking, not re-sorted. Every
 *   similar item resolves to a record in this dataset (verified: 956/956),
 *   so the component can select it in the viewer. Star counts come from
 *   the item itself; they never disagree with the full record (verified),
 *   and most are null — rendered as absence, not filler.
 * - The sub-line and footer join their facts with ` · `, dropping absent
 *   parts; when every part is absent the whole line is `—`.
 */

import type { Listing } from './data/types.ts';
import { deploymentLabelOf, formatStars, licenseLabelOf } from './matrix-model.ts';

export const ABSENT = '—';

export interface DrawerFact {
  label: string;
  value: string;
  /** True when the value is the absence glyph, not data — dimmed in render. */
  absent: boolean;
}

export interface CompareItem {
  /** Listing id — the final path segment of the item's githits URL. */
  id: string;
  name: string;
  starsLabel: string | null;
}

function fact(label: string, value: string | null): DrawerFact {
  return value === null
    ? { label, value: ABSENT, absent: true }
    : { label, value, absent: false };
}

function entryText(listing: Listing, label: string): string | null {
  return listing.detail.entries.find((entry) => entry.label === label)?.text ?? null;
}

/** "None found" → "none found" — the mock lowercases this register. */
function lowerInitial(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Sub-line under the name: "★ 777 · MIT · open source", parts dropped when absent. */
export function subLineOf(listing: Listing): string {
  const parts: Array<string> = [];
  if (listing.stars !== null) {
    parts.push(`★ ${formatStars(listing.stars, listing.starsApproximate)}`);
  }
  const license = licenseLabelOf(listing);
  if (license !== null) {
    parts.push(license);
  }
  // oss === false is already expressed: the license derivation renders
  // "Proprietary" exactly then (license and oss === false never co-occur
  // in the data). "open source" is the only part the oss flag adds.
  if (listing.oss === true) {
    parts.push('open source');
  }
  return parts.length === 0 ? ABSENT : parts.join(' · ');
}

/** The nine canon fact rows, in the mock's order. */
export function factsOf(listing: Listing): Array<DrawerFact> {
  const commercial = entryText(listing, 'Commercial offering');
  return [
    fact('CATEGORY', listing.category),
    fact('LICENSE', licenseLabelOf(listing)),
    fact(
      'STARS',
      listing.stars === null ? null : formatStars(listing.stars, listing.starsApproximate),
    ),
    fact('OPEN SOURCE', listing.oss === null ? null : listing.oss ? 'yes' : 'no'),
    fact('TOPICS', listing.topics.length === 0 ? null : listing.topics.join(', ')),
    fact('DEPLOYMENT', deploymentLabelOf(listing)),
    fact('COMMERCIAL', commercial === null ? null : lowerInitial(commercial)),
    fact('LISTED', entryText(listing, 'Listed')),
    fact('VERIFIED', entryText(listing, 'Last verified')),
  ];
}

/** Same-class compare list: the record's real similar items, source order. */
export function compareItemsOf(listing: Listing): Array<CompareItem> {
  return listing.detail.similar.items.map((item) => ({
    id: item.url.replace(/\/+$/, '').split('/').pop() ?? '',
    name: item.name,
    starsLabel:
      item.stars === null ? null : formatStars(item.stars, item.starsApproximate),
  }));
}

/** The product's external URL — the Website details entry's link. */
export function websiteHrefOf(listing: Listing): string | null {
  return (
    listing.detail.entries.find((entry) => entry.label === 'Website')?.links[0]?.href ?? null
  );
}

/** Footer right: license and oss facts — "MIT · OSS" in the mock. */
export function footerRightOf(listing: Listing): string {
  const parts: Array<string> = [];
  const license = licenseLabelOf(listing);
  if (license !== null) {
    parts.push(license);
  }
  if (listing.oss === true) {
    parts.push('OSS');
  }
  return parts.length === 0 ? ABSENT : parts.join(' · ');
}

/** Footer left: the stable catalog number — "ENTRY 004 / 239". */
export function entryLabelOf(entry: number, total: number): string {
  return `ENTRY ${String(entry).padStart(3, '0')} / ${total}`;
}
