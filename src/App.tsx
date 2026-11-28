import { useCallback, useEffect, useMemo, useState } from 'react';
import { DetailDrawer } from './components/DetailDrawer.tsx';
import { FacetRail } from './components/FacetRail.tsx';
import { Masthead } from './components/Masthead.tsx';
import { ParameterStrip } from './components/ParameterStrip.tsx';
import { SpecMatrix } from './components/SpecMatrix.tsx';
import { listings } from './data/listings.ts';
import type { FilterState } from './filter-model.ts';
import { deriveFacets, emptyFilters, filterRows } from './filter-model.ts';
import { deriveRows } from './matrix-model.ts';
import type { ValidCatalog } from './share-state.ts';
import {
  resolveInitialState,
  serializeViewerState,
  shortlistMarkdown,
  storeViewerState,
} from './share-state.ts';

/**
 * Composition root: the shared viewer state is plain React state.
 *
 * Selection is the viewer's single cursor: the matrix moves it (click,
 * arrows), the drawer's same-class list moves it, and the drawer renders
 * the record it names.
 *
 * Issue #6 adds the shortlist and makes the whole viewer state shareable:
 * filters, selection, shortlist and the hide-shortlisted mode serialize
 * into the URL live (replaceState — no history spam) and write through to
 * localStorage on every change. Initial state resolves once at mount with
 * the documented precedence — a URL carrying any recognized key wins over
 * storage completely, storage fills a clean URL, defaults otherwise
 * (share-state.ts pins the semantics). The catalog data is static, so the
 * rows, facets and the validation vocabularies compute once at module
 * scope rather than in hooks.
 */
const rows = deriveRows(listings);
const facets = deriveFacets(rows);
const validCatalog: ValidCatalog = {
  ids: new Set(listings.map((listing) => listing.id)),
  categories: new Set(facets.categories.map((option) => option.value)),
  licenses: new Set(facets.licenses.map((option) => option.value)),
  deployments: new Set(facets.deployments.map((option) => option.value)),
  topics: new Set(facets.topics.map((option) => option.value)),
};

/** Stable catalog positions — the same numbering the matrix derives. */
const entryById = new Map(listings.map((listing, index) => [listing.id, index + 1]));

export default function App() {
  const [initial] = useState(() =>
    resolveInitialState(window.location.search, localStorage, validCatalog),
  );
  const [filters, setFilters] = useState<FilterState>(initial.filters);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [shortlist, setShortlist] = useState<ReadonlySet<string>>(new Set(initial.shortlist));
  const [hiddenShortlisted, setHiddenShortlisted] = useState(initial.hiddenShortlisted);
  const filteredRows = useMemo(() => filterRows(rows, filters), [filters]);
  // Hiding is a row-set mutation exactly like filtering: the matrix never
  // knows why rows leave — its id-keyed focus contract is unchanged.
  const visibleRows = useMemo(
    () =>
      hiddenShortlisted ? filteredRows.filter((row) => !shortlist.has(row.id)) : filteredRows,
    [filteredRows, hiddenShortlisted, shortlist],
  );
  const clearFilters = () => setFilters(emptyFilters());

  // Write-through: every state change mirrors into the URL and storage.
  // The serialized form is canonical enough that a no-op change writes the
  // same string it read, so there is nothing to optimize away.
  useEffect(() => {
    const state = {
      filters,
      selectedId,
      shortlist: [...shortlist],
      hiddenShortlisted,
    };
    const serialized = serializeViewerState(state);
    try {
      window.history.replaceState(
        null,
        '',
        serialized === '' ? window.location.pathname : `${window.location.pathname}?${serialized}`,
      );
    } catch {
      // Sandboxed embeddings can forbid replaceState: the share URL is a
      // convenience, never a reason to crash the viewer.
    }
    storeViewerState(localStorage, state);
  }, [filters, selectedId, shortlist, hiddenShortlisted]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // explicit target state when the caller knows it (the drawer's toggle
  // reports the pressed state it asked for), toggle semantics otherwise
  const toggleShortlist = useCallback((id: string, marked?: boolean) => {
    setShortlist((current) => {
      const target = marked ?? !current.has(id);
      if (target === current.has(id)) {
        return current;
      }
      const next = new Set(current);
      if (target) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
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

  const markdown = useMemo(() => shortlistMarkdown(listings, shortlist), [shortlist]);

  const focusHideControl = useCallback(() => {
    document.getElementById('hide-shortlisted-control')?.focus();
  }, []);

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
          resultCount={visibleRows.length}
          totalCount={rows.length}
          shortlistCount={shortlist.size}
          shortlistMarkdown={markdown}
          hiddenShortlisted={hiddenShortlisted}
          onHiddenShortlistedChange={setHiddenShortlisted}
          onFiltersChange={setFilters}
        />
        <main>
          <ParameterStrip
            filters={filters}
            categories={facets.categories}
            resultCount={visibleRows.length}
            onFiltersChange={setFilters}
          />
          <SpecMatrix
            rows={visibleRows}
            selectedId={selectedId}
            shortlist={shortlist}
            hiddenShortlisted={hiddenShortlisted}
            onSelect={handleSelect}
            onToggleShortlist={toggleShortlist}
            onScanEnd={focusHideControl}
            onClearFilters={clearFilters}
          />
        </main>
        <DetailDrawer
          listing={selectedListing}
          entry={selectedId === null ? null : (entryById.get(selectedId) ?? null)}
          total={listings.length}
          shortlisted={selectedId !== null && shortlist.has(selectedId)}
          onToggleShortlist={toggleShortlist}
          onCompare={handleCompare}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
