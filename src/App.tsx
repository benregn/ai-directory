import { useMemo, useState } from 'react';
import { DetailDrawer } from './components/DetailDrawer.tsx';
import { FacetRail } from './components/FacetRail.tsx';
import { Masthead } from './components/Masthead.tsx';
import { ParameterStrip } from './components/ParameterStrip.tsx';
import { SpecMatrix } from './components/SpecMatrix.tsx';
import { listings } from './data/listings.ts';
import type { FilterState } from './filter-model.ts';
import { deriveFacets, emptyFilters, filterRows } from './filter-model.ts';
import { deriveRows } from './matrix-model.ts';

/** Composition root: the shared viewer state is plain React state. */
export default function App() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const rows = useMemo(() => deriveRows(listings), []);
  const facets = useMemo(() => deriveFacets(rows), [rows]);
  const filteredRows = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const clearFilters = () => setFilters(emptyFilters());

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
          <SpecMatrix rows={filteredRows} onClearFilters={clearFilters} />
        </main>
        <DetailDrawer />
      </div>
    </div>
  );
}
