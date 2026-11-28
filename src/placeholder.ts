/**
 * Static structural placeholder content for the app shell, mirroring the
 * design mock (.impeccable/mocks/decision/model-pick-v3.html). It exists only
 * to demonstrate correct proportions and furniture at the shell layer.
 *
 * Issues #3/#4/#5 replace this with the wired data pipeline
 * (src/data/listings.ts): real facets, matrix rows, drawer content,
 * filtering. Nothing here is interactive or derived — do not build on it.
 */

export interface PlaceholderFacetGroup {
  title: string;
  options: Array<{ label: string; count?: number; checked?: boolean }>;
  moreLink?: string;
}

export const facetGroups: Array<PlaceholderFacetGroup> = [
  {
    title: 'Category',
    options: [
      { label: 'Agent orchestration', count: 74, checked: true },
      { label: 'App builders', count: 65 },
      { label: 'Engineering factories', count: 56 },
      { label: 'Agent infrastructure', count: 19 },
      { label: 'Code review', count: 10 },
      { label: 'Agent workspaces', count: 9 },
      { label: 'AI labs', count: 4 },
      { label: 'Dev platforms', count: 2 },
    ],
  },
  {
    title: 'License',
    options: [
      { label: 'MIT' },
      { label: 'Apache-2.0' },
      { label: 'AGPL-3.0' },
      { label: 'Proprietary' },
    ],
  },
  {
    title: 'Deployment',
    options: [
      { label: 'Cloud' },
      { label: 'Self-hosted' },
      { label: 'Local' },
    ],
  },
  {
    title: 'Open source',
    options: [{ label: 'Open source only' }],
  },
  {
    title: 'Topics',
    options: [
      { label: 'MCP' },
      { label: 'CLI' },
      { label: 'Enterprise' },
      { label: 'Background agents' },
    ],
    moreLink: 'Show all topics →',
  },
];

export interface StripParam {
  label: string;
  value: string;
  /** renders the blue × clear-mark before the label */
  clearable?: boolean;
}

export const stripParams: Array<StripParam> = [
  { label: 'Category', value: 'Agent orchestration', clearable: true },
  { label: 'License', value: 'any' },
  { label: 'Stars', value: '≥ 100', clearable: true },
];
