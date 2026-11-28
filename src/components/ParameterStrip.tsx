import { Fragment, useEffect, useRef } from 'react';
import type { FacetOption, FilterState } from '../filter-model.ts';
import { clearFilter, emptyFilters, stripParameters } from '../filter-model.ts';
import './ParameterStrip.css';

/** Parameter strip: explicit `any` values when unconstrained, active parameters with × once filtered. */
export function ParameterStrip({
  filters,
  categories,
  resultCount,
  onFiltersChange,
}: {
  filters: FilterState;
  categories: Array<FacetOption>;
  resultCount: number;
  onFiltersChange: (filters: FilterState) => void;
}) {
  const parameters = stripParameters(filters, categories);
  const paramsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (paramsRef.current) {
      paramsRef.current.scrollLeft = 0;
    }
  }, [filters]);
  return (
    <div className="strip" aria-label="Filter parameters">
      <div className="strip-params" ref={paramsRef}>
        {parameters.map((param, index) => (
          <Fragment key={param.key}>
            <span title={`${param.label}: ${param.value}`}>
              {param.active && (
                <button
                  type="button"
                  className="x"
                  aria-label={`Clear ${param.label}`}
                  onClick={() => onFiltersChange(clearFilter(filters, param.key))}
                >
                  ×
                </button>
              )}
              {param.label}: <b>{param.value}</b>
            </span>
            {index < parameters.length - 1 && <span className="sep">·</span>}
          </Fragment>
        ))}
      </div>
      <span className="res">
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
      </span>
      <button type="button" className="clear" onClick={() => onFiltersChange(emptyFilters())}>
        Clear all
      </button>
    </div>
  );
}
