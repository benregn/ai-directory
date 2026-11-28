/**
 * Share state: serialization, persistence and export for issue #6. Pure —
 * no React, no DOM beyond the storage/clipboard boundaries — so the tests
 * pin every judgment call. The viewer state carried across URLs and visits:
 *
 *   filters + selection + shortlist + the hide-shortlisted view mode
 *
 * Documented decisions:
 *
 * URL FORMAT — readable as the data allows. Multi-value params join
 * encoded values with a literal comma: `cat=agent-orchestration,app-builders`
 * — commas never appear in any catalog value (verified), and splitting
 * before decoding keeps even an encoded comma correct. Params with empty
 * values are omitted entirely, so the unconstrained catalog is a clean URL.
 * Array values keep their order both ways — never canonicalized. What the
 * order is worth: ui-sdk's CheckboxGroup emits rail/DOM order regardless
 * of click order, so filter arrays are rail-ordered in every user-built
 * state anyway; but the shortlist genuinely carries click order (Set
 * insertion), and a hand-ordered shared URL restores its exact value
 * order — visibly, in the strip — so dropping it would break the
 * round-trip exactness the issue contracts for. `q` is free text and
 * round-trips exactly — no trimming, no length cap: exactness outranks
 * pathological-input economy, and browsers cap URL length long before it
 * matters here.
 *
 * GARBAGE TOLERANCE — parsing never throws. Unknown keys are ignored;
 * malformed percent-encoding, empty tokens and duplicates drop individually;
 * values are validated against the catalog (unknown ids, categories,
 * licenses, deployments and topics are garbage and drop). `oss`/`hide` are
 * true only for the literal `1` the serializer writes. The selection drops
 * to null when its id is unknown; the shortlist drops ids individually.
 *
 * PRECEDENCE — a URL carrying at least one recognized key is a shared
 * state and wins over localStorage completely: merging would make shared
 * links nondeterministic. With no recognized key in the URL, stored state
 * restores. localStorage is a write-through mirror of the live state —
 * every change writes both — so a shared URL visit also refreshes what a
 * later clean visit restores. Selection serializes whenever one exists,
 * including the auto-selected first row: it is the viewer's honest state,
 * and uniform write-through beats a dirty flag nobody can see.
 *
 * STORAGE SHAPE — the stored value is the URL's own serialization under
 * the versioned key `factory-index:view:v1`: lossless, so one parser and
 * one validator serve both transports. A corrupt blob hits the URL path's
 * garbage tolerance — wrong-shaped data carries no recognized keys and
 * reads as absent; ancient data lives under another version's key and
 * never matches. Nothing in the path can throw.
 *
 * EXPORT — the markdown shortlist is paste-ready: one line per entry,
 * name linked to the product's own website (the githits source URL as the
 * honest fallback — every current record carries a website entry, verified
 * against the dataset), then the record's real summary, then stars exactly
 * as the matrix renders them (`~` for approximations, omitted entirely when
 * absent). Ordering is the matrix's DEFAULT scan ordering: stars
 * descending, absent last, catalog order breaking ties. Sort order is
 * matrix-internal state the URL never carries, so a re-sorted matrix does
 * not change the export — the ordering is deterministic, not
 * scan-following.
 */

import type { Deployment, Listing } from './data/types.ts';
import { websiteHrefOf } from './drawer-model.ts';
import type { FilterState } from './filter-model.ts';
import { emptyFilters } from './filter-model.ts';
import { formatStars } from './matrix-model.ts';

export interface ViewerState {
  filters: FilterState;
  selectedId: string | null;
  /** Shortlisted listing ids — a set; serialized in click order, deduped. */
  shortlist: Array<string>;
  hiddenShortlisted: boolean;
}

/** Closed vocabularies a shared or stored state may legitimately name. */
export interface ValidCatalog {
  ids: Set<string>;
  categories: Set<string>;
  licenses: Set<string>;
  deployments: Set<string>;
  topics: Set<string>;
}

export const STORAGE_KEY = 'factory-index:view:v1';

const MULTI_KEYS = ['cat', 'lic', 'dep', 'topics', 'sl'] as const;
const KNOWN_KEYS = new Set([...MULTI_KEYS, 'oss', 'q', 'sel', 'hide']);

function encodeValues(values: Array<string>): string {
  return values.map((value) => encodeURIComponent(value)).join(',');
}

function unique(values: Iterable<string>): Array<string> {
  return [...new Set(values)];
}

/** Canonical query string for the state — no leading `?`, empty when default-ish. */
export function serializeViewerState(state: ViewerState): string {
  const parts: Array<string> = [];
  const { filters } = state;
  if (filters.categories.length > 0) {
    parts.push(`cat=${encodeValues(unique(filters.categories))}`);
  }
  if (filters.licenses.length > 0) {
    parts.push(`lic=${encodeValues(unique(filters.licenses))}`);
  }
  if (filters.deployments.length > 0) {
    parts.push(`dep=${encodeValues(unique(filters.deployments))}`);
  }
  if (filters.openSourceOnly) {
    parts.push('oss=1');
  }
  if (filters.topics.length > 0) {
    parts.push(`topics=${encodeValues(unique(filters.topics))}`);
  }
  if (filters.query.length > 0) {
    parts.push(`q=${encodeURIComponent(filters.query)}`);
  }
  if (state.selectedId !== null) {
    parts.push(`sel=${encodeURIComponent(state.selectedId)}`);
  }
  if (state.shortlist.length > 0) {
    parts.push(`sl=${encodeValues(unique(state.shortlist))}`);
  }
  if (state.hiddenShortlisted) {
    parts.push('hide=1');
  }
  return parts.join('&');
}

