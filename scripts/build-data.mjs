#!/usr/bin/env node
/**
 * Build the viewer data bundle: reads data/listings.jsonl + data/categories.json
 * and emits src/data/listings.json, the JSON data artifact holding the flat
 * matrix rows and the full detail payload for every record. The typed thin
 * loader in src/data/listings.ts bundles that JSON for consumers.
 *
 * Invariants are enforced against data/verify-report.json (ground truth from the
 * scrape) and categories.json; any violation fails the build loudly.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'src/data/listings.json');

function fail(message) {
  console.error(`build-data: error: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function checkType(value, type, context) {
  if (typeof value !== type) {
    fail(`${context}: expected ${type}, got ${typeof value} (${JSON.stringify(value)?.slice(0, 80)})`);
  }
}

// ---------- load inputs ----------

const records = [];
const jsonlPath = join(root, 'data/listings.jsonl');
const lines = readFileSync(jsonlPath, 'utf8').split('\n').filter((line) => line.trim() !== '');
for (const [index, line] of lines.entries()) {
  try {
    records.push(JSON.parse(line));
  } catch (error) {
    fail(`data/listings.jsonl line ${index + 1}: invalid JSON (${error.message})`);
  }
}

const categoriesInput = JSON.parse(readFileSync(join(root, 'data/categories.json'), 'utf8'));
const verifyReport = JSON.parse(readFileSync(join(root, 'data/verify-report.json'), 'utf8'));

// ---------- cross-input ground truth ----------

const categoryBySlug = new Map();
for (const category of categoriesInput.categories) {
  checkType(category.slug, 'string', 'categories.json category');
  checkType(category.name, 'string', `categories.json category ${category.slug}`);
  check(
    category.advertised_count === category.collected_count &&
      category.collected_count === category.item_urls.length,
    `categories.json ${category.slug}: advertised (${category.advertised_count}), ` +
      `collected (${category.collected_count}) and item urls (${category.item_urls.length}) disagree`,
  );
  categoryBySlug.set(category.slug, category);
}

const countCheck = verifyReport.checks.find(
  (entry) => entry.name === 'per-category advertised counts match collected unique URLs',
);
check(countCheck, 'verify-report.json: per-category count check not found');
const expectedCounts = new Map(countCheck.detail.map((entry) => [entry.slug, entry.collected_unique]));

// ---------- per-record validation + transform ----------

const DEPLOYMENT_TOKENS = new Set(['Cloud', 'Self-hosted', 'Local']);
const SOURCE_VALUES = new Set(['Open source', 'Proprietary']);

function entriesOf(record) {
  const entries = record.sections?.details?.entries;
  if (!Array.isArray(entries)) fail(`${record.id}: sections.details.entries missing`);
  return entries;
}

function findEntry(entries, label) {
  const matches = entries.filter((entry) => entry.label === label);
  if (matches.length > 1) fail(`record has ${matches.length} "${label}" detail entries`);
  return matches[0];
}

/** Normalize the source's stars/stars_approximate pair into value + rounded flag. */
function normalizeStars(holder, context) {
  const { stars, stars_approximate: approximate } = holder;
  if (stars === null && approximate === null) return { stars: null, starsApproximate: null };
  checkType(stars === null ? approximate : stars, 'number', `${context} stars`);
  if (stars !== null) {
    check(
      approximate === stars,
      `${context}: exact stars (${stars}) differ from stars_approximate (${approximate})`,
    );
    return { stars, starsApproximate: false };
  }
  checkType(approximate, 'number', `${context} stars_approximate`);
  return { stars: approximate, starsApproximate: true };
}

function mirrorLinks(entry, context) {
  if (!Array.isArray(entry.links)) fail(`${context}: links array missing`);
  return entry.links.map((link) => {
    checkType(link.text, 'string', `${context} link text`);
    checkType(link.href, 'string', `${context} link href`);
    return { text: link.text, href: link.href };
  });
}

