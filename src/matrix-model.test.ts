import { describe, expect, test } from 'vitest';
import type { MatrixRow } from './data/types.ts';
import { listings } from './data/listings.ts';
import type { MatrixRowView } from './matrix-model.ts';
import {
  compareRows,
  deriveRows,
  deploymentLabelOf,
  formatStars,
  initialDirection,
  licenseLabelOf,
  sortRows,
} from './matrix-model.ts';

function listing(overrides: Partial<MatrixRow>): MatrixRow {
  return {
    id: 'x',
    name: 'X',
    summary: 's',
    category: 'Agent orchestration',
    categorySlug: 'agent-orchestration',
    license: null,
    deployment: null,
    oss: null,
    stars: null,
    starsApproximate: null,
    topics: [],
    ...overrides,
  };
}

function row(overrides: Partial<MatrixRowView>): MatrixRowView {
  return {
    id: 'x',
    entry: 1,
    entryLabel: '001',
    name: 'X',
    initial: 'X',
    summary: 's',
    category: 'Agent orchestration',
    licenseLabel: null,
    deploymentLabel: null,
    ossYes: false,
    stars: null,
    starsLabel: null,
    ...overrides,
  };
}

describe('license derivation', () => {
  test('renders the SPDX id when present', () => {
    expect(licenseLabelOf(listing({ license: 'MIT', oss: true }))).toBe('MIT');
  });

  test('derives Proprietary from oss === false when license is null', () => {
    expect(licenseLabelOf(listing({ license: null, oss: false }))).toBe('Proprietary');
  });

  test('is absent for open-source or unspecified records without a license', () => {
    expect(licenseLabelOf(listing({ license: null, oss: true }))).toBeNull();
    expect(licenseLabelOf(listing({ license: null, oss: null }))).toBeNull();
  });

  test('every proprietary record in the real dataset derives Proprietary', () => {
    for (const l of listings) {
      if (l.oss === false) {
        expect(licenseLabelOf(l)).toBe('Proprietary');
      }
    }
  });
});

describe('stars formatting', () => {
  test('comma-groups thousands in the mock register', () => {
    expect(formatStars(70_500, false)).toBe('70,500');
    expect(formatStars(217_100, true)).toBe('~217,100');
  });

  test('exact values carry no tilde, approximate values do', () => {
    expect(formatStars(861, false)).toBe('861');
    expect(formatStars(1300, true)).toBe('~1,300');
  });
});

describe('deployment derivation', () => {
  test('joins tokens in source order', () => {
    expect(
      deploymentLabelOf(listing({ deployment: ['Cloud', 'Self-hosted'] })),
    ).toBe('Cloud, Self-hosted');
  });

  test('null or empty is absence', () => {
    expect(deploymentLabelOf(listing({ deployment: null }))).toBeNull();
    expect(deploymentLabelOf(listing({ deployment: [] }))).toBeNull();
  });
});

describe('row derivation', () => {
  test('entry numbers are stable 1-based catalog positions, zero-padded', () => {
    const rows = deriveRows(listings);
    expect(rows).toHaveLength(239);
    expect(rows[0]?.entryLabel).toBe('001');
    expect(rows[238]?.entryLabel).toBe('239');
    expect(rows.map((r) => r.entry)).toEqual(rows.map((_, i) => i + 1));
  });

  test('absent stars render null; a genuine zero stays honest data', () => {
    const rows = deriveRows(listings);
    for (const r of rows) {
      if (r.stars === null) {
        expect(r.starsLabel).toBeNull();
      }
    }
    // factory-agent ships stars: 0 in the dataset — a fact, not an absence
    expect(rows.some((r) => r.starsLabel === '0')).toBe(true);
  });
});

describe('sort ordering', () => {
  const rows = [
    row({ id: 'a', entry: 1, name: 'Alpha', stars: 100, starsLabel: '100' }),
    row({ id: 'b', entry: 2, name: 'bravo', stars: null }),
    row({ id: 'c', entry: 3, name: 'Charlie', stars: 50, starsLabel: '50' }),
    row({ id: 'd', entry: 4, name: 'Bravo', stars: 200, starsLabel: '200' }),
  ];

  test('absent values sort last in both directions', () => {
    const asc = sortRows(rows, 'star', 'asc').map((r) => r.id);
    const desc = sortRows(rows, 'star', 'desc').map((r) => r.id);
    expect(asc).toEqual(['c', 'a', 'd', 'b']);
    expect(desc).toEqual(['d', 'a', 'c', 'b']);
  });

  test('name sorts case-insensitively, ties broken by catalog order', () => {
    const sorted = sortRows(rows, 'name', 'asc').map((r) => r.id);
    expect(sorted).toEqual(['a', 'b', 'd', 'c']);
  });

  test('descending name reverses values but keeps catalog tiebreak', () => {
    const sorted = sortRows(rows, 'name', 'desc').map((r) => r.id);
    expect(sorted).toEqual(['c', 'b', 'd', 'a']);
  });

  test('oss groups YES vs absence, direction picks the leading group', () => {
    const ossRows = [
      row({ id: 'a', entry: 1, ossYes: false }),
      row({ id: 'b', entry: 2, ossYes: true }),
      row({ id: 'c', entry: 3, ossYes: false }),
      row({ id: 'd', entry: 4, ossYes: true }),
    ];
    expect(sortRows(ossRows, 'oss', 'desc').map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(sortRows(ossRows, 'oss', 'asc').map((r) => r.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  test('idx restores catalog order ascending', () => {
    const shuffled = [rows[2], rows[0], rows[3], rows[1]];
    expect(sortRows(shuffled, 'idx', 'asc').map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('valued rows reverse on desc while absence stays last', () => {
    const same = [
      row({ id: 'a', entry: 1, licenseLabel: 'Apache-2.0' }),
      row({ id: 'b', entry: 2, licenseLabel: 'MIT' }),
      row({ id: 'c', entry: 3, licenseLabel: null }),
      row({ id: 'd', entry: 4, licenseLabel: null }),
    ];
    expect(sortRows(same, 'lic', 'asc').map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(sortRows(same, 'lic', 'desc').map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  test('equal keys fall back to catalog order regardless of direction', () => {
    const same = [
      row({ id: 'a', entry: 1, licenseLabel: 'MIT' }),
      row({ id: 'b', entry: 2, licenseLabel: 'MIT' }),
    ];
    for (const dir of ['asc', 'desc'] as const) {
      expect(sortRows(same, 'lic', dir).map((r) => r.id)).toEqual(['a', 'b']);
    }
  });

  test('compareRows is antisymmetric', () => {
    for (const x of rows) {
      for (const y of rows) {
        for (const dir of ['asc', 'desc'] as const) {
          expect(Math.sign(compareRows(x, y, 'star', dir)) + 0).toBe(
            -Math.sign(compareRows(y, x, 'star', dir)) + 0,
          );
        }
      }
    }
  });
});

describe('initial directions', () => {
  test('stars and oss lead with their scan-useful grouping, others ascending', () => {
    expect(initialDirection('star')).toBe('desc');
    expect(initialDirection('oss')).toBe('desc');
    expect(initialDirection('idx')).toBe('asc');
    expect(initialDirection('name')).toBe('asc');
    expect(initialDirection('cat')).toBe('asc');
    expect(initialDirection('lic')).toBe('asc');
    expect(initialDirection('dep')).toBe('asc');
  });
});
