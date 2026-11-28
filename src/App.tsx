import { useCallback, useMemo, useState } from 'react';
import { DetailDrawer } from './components/DetailDrawer.tsx';
import { FacetRail } from './components/FacetRail.tsx';
import { Masthead } from './components/Masthead.tsx';
import { ParameterStrip } from './components/ParameterStrip.tsx';
import { SpecMatrix } from './components/SpecMatrix.tsx';
import { listings } from './data/listings.ts';
import type { FilterState } from './filter-model.ts';
import { deriveFacets, emptyFilters, filterRows } from './filter-model.ts';
import { deriveRows } from './matrix-model.ts';

/** Stable catalog positions — the same numbering the matrix derives. */
const entryById = new Map(listings.map((listing, index) => [listing.id, index + 1]));

/**
 * Composition root: the shared viewer state is plain React state.
 *
 * Selection is the viewer's single cursor: the matrix moves it (click,
 * arrows), the drawer's same-class list moves it, and the drawer renders
 * the record it names.
 */
export default function App() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => deriveRows(listings), []);
  const facets = useMemo(() => deriveFacets(rows), [rows]);
  const filteredRows = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const clearFilters = () => setFilters(emptyFilters());

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // Compare is a targeting action, not an incremental one: pressing it
  // constrains the category facet to exactly that record's category,
  // replacing whatever category selection the user made by hand. Pressing
  // Compare on a record whose category is already the sole selected
  // category lifts the constraint — back to empty, honestly, not to the
  // pre-compare manual selection (restoring that would need stateful
  // memory nobody asked for). Every other filter — licenses, deployments,
  // topics, query, openSourceOnly — is never touched in either direction,
  // so Compare composes with the user's own constraints as a plain AND.
  const handleCompare = useCallback((categorySlug: string) => {
    setFilters((current) => ({
      ...current,
      categories:
        current.categories.length === 1 && current.categories[0] === categorySlug
          ? []
          : [categorySlug],
    }));
  }, []);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <div className="app">
      <Masthead
        query={filters.query}
        productCount={rows.length}
        categoryCount={facets.categories.length}
        onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
      />
      <div className="shell">
        <FacetRail
          facets={facets}
          filters={filters}
          resultCount={filteredRows.length}
          totalCount={rows.length}
          onFiltersChange={setFilters}
        />
        <main>
          <ParameterStrip
            filters={filters}
            categories={facets.categories}
            resultCount={filteredRows.length}
            onFiltersChange={setFilters}
          />
          <SpecMatrix
            rows={filteredRows}
            selectedId={selectedId}
            onSelect={handleSelect}
            onClearFilters={clearFilters}
          />
        </main>
        <DetailDrawer
          listing={selectedListing}
          entry={selectedId === null ? null : (entryById.get(selectedId) ?? null)}
          total={listings.length}
          onCompare={handleCompare}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
