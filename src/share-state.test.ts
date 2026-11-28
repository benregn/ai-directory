import { beforeEach, describe, expect, test } from 'vitest';
import { listings } from './data/listings.ts';
import { deriveFacets, emptyFilters } from './filter-model.ts';
import { deriveRows } from './matrix-model.ts';
import type { ValidCatalog, ViewerState } from './share-state.ts';
import {
  loadStoredState,
  parseViewerState,
  resolveInitialState,
  serializeViewerState,
  shortlistMarkdown,
  STORAGE_KEY,
  storeViewerState,
} from './share-state.ts';

const rows = deriveRows(listings);
const facets = deriveFacets(rows);

const valid: ValidCatalog = {
  ids: new Set(listings.map((listing) => listing.id)),
  categories: new Set(facets.categories.map((option) => option.value)),
  licenses: new Set(facets.licenses.map((option) => option.value)),
  deployments: new Set(facets.deployments.map((option) => option.value)),
  topics: new Set(facets.topics.map((option) => option.value)),
};

function state(partial: Partial<ViewerState> = {}): ViewerState {
  return {
    filters: emptyFilters(),
    selectedId: null,
    shortlist: [],
    hiddenShortlisted: false,
    ...partial,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('URL serialization round-trip', () => {
  test('empty state serializes to the empty string, which parses back as absent', () => {
    expect(serializeViewerState(state())).toBe('');
    expect(parseViewerState('', valid)).toBeNull();
    expect(parseViewerState('?', valid)).toBeNull();
  });

  test('a fully populated state round-trips exactly', () => {
    const original = state({
      filters: {
        categories: ['agent-orchestration', 'app-builders'],
        licenses: ['MIT', 'Other licenses'],
        deployments: ['Cloud', 'Self-hosted'],
        openSourceOnly: true,
        topics: ['Background agents', 'MCP', 'Governance & audit'],
        query: 'vector search ',
      },
      selectedId: 'aeon',
      shortlist: ['aeon', '8090', 'opencode'],
      hiddenShortlisted: true,
    });
    const serialized = serializeViewerState(original);
    const parsed = parseViewerState(`?${serialized}`, valid);
    expect(parsed).toEqual(original);
  });

  test('the URL stays readable: commas literal, values encoded only as needed', () => {
    const serialized = serializeViewerState(
      state({
        filters: {
          ...emptyFilters(),
          categories: ['agent-orchestration', 'app-builders'],
          topics: ['Background agents'],
        },
        selectedId: 'aeon',
        shortlist: ['aeon'],
        hiddenShortlisted: true,
      }),
    );
    expect(serialized).toContain('cat=agent-orchestration,app-builders');
    expect(serialized).toContain('topics=Background%20agents');
    expect(serialized).toContain('sel=aeon');
    expect(serialized).toContain('sl=aeon');
    expect(serialized).toContain('hide=1');
  });

  test('click order is preserved both ways — the strip renders arrays in that order', () => {
    const original = state({
      filters: { ...emptyFilters(), categories: ['app-builders', 'agent-orchestration'] },
      shortlist: ['opencode', 'aeon', '8090'],
    });
    const serialized = serializeViewerState(original);
    expect(serialized).toContain('cat=app-builders,agent-orchestration');
    expect(serialized).toContain('sl=opencode,aeon,8090');
    expect(parseViewerState(`?${serialized}`, valid)).toEqual(original);
  });

  test('values needing encoding round-trip exactly: spaces, ampersands, unicode', () => {
    const original = state({
      filters: { ...emptyFilters(), topics: ['Governance & audit'], query: 'a & b = c?' },
    });
    expect(parseViewerState(`?${serializeViewerState(original)}`, valid)).toEqual(original);
  });

  test('partial states round-trip: only selection, only shortlist, only query', () => {
    for (const partial of [
      state({ selectedId: 'aeon' }),
      state({ shortlist: ['aeon'] }),
      state({ filters: { ...emptyFilters(), query: 'mcp' } }),
      state({ hiddenShortlisted: true }),
    ]) {
      expect(parseViewerState(`?${serializeViewerState(partial)}`, valid)).toEqual(partial);
    }
  });
});

describe('garbage tolerance', () => {
  test('unknown params are ignored; no recognized key means absent', () => {
    expect(parseViewerState('?utm_source=x&page=3', valid)).toBeNull();
    expect(parseViewerState('?utm_source=x&cat=agent-orchestration', valid)).not.toBeNull();
  });

  test('unknown and garbage values drop individually, never crash', () => {
    const parsed = parseViewerState(
      '?cat=no-such-category,agent-orchestration&lic=bogus&topics=MCP,nope&sl=ghost,aeon,%E0%A4%A&sel=ghost',
      valid,
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.filters.categories).toEqual(['agent-orchestration']);
    expect(parsed?.filters.licenses).toEqual([]);
    expect(parsed?.filters.topics).toEqual(['MCP']);
    expect(parsed?.shortlist).toEqual(['aeon']);
    expect(parsed?.selectedId).toBeNull();
  });

  test('malformed percent-encoding never throws', () => {
    expect(() => parseViewerState('?q=%E0%A4%A&cat=%zz', valid)).not.toThrow();
    expect(parseViewerState('?q=%E0%A4%A', valid)?.filters.query).toBe('');
  });

  test('empty tokens and duplicates collapse', () => {
    const parsed = parseViewerState('?cat=,,agent-orchestration,,agent-orchestration,', valid);
    expect(parsed?.filters.categories).toEqual(['agent-orchestration']);
  });

  test('repeated params accumulate rather than crash', () => {
    const parsed = parseViewerState('?cat=agent-orchestration&cat=app-builders', valid);
    expect(parsed?.filters.categories).toEqual(['agent-orchestration', 'app-builders']);
  });

  test('oss and hide are true only for the literal 1', () => {
    expect(parseViewerState('?oss=1&hide=1', valid)?.filters.openSourceOnly).toBe(true);
    expect(parseViewerState('?oss=true', valid)?.filters.openSourceOnly).toBe(false);
    expect(parseViewerState('?hide=yes', valid)?.hiddenShortlisted).toBe(false);
    expect(parseViewerState('?oss=', valid)?.filters.openSourceOnly).toBe(false);
  });

  test('a recognized key with only garbage values still counts as a shared URL', () => {
    expect(parseViewerState('?cat=bogus', valid)).not.toBeNull();
    expect(parseViewerState('?cat=', valid)).not.toBeNull();
  });
});

describe('storage and precedence', () => {
  test('stored state round-trips through localStorage', () => {
    const original = state({
      filters: { ...emptyFilters(), categories: ['ai-labs'], query: 'x' },
      selectedId: 'aeon',
      shortlist: ['aeon'],
      hiddenShortlisted: true,
    });
    storeViewerState(localStorage, original);
    expect(loadStoredState(localStorage, valid)).toEqual(original);
  });

  test('corrupt and wrong-shaped entries read as absent, never crash', () => {
    localStorage.setItem(STORAGE_KEY, '{{{not the format');
    expect(loadStoredState(localStorage, valid)).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ filters: { categories: ['MIT'] } }));
    // a wrong-shaped blob carries no recognized keys: absent, not a crash
    expect(loadStoredState(localStorage, valid)).toBeNull();
    localStorage.setItem(STORAGE_KEY, '');
    expect(loadStoredState(localStorage, valid)).toBeNull();
  });

  test('a blob with recognized keys degrades gracefully rather than reading as absent', () => {
    // half-corrupt data keeps its valid fragments: the garbage tolerance is
    // the URL path's own, by design — see the module doc
    localStorage.setItem(STORAGE_KEY, 'lic=MIT&cat=bogus');
    const loaded = loadStoredState(localStorage, valid);
    expect(loaded?.filters.licenses).toEqual(['MIT']);
    expect(loaded?.filters.categories).toEqual([]);
  });

  test('stored values are validated against the catalog like URL values', () => {
    storeViewerState(
      localStorage,
      state({
        filters: { ...emptyFilters(), categories: ['ancient-category', 'ai-labs'] },
        shortlist: ['ghost', 'aeon'],
      }),
    );
    const loaded = loadStoredState(localStorage, valid);
    expect(loaded?.filters.categories).toEqual(['ai-labs']);
    expect(loaded?.shortlist).toEqual(['aeon']);
  });

  test('precedence: URL wins over storage completely, storage fills a clean URL', () => {
    storeViewerState(
      localStorage,
      state({
        filters: { ...emptyFilters(), categories: ['ai-labs'] },
        selectedId: 'opencode',
        shortlist: ['opencode'],
      }),
    );

    const fromUrl = resolveInitialState('?cat=app-builders&sel=aeon', localStorage, valid);
    expect(fromUrl.filters.categories).toEqual(['app-builders']);
    expect(fromUrl.selectedId).toBe('aeon');
    // no merging: the stored shortlist does not leak into the shared state
    expect(fromUrl.shortlist).toEqual([]);

    const fromStorage = resolveInitialState('', localStorage, valid);
    expect(fromStorage.filters.categories).toEqual(['ai-labs']);
    expect(fromStorage.shortlist).toEqual(['opencode']);

    localStorage.clear();
    expect(resolveInitialState('', localStorage, valid)).toEqual(state());
  });
});