function decodeToken(token: string): string | null {
  try {
    return decodeURIComponent(token);
  } catch {
    return null;
  }
}

function parseMulti(raw: string): Array<string> {
  const values: Array<string> = [];
  for (const token of raw.split(',')) {
    if (token === '') {
      continue;
    }
    const decoded = decodeToken(token);
    if (decoded !== null && decoded !== '' && !values.includes(decoded)) {
      values.push(decoded);
    }
  }
  return values;
}

function keepValid<Value extends string>(values: Array<Value>, valid: Set<string>): Array<Value> {
  return values.filter((value) => valid.has(value));
}

/**
 * Parse a search string into viewer state, or null when it carries no
 * recognized key at all — null is what lets the caller fall back to stored
 * state. Every value is garbage-tolerant and validated against the catalog.
 */
export function parseViewerState(search: string, valid: ValidCatalog): ViewerState | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (query === '') {
    return null;
  }
  const multi = new Map<string, Array<string>>();
  const scalars = new Map<string, string>();
  let recognized = false;
  for (const pair of query.split('&')) {
    if (pair === '') {
      continue;
    }
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    if (!KNOWN_KEYS.has(key)) {
      continue;
    }
    recognized = true;
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    if ((MULTI_KEYS as ReadonlyArray<string>).includes(key)) {
      multi.set(key, [...(multi.get(key) ?? []), ...parseMulti(rawValue)]);
    } else {
      scalars.set(key, decodeToken(rawValue) ?? '');
    }
  }
  if (!recognized) {
    return null;
  }
  const selRaw = scalars.get('sel');
  const selectedId = selRaw !== undefined && valid.ids.has(selRaw) ? selRaw : null;
  return {
    filters: {
      categories: keepValid(multi.get('cat') ?? [], valid.categories),
      licenses: keepValid(multi.get('lic') ?? [], valid.licenses),
      // The validation set carries only the three deployment tokens (built
      // from the typed facets), so the type-guarded membership check is the
      // honest narrow, not a cast.
      deployments: (multi.get('dep') ?? []).filter((value): value is Deployment =>
        valid.deployments.has(value),
      ),
      openSourceOnly: scalars.get('oss') === '1',
      topics: keepValid(multi.get('topics') ?? [], valid.topics),
      query: scalars.get('q') ?? '',
    },
    selectedId,
    shortlist: keepValid(multi.get('sl') ?? [], valid.ids),
    hiddenShortlisted: scalars.get('hide') === '1',
  };
}

/**
 * The storage format is the URL's own serialization: it is lossless (the
 * round-trip is exact), so one parser and one validator serve both
 * transports and a corrupt blob hits the same garbage tolerance a garbage
 * URL does — wrong-shaped data simply has no recognized keys and reads as
 * absent. The versioned key is the migration mechanism.
 */
export function loadStoredState(storage: Storage, valid: ValidCatalog): ViewerState | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null || raw === '') {
      return null;
    }
    return parseViewerState(raw, valid);
  } catch {
    return null;
  }
}

export function storeViewerState(storage: Storage, state: ViewerState): void {
  try {
    storage.setItem(STORAGE_KEY, serializeViewerState(state));
  } catch {
    // Quota or privacy-mode failure: persistence is a convenience, never a crash.
  }
}

export function defaultViewerState(): ViewerState {
  return {
    filters: emptyFilters(),
    selectedId: null,
    shortlist: [],
    hiddenShortlisted: false,
  };
}

/**
 * Initial-state resolution, the documented precedence: a URL with at least
 * one recognized key wins completely; otherwise stored state; otherwise
 * defaults.
 */
export function resolveInitialState(
  search: string,
  storage: Storage,
  valid: ValidCatalog,
): ViewerState {
  return parseViewerState(search, valid) ?? loadStoredState(storage, valid) ?? defaultViewerState();
}

function markdownEscape(text: string): string {
  return text.replaceAll('[', String.raw`\[`).replaceAll(']', String.raw`\]`);
}

function entryLinkOf(listing: Listing): string {
  // one lookup for the whole app — drawer-model owns it; the githits
  // source is this export's documented fallback, dead on current data
  return websiteHrefOf(listing) ?? listing.detail.sourceUrl;
}

/** Paste-ready markdown for the shortlist — see the module doc for the format. */
export function shortlistMarkdown(listings: Array<Listing>, shortlist: ReadonlySet<string>): string {
  const entries = listings
    .filter((listing) => shortlist.has(listing.id))
    .sort((a, b) => {
      if (a.stars === null && b.stars === null) {
        return 0;
      }
      if (a.stars === null) {
        return 1;
      }
      if (b.stars === null) {
        return -1;
      }
      return b.stars - a.stars;
    });
  return entries
    .map((listing) => {
      const segments = [`[${markdownEscape(listing.name)}](${entryLinkOf(listing)})`];
      if (listing.summary !== '') {
        segments.push(listing.summary);
      }
      if (listing.stars !== null) {
        segments.push(`★ ${formatStars(listing.stars, listing.starsApproximate)}`);
      }
      return `- ${segments.join(' — ')}`;
    })
    .join('\n');
}