function textList(items, context) {
  return items.map((item) => {
    checkType(item.text, 'string', context);
    check(
      !item.links || item.links.length === 0,
      `${context}: non-empty inline links would be dropped — extend the bundle to carry them`,
    );
    return item.text;
  });
}

const seenIds = new Set();
const countsByCategory = new Map();
const listings = [];

for (const [index, record] of records.entries()) {
  const at = `record ${record.id ?? `#${index + 1}`}`;

  // identity
  for (const key of ['id', 'name', 'summary', 'url']) checkType(record[key], 'string', `${at} ${key}`);
  check(!seenIds.has(record.id), `${at}: duplicate id`);
  seenIds.add(record.id);
  check(
    record.url.replace(/\/$/, '').split('/').pop() === record.id,
    `${at}: id does not match url slug`,
  );

  // category
  check(Array.isArray(record.categories), `${at}: categories array missing`);
  check(record.categories.length === 1, `${at}: expected exactly 1 category, got ${record.categories.length}`);
  const categorySlug = record.categories[0];
  const categoryMeta = categoryBySlug.get(categorySlug);
  check(categoryMeta, `${at}: unknown category slug ${JSON.stringify(categorySlug)}`);
  countsByCategory.set(categorySlug, (countsByCategory.get(categorySlug) ?? 0) + 1);

  const entries = entriesOf(record);

  // matrix scalars
  const license = findEntry(entries, 'License')?.text ?? null;

  let deployment = null;
  const deploymentText = findEntry(entries, 'Deployment')?.text;
  if (deploymentText !== undefined) {
    deployment = deploymentText.split(', ');
    for (const token of deployment) {
      check(
        DEPLOYMENT_TOKENS.has(token),
        `${at}: unknown deployment token ${JSON.stringify(token)} — extend the Deployment type`,
      );
    }
  }

  let oss = null;
  const sourceText = findEntry(entries, 'Source')?.text;
  if (sourceText !== undefined) {
    check(SOURCE_VALUES.has(sourceText), `${at}: unknown Source value ${JSON.stringify(sourceText)}`);
    oss = sourceText === 'Open source';
  }

  let stars = null;
  let starsApproximate = null;
  const repositoryEntry = findEntry(entries, 'Repository');
  if (repositoryEntry) {
    const repositories = repositoryEntry.repositories;
    check(Array.isArray(repositories), `${at}: Repository entry without repositories array`);
    check(
      repositories.length === 1,
      `${at}: ${repositories.length} repositories — multi-repo records need a bundle decision`,
    );
    ({ stars, starsApproximate } = normalizeStars(repositories[0], `${at} repository`));
  }

  const topicsEntry = findEntry(entries, 'Topics');
  let topics = [];
  if (topicsEntry) {
    check(Array.isArray(topicsEntry.topics), `${at}: Topics entry without structured topics array`);
    topics = topicsEntry.topics.map((topic) => {
      checkType(topic.text, 'string', `${at} topic`);
      return topic.text;
    });
  }

  // detail payload
  const overview = record.sections?.overview?.paragraphs;
  check(Array.isArray(overview) && overview.length > 0, `${at}: overview paragraphs missing`);
  const features = record.sections?.features?.items;
  check(Array.isArray(features), `${at}: features items missing`);

  const mirroredEntries = entries.map((entry) => {
    const context = `${at} entry ${JSON.stringify(entry.label)}`;
    checkType(entry.label, 'string', `${at} entry label`);
    checkType(entry.text, 'string', context);
    const mirrored = { label: entry.label, text: entry.text, links: mirrorLinks(entry, context) };
    if (entry.topics !== undefined) {
      mirrored.topics = entry.topics.map((topic) => {
        checkType(topic.text, 'string', `${context} topic`);
        checkType(topic.url, 'string', `${context} topic url`);
        return { text: topic.text, url: topic.url };
      });
    }
    if (entry.time !== undefined) {
      checkType(entry.time.text, 'string', `${context} time`);
      checkType(entry.time.datetime, 'string', `${context} time datetime`);
      mirrored.time = { text: entry.time.text, datetime: entry.time.datetime };
    }
    if (entry.repositories !== undefined) {
      mirrored.repositories = entry.repositories.map((repository) => {
        checkType(repository.text, 'string', `${context} repository`);
        checkType(repository.url, 'string', `${context} repository url`);
        return {
          text: repository.text,
          url: repository.url,
          ...normalizeStars(repository, `${context} repository`),
        };
      });
    }
    return mirrored;
  });

  const similar = record.sections?.similar;
  check(similar && Array.isArray(similar.cards), `${at}: similar cards missing`);
  check(similar.more_link, `${at}: similar more_link missing`);
  const similarItems = similar.cards.map((card) => {
    const context = `${at} similar ${JSON.stringify(card.name)}`;
    for (const key of ['name', 'url', 'category', 'summary']) checkType(card[key], 'string', context);
    check(Array.isArray(card.badges), `${context}: badges array missing`);
    return {
      name: card.name,
      url: card.url,
      category: card.category,
      summary: card.summary,
      logoUrl: card.logo_url ?? null,
      badges: card.badges.map((badge) => {
        checkType(badge, 'string', `${context} badge`);
        return badge;
      }),
      ...normalizeStars(card, context),
    };
  });

  const snapshot = record.source_snapshot;
  check(snapshot, `${at}: source_snapshot missing`);
  for (const key of ['requested_url', 'final_url', 'fetched_at', 'body_sha256', 'snapshot_path']) {
    checkType(snapshot[key], 'string', `${at} snapshot ${key}`);
  }
  checkType(snapshot.status, 'number', `${at} snapshot status`);

  listings.push({
    id: record.id,
    name: record.name,
    summary: record.summary,
    category: categoryMeta.name,
    categorySlug,
    license,
    deployment,
    oss,
    stars,
    starsApproximate,
    topics,
    detail: {
      overview: textList(overview, `${at} overview`),
      features: textList(features, `${at} features`),
      entries: mirroredEntries,
      similar: {
        items: similarItems,
        moreLink: { text: similar.more_link.text, url: similar.more_link.url },
      },
      logoUrl: record.logo_url ?? null,
      sourceUrl: record.url,
      snapshot: {
        requestedUrl: snapshot.requested_url,
        finalUrl: snapshot.final_url,
        fetchedAt: snapshot.fetched_at,
        status: snapshot.status,
        bodySha256: snapshot.body_sha256,
        snapshotPath: snapshot.snapshot_path,
      },
    },
  });
}

