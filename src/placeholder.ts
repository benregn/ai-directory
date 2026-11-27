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

export interface MatrixRowData {
  idx: string;
  initial: string;
  name: string;
  summary: string;
  category: string;
  /** null renders the absent-data dash (—), never filler */
  license: string | null;
  deployment: string | null;
  oss: string | null;
  stars: string | null;
  selected?: boolean;
}

export const matrixRows: Array<MatrixRowData> = [
  {
    idx: '001',
    initial: 'C',
    name: 'Cline',
    summary:
      'Open-source agentic coding assistant with Plan and Act modes and MCP tooling.',
    category: 'Agent workspaces',
    license: 'Apache-2.0',
    deployment: null,
    oss: 'YES',
    stars: '70,500',
  },
  {
    idx: '002',
    initial: 'A',
    name: 'Atomic',
    summary:
      'Verifiable coding agent runtime that models engineering as a graph of stages, checks and approval gates.',
    category: 'Agent orchestration',
    license: 'MIT',
    deployment: null,
    oss: 'YES',
    stars: '861',
  },
  {
    idx: '003',
    initial: 'C',
    name: 'Cyrus',
    summary:
      'Claude Code background agent for Linear, Slack, GitHub and GitLab, self-hosted or cloud.',
    category: 'Agent orchestration',
    license: 'Apache-2.0',
    deployment: 'Cloud, Self-hosted',
    oss: 'YES',
    stars: '857',
  },
  {
    idx: '004',
    initial: 'A',
    name: 'Aeon',
    summary:
      'Open-source framework that runs unattended on GitHub Actions.',
    category: 'Agent orchestration',
    license: 'MIT',
    deployment: null,
    oss: 'YES',
    stars: '777',
    selected: true,
  },
  {
    idx: '005',
    initial: 'F',
    name: 'Foreman',
    summary:
      'Terminal UI orchestrator that supervises headless Claude Code agents through a gated pipeline.',
    category: 'Agent orchestration',
    license: 'MIT',
    deployment: null,
    oss: 'YES',
    stars: '443',
  },
  {
    idx: '006',
    initial: 'B',
    name: 'Baz',
    summary:
      'Agentic code review platform that extends AI review upstream into planning.',
    category: 'Code review',
    license: 'AGPL-3.0',
    deployment: null,
    oss: 'YES',
    stars: '46',
  },
  {
    idx: '007',
    initial: '8',
    name: '8090',
    summary:
      'AI-native software company that builds enterprise software with AI agents under governance and audit controls.',
    category: 'Agent orchestration',
    license: 'Proprietary',
    deployment: null,
    oss: null,
    stars: null,
  },
  {
    idx: '008',
    initial: 'A',
    name: 'AIFactory',
    summary:
      'Self-hosted, browser-based software factory where planner, coder and QA agents take a spec to working code.',
    category: 'Agent orchestration',
    license: null,
    deployment: 'Self-hosted',
    oss: 'YES',
    stars: null,
  },
  {
    idx: '009',
    initial: 'A',
    name: 'AI-Ready Nx Workspace',
    summary:
      "Agent-agnostic governance layer that makes coding agents follow a repository's architecture and quality gates.",
    category: 'Agent orchestration',
    license: null,
    deployment: null,
    oss: 'YES',
    stars: null,
  },
  {
    idx: '010',
    initial: 'A',
    name: 'Agentic Engineering OS',
    summary:
      'Platform for running and governing coding agents across software delivery, with Knowledge Core and Mission Control.',
    category: 'Agent orchestration',
    license: null,
    deployment: 'Cloud',
    oss: null,
    stars: null,
  },
  {
    idx: '011',
    initial: 'A',
    name: 'Agentic Software Factory',
    summary:
      'Open-source reference design for OpenShift AI where a chain of agents turns requirements into code.',
    category: 'Engineering factories',
    license: null,
    deployment: null,
    oss: 'YES',
    stars: null,
  },
  {
    idx: '012',
    initial: 'A',
    name: 'AppFactor',
    summary:
      "Persistent AI agents that maintain and modernize a company's whole software estate.",
    category: 'Engineering factories',
    license: 'Proprietary',
    deployment: 'Self-hosted',
    oss: null,
    stars: null,
  },
  {
    idx: '013',
    initial: 'A',
    name: 'Anything',
    summary:
      'AI agent that builds mobile and web apps from a chat, with database, login, backend and payments.',
    category: 'App builders',
    license: null,
    deployment: 'Cloud',
    oss: null,
    stars: null,
  },
  {
    idx: '014',
    initial: 'A',
    name: 'AppWizzy',
    summary:
      'Builds web apps and websites from a plain English description, each running on its own hosting.',
    category: 'App builders',
    license: null,
    deployment: 'Cloud',
    oss: null,
    stars: null,
  },
  {
    idx: '015',
    initial: 'C',
    name: 'Conductor',
    summary:
      'Mac app that runs Claude Code, Codex, Cursor and OpenCode agents in parallel isolated worktrees.',
    category: 'Agent workspaces',
    license: null,
    deployment: 'Local',
    oss: null,
    stars: null,
  },
  {
    idx: '016',
    initial: 'A',
    name: 'Actual',
    summary:
      "Turns a team's code, docs and tickets into architecture decisions and reviews every pull request.",
    category: 'Code review',
    license: null,
    deployment: null,
    oss: null,
    stars: null,
  },
];

export const drawerFacts: Array<[string, string]> = [
  ['CATEGORY', 'Agent orchestration'],
  ['LICENSE', 'MIT'],
  ['STARS', '777'],
  ['OPEN SOURCE', 'yes'],
  ['TOPICS', 'Background agents, MCP'],
  ['DEPLOYMENT', 'GitHub Actions'],
  ['COMMERCIAL', 'none found'],
  ['LISTED', 'October 2026'],
  ['VERIFIED', 'October 2026'],
];

export const drawerCompare: Array<{ name: string; stars: string }> = [
  { name: 'Atomic', stars: '861' },
  { name: 'Cyrus', stars: '857' },
  { name: 'Aeon', stars: '777' },
  { name: 'Foreman', stars: '443' },
];
