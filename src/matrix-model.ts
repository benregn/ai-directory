/**
 * Pure view-model for the spec matrix: row derivation, absence formatting
 * and sort ordering. No React, no DOM — the component only renders what
 * these functions decide, and the tests pin every judgment call.
 *
 * Documented decisions:
 *
 * - `entry` is the row's stable catalog number: its 1-based position in the
 *   dataset's canonical order. It never re-numbers on sort — sorting by `#`
 *   restores (or reverses) the catalog order, which is what makes `#` a
 *   meaningful sortable column.
 * - License renders the SPDX id when present; otherwise `oss === false`
 *   derives "Proprietary" (the data carries `license: null` on all 111
 *   proprietary records), exactly as the design mock renders it. Anything
 *   else is absence.
 * - OSS inks only the positive assertion: `oss === true` renders YES;
 *   false and null both render absence, as the mock does. Because the two
 *   render identically, they also sort as one group — splitting
 *   identical-looking rows would be incoherent.
 * - Stars are comma-grouped in the mock's register. Approximate values
 *   (scraped from rounded strings like "1.3K") carry a `~` prefix: the
 *   precision the data honestly has, never more. Absent is never 0.
 * - Absence is not a value: nulls sort last in both directions on every
 *   valued column. OSS is the one exception — it is binary by display
 *   (YES vs absence), so the direction only chooses which group leads.
 * - Ties break by catalog order (entry ascending), so every ordering is
 *   total and stable.
 */

import type { Deployment, MatrixRow } from './data/types.ts';

export type SortColumn = 'idx' | 'name' | 'cat' | 'lic' | 'dep' | 'oss' | 'star';
export type SortDirection = 'asc' | 'desc';

export interface MatrixRowView {
  id: string;
  /** Stable 1-based catalog position in dataset order. */
  entry: number;
  entryLabel: string;
  name: string;
  initial: string;
  summary: string;
  category: string;
  categorySlug: string;
  licenseLabel: string | null;
  deployment: Array<Deployment> | null;
  deploymentLabel: string | null;
  oss: boolean | null;
  ossYes: boolean;
  stars: number | null;
  starsLabel: string | null;
  topics: Array<string>;
}

const starFormat = new Intl.NumberFormat('en-US');

export function formatStars(stars: number, approximate: boolean | null): string {
  return `${approximate ? '~' : ''}${starFormat.format(stars)}`;
}

export function licenseLabelOf(listing: MatrixRow): string | null {
  if (listing.license !== null) {
    return listing.license;
  }
  return listing.oss === false ? 'Proprietary' : null;
}

export function deploymentLabelOf(listing: MatrixRow): string | null {
  if (!listing.deployment || listing.deployment.length === 0) {
    return null;
  }
  return listing.deployment.join(', ');
}

/** Derive the display rows once, in catalog order; sorting reorders them. */
export function deriveRows(rows: Array<MatrixRow>): Array<MatrixRowView> {
  return rows.map((listing, index) => ({
    id: listing.id,
    entry: index + 1,
    entryLabel: String(index + 1).padStart(3, '0'),
    name: listing.name,
    initial: listing.name.charAt(0).toUpperCase(),
    summary: listing.summary,
    category: listing.category,
    categorySlug: listing.categorySlug,
    licenseLabel: licenseLabelOf(listing),
    deployment: listing.deployment,
    deploymentLabel: deploymentLabelOf(listing),
    oss: listing.oss,
    ossYes: listing.oss === true,
    stars: listing.stars,
    starsLabel:
      listing.stars === null
        ? null
        : formatStars(listing.stars, listing.starsApproximate),
    topics: listing.topics,
  }));
}

/** The direction a column takes on its first click — the scan-useful one. */
export function initialDirection(column: SortColumn): SortDirection {
  switch (column) {
    case 'star':
    case 'oss':
      return 'desc';
    default:
      return 'asc';
  }
}

type SortKey = string | number | null;

function sortKey(row: MatrixRowView, column: SortColumn): SortKey {
  switch (column) {
    case 'idx':
      return row.entry;
    case 'name':
      return row.name.toLowerCase();
    case 'cat':
      return row.category.toLowerCase();
    case 'lic':
      return row.licenseLabel?.toLowerCase() ?? null;
    case 'dep':
      return row.deploymentLabel?.toLowerCase() ?? null;
    case 'oss':
      // Binary by display: YES vs absence. Never null — see the module doc.
      return row.ossYes ? 1 : 0;
    case 'star':
      return row.stars;
  }
}

function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return 0;
}

/**
 * Total ordering for the matrix: valued cells by the column's key in the
 * active direction, absent cells last in both directions, ties by catalog
 * order so sorting never shuffles equal rows around.
 */
export function compareRows(
  a: MatrixRowView,
  b: MatrixRowView,
  column: SortColumn,
  direction: SortDirection,
): number {
  const keyA = sortKey(a, column);
  const keyB = sortKey(b, column);
  if (keyA === null && keyB === null) {
    return a.entry - b.entry;
  }
  if (keyA === null) {
    return 1;
  }
  if (keyB === null) {
    return -1;
  }
  const ordered = compareKeys(keyA, keyB);
  if (ordered !== 0) {
    return direction === 'asc' ? ordered : -ordered;
  }
  return a.entry - b.entry;
}

export function sortRows(
  rows: Array<MatrixRowView>,
  column: SortColumn,
  direction: SortDirection,
): Array<MatrixRowView> {
  return [...rows].sort((a, b) => compareRows(a, b, column, direction));
}