// ---------- count enforcement against ground truth ----------

check(
  listings.length === verifyReport.record_count,
  `record count ${listings.length} does not match verify-report (${verifyReport.record_count})`,
);

const inventoryUrls = new Set();
for (const category of categoriesInput.categories) {
  for (const url of category.item_urls) inventoryUrls.add(url);
}
const recordUrls = new Set(listings.map((listing) => listing.detail.sourceUrl));
for (const url of inventoryUrls) {
  check(recordUrls.has(url), `categories.json item ${url} has no record in listings.jsonl`);
}
for (const url of recordUrls) {
  check(inventoryUrls.has(url), `record ${url} is not in any categories.json category`);
}

for (const [slug, expected] of expectedCounts) {
  const actual = countsByCategory.get(slug) ?? 0;
  const advertised = categoryBySlug.get(slug)?.advertised_count;
  check(
    actual === expected && actual === advertised,
    `category ${slug}: emitted ${actual} records, verify-report expects ${expected}, ` +
      `categories.json advertises ${advertised}`,
  );
}
for (const slug of countsByCategory.keys()) {
  check(expectedCounts.has(slug), `category ${slug}: present in records but missing from verify-report`);
}

// ---------- emit ----------

const categories = categoriesInput.categories.map((category) => ({
  slug: category.slug,
  name: category.name,
  url: category.url,
  count: countsByCategory.get(category.slug) ?? 0,
}));

const output = `${JSON.stringify({ categories, listings }, null, 2)}\n`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, output);

console.log(
  `build-data: ${listings.length} listings across ${categories.length} categories → ${outFile.replace(`${root}/`, '')}`,
);
