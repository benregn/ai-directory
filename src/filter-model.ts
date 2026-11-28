import type { Deployment } from './data/types.ts';

/** License-facet label for rows whose source carries no license and is not proprietary. */
export const LICENSE_UNSPECIFIED = 'Unspecified';

/** License-facet label grouping the catalog's long tail of single-/two-row licenses. */
export const LICENSE_OTHER = 'Other licenses';

/**
 * Viewer filter state, owned by the composition root. Category values are
 * slugs so a caller can constrain the catalog to one category with
 * `categories: [row.categorySlug]`; every other value is the display token
 * already present in the data model.
 */
export interface FilterState {
  categories: Array<string>;
  licenses: Array<string>;
  deployments: Array<Deployment>;
  openSourceOnly: boolean;
  topics: Array<string>;
  query: string;
}

export type FilterKey = keyof FilterState;

export interface FilterableRow {
  name: string;
  summary: string;
  category: string;
  categorySlug: string;
  licenseLabel: string | null;
  deployment: Array<Deployment> | null;
  oss: boolean | null;
  topics: Array<string>;
}

export interface FacetOption<Value extends string = string> {
  value: Value;
  label: string;
  count: number;
}

export interface FacetOptions {
  categories: Array<FacetOption>;
  licenses: Array<FacetOption>;
  deployments: Array<FacetOption<Deployment>>;
  topics: Array<FacetOption>;
}

export interface StripParameter {
  key: FilterKey;
  label: string;
  value: string;
  active: boolean;
}

export function emptyFilters(): FilterState {
  return {
    categories: [],
    licenses: [],
    deployments: [],
    openSourceOnly: false,
    topics: [],
    query: '',
  };
}

export function matchesQuery(row: FilterableRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    row.name.toLowerCase().includes(needle) ||
    row.summary.toLowerCase().includes(needle) ||
    (row.licenseLabel?.toLowerCase().includes(needle) ?? false) ||
    row.topics.some((topic) => topic.toLowerCase().includes(needle))
  );
}

const LICENSE_PRIMARY_ORDER = ['MIT', 'Apache-2.0', 'AGPL-3.0', 'Proprietary'];
const LICENSE_FACET_ORDER = [...LICENSE_PRIMARY_ORDER, LICENSE_OTHER, LICENSE_UNSPECIFIED];

export function licenseFacetValue(licenseLabel: string | null): string {
  if (licenseLabel === null) {
    return LICENSE_UNSPECIFIED;
  }
  return LICENSE_PRIMARY_ORDER.includes(licenseLabel) ? licenseLabel : LICENSE_OTHER;
}

function matchesLicense(row: FilterableRow, selected: Array<string>): boolean {
  if (selected.length === 0) {
    return true;
  }
  return selected.includes(licenseFacetValue(row.licenseLabel));
}

function matchesDeployment(row: FilterableRow, selected: Array<Deployment>): boolean {
  if (selected.length === 0) {
    return true;
  }
  return row.deployment?.some((token) => selected.includes(token)) ?? false;
}

function matchesTopics(row: FilterableRow, selected: Array<string>): boolean {
  if (selected.length === 0) {
    return true;
  }
  return row.topics.some((topic) => selected.includes(topic));
}

/** Within one facet the selected values OR; separate facets AND. */
export function matchesFilters(row: FilterableRow, filters: FilterState): boolean {
  return (
    (filters.categories.length === 0 || filters.categories.includes(row.categorySlug)) &&
    matchesLicense(row, filters.licenses) &&
    matchesDeployment(row, filters.deployments) &&
    (!filters.openSourceOnly || row.oss === true) &&
    matchesTopics(row, filters.topics) &&
    matchesQuery(row, filters.query)
  );
}

export function filterRows<Row extends FilterableRow>(
  rows: Array<Row>,
  filters: FilterState,
): Array<Row> {
  return rows.filter((row) => matchesFilters(row, filters));
}

