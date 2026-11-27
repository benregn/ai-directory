/**
 * Typed loader for the viewer data bundle. The data artifact is plain JSON
 * (src/data/listings.json), regenerated from data/listings.jsonl +
 * data/categories.json by scripts/build-data.mjs before every dev/build —
 * updating the scraped data never means editing TypeScript.
 *
 * Type safety has two layers:
 *
 * 1. The `satisfies` check below makes tsc structurally verify the whole JSON
 *    artifact against the type contract — every record, every required key,
 *    nullability, array nesting. The single exception is `deployment`:
 *    TypeScript widens JSON-imported string literals to `string`, so the
 *    `Deployment` union cannot be checked through a JSON import (verified
 *    empirically — the check uses a widened field type, nothing is silent).
 * 2. Token narrowness (and every value-level invariant: counts, star
 *    consistency, known category slugs, …) is enforced by build-data.mjs,
 *    which fails the build loudly before tsc even runs. Since predev/prebuild
 *    always regenerate the artifact, no unvalidated JSON can reach consumers.
 *
 * The `as` cast is sound exactly because of those two layers.
 */
import data from './listings.json';
import type { CategoryInfo, Listing } from './types.ts';

type ListingJsonCheck = Omit<Listing, 'deployment'> & {
  deployment: Array<string> | null;
};

const checked = data satisfies {
  categories: Array<CategoryInfo>;
  listings: Array<ListingJsonCheck>;
};

export const categories: Array<CategoryInfo> = checked.categories;
// Narrowing is deliberate: structure is proven by the satisfies check above and
// token narrowness by build-data.mjs at generation time — this data is parsed
// at its boundary, exactly as the lint rule asks, just one step upstream.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const listings: Array<Listing> = checked.listings as Array<Listing>;