describe('markdown export', () => {
  test('entries carry name, one-liner, stars and link in scan order', () => {
    const markdown = shortlistMarkdown(listings, new Set(['opencode', 'aeon', '8090']));
    const lines = markdown.split('\n');
    expect(lines).toHaveLength(3);
    // opencode is the catalog's most-starred record: scan order leads with it
    expect(lines[0]).toMatch(/^- \[opencode\]\(/);
    const aeon = listings.find((listing) => listing.id === 'aeon');
    const line = lines.find((l) => l.includes('[Aeon]'));
    expect(line).toBe(
      `- [Aeon](https://www.aeon.fun/) — ${aeon?.summary ?? ''} — ★ ${aeon?.stars?.toLocaleString('en-US') ?? ''}`,
    );
  });

  test('approximate stars carry the tilde, absent stars omit the segment entirely', () => {
    const approximate = listings.find((listing) => listing.starsApproximate === true);
    const starless = listings.find((listing) => listing.stars === null);
    if (!approximate || !starless) {
      throw new Error('dataset shape changed');
    }
    const markdown = shortlistMarkdown(listings, new Set([approximate.id, starless.id]));
    const approxLine = markdown.split('\n').find((line) => line.includes(`[${approximate.name}]`));
    expect(approxLine).toContain('★ ~');
    const starlessLine = markdown.split('\n').find((line) => line.includes(`[${starless.name}]`));
    expect(starlessLine).not.toContain('★');
    expect(starlessLine).toMatch(/^- \[.+\]\(https?:\/\/\S+\) — .+$/);
  });

  test('starred entries sort before starless, ties keep catalog order', () => {
    const starless = listings.filter((listing) => listing.stars === null).slice(0, 1);
    const starred = listings.filter((listing) => listing.stars !== null).slice(0, 3);
    const ids = new Set([...starless, ...starred].map((listing) => listing.id));
    const lines = shortlistMarkdown(listings, ids).split('\n');
    expect(lines).toHaveLength(ids.size);
    // every starred entry precedes the starless one
    const starlessIndex = lines.findIndex((line) => line.includes(`[${starless[0]?.name}]`));
    expect(starlessIndex).toBe(lines.length - 1);
  });

  test('empty shortlist exports empty text', () => {
    expect(shortlistMarkdown(listings, new Set())).toBe('');
  });
});
