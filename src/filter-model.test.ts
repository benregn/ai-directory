import { describe, expect, test } from 'vitest';
import { listings } from './data/listings.ts';
import type { FilterableRow, FilterState } from './filter-model.ts';
import {
  LICENSE_OTHER,
  LICENSE_UNSPECIFIED,
  clearFilter,
  deriveFacets,
  emptyFilters,
  filterRows,
  matchesFilters,
  matchesQuery,
  stripParameters,
} from './filter-model.ts';
import { deriveRows } from './matrix-model.ts';

function row(overrides: Partial<FilterableRow> = {}): FilterableRow {
  return {
    name: 'Alpha',
    summary: 'plain summary',
    category: 'Agent orchestration',
    categorySlug: 'agent-orchestration',
    licenseLabel: 'MIT',
    deployment: ['Cloud'],
    oss: true,
    topics: ['MCP'],
    ...overrides,
  };
}

function filters(overrides: Partial<FilterState> = {}): FilterState {
  return { ...emptyFilters(), ...overrides };
}

describe('query matching', () => {
  test('matches name, summary, topic, and license case-insensitively', () => {
    const base = row({
      name: 'FactoryKit',
      summary: 'Builds agent teams',
      licenseLabel: 'Apache-2.0',
      topics: ['Background agents'],
    });
    expect(matchesQuery(base, 'factorykit')).toBe(true);
    expect(matchesQuery(base, 'AGENT TEAMS')).toBe(true);
    expect(matchesQuery(base, 'background')).toBe(true);
    expect(matchesQuery(base, 'apache-2')).toBe(true);
  });

  test('trims whitespace, rejects absent license, and ANDs with facets', () => {
    const base = row({ licenseLabel: null });
    expect(matchesQuery(base, '  plain  ')).toBe(true);
    expect(matchesQuery(base, 'mit')).toBe(false);
    expect(
      matchesFilters(base, filters({ categories: ['agent-orchestration'], query: 'mit' })),
    ).toBe(false);
  });
});

describe('facet matching', () => {
  test('empty selections impose no constraint, even on sparse rows', () => {
    const sparse = row({ licenseLabel: null, deployment: null, oss: null, topics: [] });
    expect(matchesFilters(sparse, emptyFilters())).toBe(true);
  });

  test('multiple selected values OR within a facet', () => {
    const alpha = row({ categorySlug: 'alpha' });
    const beta = row({ categorySlug: 'beta' });
    const gamma = row({ categorySlug: 'gamma' });
    const selected = filters({ categories: ['alpha', 'beta'] });
    expect(matchesFilters(alpha, selected)).toBe(true);
    expect(matchesFilters(beta, selected)).toBe(true);
    expect(matchesFilters(gamma, selected)).toBe(false);
  });

  test('separate facets AND together', () => {
    const base = row({ categorySlug: 'alpha', licenseLabel: 'MIT' });
    const selected = filters({ categories: ['alpha'], licenses: ['Apache-2.0'] });
    expect(matchesFilters(base, selected)).toBe(false);
  });

  test('license matches primary labels, grouped other licenses, and Unspecified', () => {
    const selected = filters({ licenses: ['Proprietary', LICENSE_OTHER, LICENSE_UNSPECIFIED] });
    expect(matchesFilters(row({ licenseLabel: 'Proprietary' }), selected)).toBe(true);
    expect(matchesFilters(row({ licenseLabel: 'FSL-1.1' }), selected)).toBe(true);
    expect(matchesFilters(row({ licenseLabel: null }), selected)).toBe(true);
    expect(matchesFilters(row({ licenseLabel: 'MIT' }), selected)).toBe(false);
  });

  test('deployment matches when any selected token overlaps a multi-token row', () => {
    const base = row({ deployment: ['Local', 'Self-hosted'] });
    expect(matchesFilters(base, filters({ deployments: ['Cloud', 'Self-hosted'] }))).toBe(true);
    expect(matchesFilters(base, filters({ deployments: ['Cloud'] }))).toBe(false);
    expect(matchesFilters(row({ deployment: null }), filters({ deployments: ['Local'] }))).toBe(false);
    expect(matchesFilters(row({ deployment: [] }), filters({ deployments: ['Local'] }))).toBe(false);
  });

  test('topics OR by exact topic value, not substring', () => {
    const base = row({ topics: ['MCP'] });
    expect(matchesFilters(base, filters({ topics: ['CLI', 'MCP'] }))).toBe(true);
    expect(matchesFilters(base, filters({ topics: ['MC'] }))).toBe(false);
    expect(matchesFilters(row({ topics: [] }), filters({ topics: ['MCP'] }))).toBe(false);
  });

  test('open-source only requires an explicit true', () => {
    const selected = filters({ openSourceOnly: true });
    expect(matchesFilters(row({ oss: true }), selected)).toBe(true);
    expect(matchesFilters(row({ oss: false }), selected)).toBe(false);
    expect(matchesFilters(row({ oss: null }), selected)).toBe(false);
  });
});

