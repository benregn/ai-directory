import { describe, expect, test } from 'vitest';
import { listings } from './data/listings.ts';
import type { Listing } from './data/types.ts';
import {
  ABSENT,
  compareItemsOf,
  entryLabelOf,
  factsOf,
  footerRightOf,
  subLineOf,
  websiteHrefOf,
} from './drawer-model.ts';

function byId(id: string): Listing {
  const listing = listings.find((candidate) => candidate.id === id);
  if (!listing) {
    throw new Error(`no listing: ${id}`);
  }
  return listing;
}

function factValue(listing: Listing, label: string) {
  const fact = factsOf(listing).find((candidate) => candidate.label === label);
  if (!fact) {
    throw new Error(`no fact row: ${label}`);
  }
  return { value: fact.value, absent: fact.absent };
}

// aeon: rich open-source record — license, exact stars, topics, repository.
// alfred: rich record with deployment tokens and "None found" commercial.
// 8090: sparse proprietary — null license/stars/deployment, oss false.
// atlantic: sparsest — license/oss/stars all null, paid commercial entry.
// fabrika-berkaycubuk: one of the three records with no topics.

describe('sub-line derivation', () => {
  test('rich record joins stars, license and open source', () => {
    expect(subLineOf(byId('aeon'))).toBe('★ 777 · MIT · open source');
  });

  test('approximate stars carry the tilde prefix', () => {
    expect(subLineOf(byId('opencode'))).toContain('★ ~217,100');
  });

  test('sparse proprietary renders only the derived license', () => {
    expect(subLineOf(byId('8090'))).toBe('Proprietary');
  });

  test('open-source record without license or stars still says open source', () => {
    expect(subLineOf(byId('ai-ready-nx-workspace'))).toBe('open source');
  });

  test('record with every part absent renders the absence glyph', () => {
    expect(subLineOf(byId('atlantic'))).toBe(ABSENT);
  });
});

describe('fact rows', () => {
  test('the nine canon rows render in the mock order', () => {
    expect(factsOf(byId('aeon')).map((fact) => fact.label)).toEqual([
      'CATEGORY',
      'LICENSE',
      'STARS',
      'OPEN SOURCE',
      'TOPICS',
      'DEPLOYMENT',
      'COMMERCIAL',
      'LISTED',
      'VERIFIED',
    ]);
  });

  test('rich record carries real values, none absent', () => {
    const aeon = byId('aeon');
    expect(factValue(aeon, 'CATEGORY')).toEqual({ value: 'Agent orchestration', absent: false });
    expect(factValue(aeon, 'LICENSE')).toEqual({ value: 'MIT', absent: false });
    expect(factValue(aeon, 'STARS')).toEqual({ value: '777', absent: false });
    expect(factValue(aeon, 'OPEN SOURCE')).toEqual({ value: 'yes', absent: false });
    expect(factValue(aeon, 'TOPICS')).toEqual({ value: 'Background agents, MCP', absent: false });
    expect(factValue(aeon, 'LISTED')).toEqual({ value: 'October 2026', absent: false });
    expect(factValue(aeon, 'VERIFIED')).toEqual({ value: 'October 2026', absent: false });
  });

  test('sparse proprietary record: license derives, valued facts are absent', () => {
    const sparse = byId('8090');
    expect(factValue(sparse, 'LICENSE')).toEqual({ value: 'Proprietary', absent: false });
    expect(factValue(sparse, 'STARS')).toEqual({ value: ABSENT, absent: true });
    expect(factValue(sparse, 'DEPLOYMENT')).toEqual({ value: ABSENT, absent: true });
    expect(factValue(sparse, 'OPEN SOURCE')).toEqual({ value: 'no', absent: false });
  });

  test('oss null renders open source as absence, not no', () => {
    expect(factValue(byId('atlantic'), 'OPEN SOURCE')).toEqual({ value: ABSENT, absent: true });
  });

  test('commercial entry text renders lowercased, as the mock does', () => {
    expect(factValue(byId('alfred'), 'COMMERCIAL')).toEqual({
      value: 'none found',
      absent: false,
    });
    expect(factValue(byId('atlantic'), 'COMMERCIAL')).toEqual({
      value: 'yes, paid offering available',
      absent: false,
    });
  });

  test('missing commercial entry is absence, never an invented claim', () => {
    expect(factValue(byId('8090'), 'COMMERCIAL')).toEqual({ value: ABSENT, absent: true });
  });

  test('deployment joins the tokens the matrix derives', () => {
    expect(factValue(byId('alfred'), 'DEPLOYMENT')).toEqual({ value: 'Local', absent: false });
  });

  test('untagged record renders topics as absence', () => {
    expect(factValue(byId('fabrika-berkaycubuk'), 'TOPICS')).toEqual({
      value: ABSENT,
      absent: true,
    });
  });

  test('approximate stars carry the tilde in the fact row too', () => {
    expect(factValue(byId('opencode'), 'STARS')).toEqual({ value: '~217,100', absent: false });
  });
});

describe('same-class compare list', () => {
  test('carries the real similar items in source order with dataset ids', () => {
    expect(compareItemsOf(byId('aeon'))).toEqual([
      { id: 'ai-ready-nx-workspace', name: 'AI-Ready Nx Workspace', starsLabel: null },
      { id: 'alfred', name: 'Alfred', starsLabel: '4' },
      { id: 'beadhive', name: 'Beadhive', starsLabel: '9' },
      { id: 'cyrus', name: 'Cyrus', starsLabel: '857' },
    ]);
  });

  test('every similar item of every record resolves to a dataset record', () => {
    const ids = new Set(listings.map((listing) => listing.id));
    for (const listing of listings) {
      for (const item of compareItemsOf(listing)) {
        expect(ids.has(item.id)).toBe(true);
      }
    }
  });

  test('no item id is empty and items are always four per record', () => {
    for (const listing of listings) {
      const items = compareItemsOf(listing);
      expect(items).toHaveLength(4);
      for (const item of items) {
        expect(item.id.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('footer derivations', () => {
  test('entry label pads the catalog number', () => {
    expect(entryLabelOf(4, 239)).toBe('ENTRY 004 / 239');
    expect(entryLabelOf(239, 239)).toBe('ENTRY 239 / 239');
  });

  test('rich record footer joins license and OSS', () => {
    expect(footerRightOf(byId('aeon'))).toBe('MIT · OSS');
  });

  test('proprietary footer is the derived license alone', () => {
    expect(footerRightOf(byId('8090'))).toBe('Proprietary');
  });

  test('fully absent footer renders the absence glyph', () => {
    expect(footerRightOf(byId('atlantic'))).toBe(ABSENT);
  });
});

describe('open listing target', () => {
  test('is the website entry link, the product external URL', () => {
    expect(websiteHrefOf(byId('aeon'))).toBe('https://www.aeon.fun/');
  });

  test('every record carries one', () => {
    for (const listing of listings) {
      expect(websiteHrefOf(listing)).toMatch(/^https?:\/\//);
    }
  });
});