function countValues(rows: Array<FilterableRow>, values: (row: FilterableRow) => Array<string>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const value of new Set(values(row))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function comparePreferredThenCount(preferred: Array<string>) {
  const rank = new Map(preferred.map((value, index) => [value, index]));
  return (a: FacetOption, b: FacetOption) => {
    const rankA = rank.get(a.value);
    const rankB = rank.get(b.value);
    if (rankA !== undefined || rankB !== undefined) {
      if (rankA === undefined) {
        return 1;
      }
      if (rankB === undefined) {
        return -1;
      }
      return rankA - rankB;
    }
    return b.count - a.count || a.label.localeCompare(b.label);
  };
}

function categoryOptions(rows: Array<FilterableRow>): Array<FacetOption> {
  const bySlug = new Map<string, FacetOption>();
  for (const row of rows) {
    const existing = bySlug.get(row.categorySlug);
    if (existing) {
      existing.count += 1;
    } else {
      bySlug.set(row.categorySlug, {
        value: row.categorySlug,
        label: row.category,
        count: 1,
      });
    }
  }
  return [...bySlug.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

const DEPLOYMENT_ORDER: Array<Deployment> = ['Cloud', 'Self-hosted', 'Local'];
const TOPIC_MOCK_ORDER = ['MCP', 'CLI', 'Enterprise', 'Background agents'];

function licenseOptions(rows: Array<FilterableRow>): Array<FacetOption> {
  const counts = countValues(rows, (row) => [licenseFacetValue(row.licenseLabel)]);
  return LICENSE_FACET_ORDER.flatMap((value) =>
    counts.has(value) ? [{ value, label: value, count: counts.get(value) ?? 0 }] : [],
  );
}

function deploymentOptions(rows: Array<FilterableRow>): Array<FacetOption<Deployment>> {
  const counts = countValues(rows, (row) => row.deployment ?? []);
  return DEPLOYMENT_ORDER.flatMap((token) =>
    counts.has(token)
      ? [{ value: token, label: token, count: counts.get(token) ?? 0 }]
      : [],
  );
}

function topicOptions(rows: Array<FilterableRow>): Array<FacetOption> {
  const counts = countValues(rows, (row) => row.topics);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort(comparePreferredThenCount(TOPIC_MOCK_ORDER));
}

/** Facets derive once from the full catalog; their counts are stable catalog totals. */
export function deriveFacets(rows: Array<FilterableRow>): FacetOptions {
  return {
    categories: categoryOptions(rows),
    licenses: licenseOptions(rows),
    deployments: deploymentOptions(rows),
    topics: topicOptions(rows),
  };
}

function joined(values: Array<string>): string {
  return values.join(', ');
}

/**
 * Canonical strip parameters. The unconstrained strip spells every facet as
 * `any`; once constrained, it carries only the active parameters so their
 * values and clear controls remain visible.
 */
export function stripParameters(
  filters: FilterState,
  categories: Array<FacetOption>,
): Array<StripParameter> {
  const categoryNames = new Map(categories.map((option) => [option.value, option.label]));
  const categoryValues = filters.categories.map((slug) => categoryNames.get(slug) ?? slug);
  const query = filters.query.trim();
  const parameters = [
    {
      key: 'categories',
      label: 'Category',
      value: categoryValues.length > 0 ? joined(categoryValues) : 'any',
      active: categoryValues.length > 0,
    },
    {
      key: 'licenses',
      label: 'License',
      value: filters.licenses.length > 0 ? joined(filters.licenses) : 'any',
      active: filters.licenses.length > 0,
    },
    {
      key: 'deployments',
      label: 'Deployment',
      value: filters.deployments.length > 0 ? joined(filters.deployments) : 'any',
      active: filters.deployments.length > 0,
    },
    {
      key: 'openSourceOnly',
      label: 'Open source',
      value: filters.openSourceOnly ? 'yes' : 'any',
      active: filters.openSourceOnly,
    },
    {
      key: 'topics',
      label: 'Topics',
      value: filters.topics.length > 0 ? joined(filters.topics) : 'any',
      active: filters.topics.length > 0,
    },
    {
      key: 'query',
      label: 'Search',
      value: query || 'any',
      active: query.length > 0,
    },
  ] satisfies Array<StripParameter>;
  return parameters.some((param) => param.active)
    ? parameters.filter((param) => param.active)
    : parameters;
}

export function clearFilter(filters: FilterState, key: FilterKey): FilterState {
  switch (key) {
    case 'categories':
      return { ...filters, categories: [] };
    case 'licenses':
      return { ...filters, licenses: [] };
    case 'deployments':
      return { ...filters, deployments: [] };
    case 'openSourceOnly':
      return { ...filters, openSourceOnly: false };
    case 'topics':
      return { ...filters, topics: [] };
    case 'query':
      return { ...filters, query: '' };
  }
}