describe('facet derivation from the real catalog', () => {
  const rows = deriveRows(listings);
  const facets = deriveFacets(rows);

  test('category counts are unfiltered catalog totals in scan order', () => {
    expect(facets.categories.map((option) => [option.label, option.count])).toEqual([
      ['Agent orchestration', 74],
      ['App builders', 65],
      ['Engineering factories', 56],
      ['Agent infrastructure', 19],
      ['Code review & quality', 10],
      ['Agent workspaces', 9],
      ['AI labs & coding models', 4],
      ['Development platforms', 2],
    ]);
  });

  test('license options use primary labels, grouped other licenses, and Unspecified', () => {
    expect(facets.licenses.map((option) => [option.value, option.count])).toEqual([
      ['MIT', 46],
      ['Apache-2.0', 27],
      ['AGPL-3.0', 5],
      ['Proprietary', 111],
      [LICENSE_OTHER, 7],
      [LICENSE_UNSPECIFIED, 43],
    ]);
  });

  test('deployment options stay in the mock order with real overlap counts', () => {
    expect(facets.deployments.map((option) => [option.value, option.count])).toEqual([
      ['Cloud', 72],
      ['Self-hosted', 46],
      ['Local', 32],
    ]);
  });

  test('topics derive from the catalog with the mock’s four scan entries first', () => {
    expect(facets.topics).toHaveLength(24);
    expect(facets.topics.slice(0, 4).map((option) => option.value)).toEqual([
      'MCP',
      'CLI',
      'Enterprise',
      'Background agents',
    ]);
    expect(facets.topics.find((option) => option.value === 'MCP')?.count).toBe(77);
  });

  test('filtering preserves stable catalog entry identities', () => {
    const filtered = filterRows(rows, filters({ categories: ['development-platforms'] }));
    expect(filtered.length).toBe(2);
    const catalogEntry = new Map(rows.map((catalogRow) => [catalogRow.id, catalogRow.entry]));
    for (const filteredRow of filtered) {
      expect(filteredRow.entry).toBe(catalogEntry.get(filteredRow.id));
    }
    expect(filtered.map((filteredRow) => filteredRow.entry)).not.toEqual([1, 2]);
  });
});

describe('parameter strip model', () => {
  test('active values mirror state in order; the unconstrained strip is explicit any', () => {
    const facets = deriveFacets(deriveRows(listings));
    const state = filters({
      categories: ['agent-orchestration', 'app-builders'],
      licenses: ['MIT'],
      deployments: ['Cloud', 'Local'],
      openSourceOnly: true,
      topics: ['MCP'],
      query: ' agent ',
    });
    expect(stripParameters(state, facets.categories)).toEqual([
      {
        key: 'categories',
        label: 'Category',
        value: 'Agent orchestration, App builders',
        active: true,
      },
      { key: 'licenses', label: 'License', value: 'MIT', active: true },
      { key: 'deployments', label: 'Deployment', value: 'Cloud, Local', active: true },
      { key: 'openSourceOnly', label: 'Open source', value: 'yes', active: true },
      { key: 'topics', label: 'Topics', value: 'MCP', active: true },
      { key: 'query', label: 'Search', value: 'agent', active: true },
    ]);

    expect(stripParameters(filters({ licenses: ['MIT'] }), facets.categories)).toEqual([
      { key: 'licenses', label: 'License', value: 'MIT', active: true },
    ]);

    expect(stripParameters(emptyFilters(), facets.categories).map((param) => param.value)).toEqual([
      'any',
      'any',
      'any',
      'any',
      'any',
      'any',
    ]);
  });

  test('clearFilter clears exactly one parameter', () => {
    const state = filters({ categories: ['agent-orchestration'], topics: ['MCP'], query: 'x' });
    expect(clearFilter(state, 'categories')).toEqual({
      ...state,
      categories: [],
    });
    expect(clearFilter(state, 'query').query).toBe('');
    expect(clearFilter(state, 'topics').categories).toEqual(['agent-orchestration']);
  });

});
