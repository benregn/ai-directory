import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Checkbox, CheckboxGroup, CheckboxIndicator } from '@ui-sdk/react/checkbox';
import type { FacetOptions, FilterState } from '../filter-model.ts';
import { CopyAction } from './CopyAction.tsx';
import './FacetRail.css';

function FacetCheckbox({
  value,
  label,
  count,
  checked,
}: {
  value: string;
  label: string;
  count?: number;
  checked: boolean;
}) {
  return (
    <label className={checked ? 'ck' : undefined} title={label}>
      <Checkbox
        value={value}
        aria-label={count === undefined ? label : `${label} ${count}`}
      >
        <CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
      </Checkbox>
      <span className="facet-text">{label}</span>
      {count !== undefined && <em>{count}</em>}
    </label>
  );
}

/** Left facet rail: checkbox facets in the mock's sections, driven by catalog data. */
export function FacetRail({
  facets,
  filters,
  resultCount,
  totalCount,
  shortlistCount,
  shortlistMarkdown,
  hiddenShortlisted,
  onHiddenShortlistedChange,
  onFiltersChange,
}: {
  facets: FacetOptions;
  filters: FilterState;
  resultCount: number;
  totalCount: number;
  shortlistCount: number;
  shortlistMarkdown: string;
  hiddenShortlisted: boolean;
  onHiddenShortlistedChange: (hidden: boolean) => void;
  onFiltersChange: (filters: FilterState) => void;
}) {
  const [showAllTopics, setShowAllTopics] = useState(false);
  const updateFilters = (next: FilterState, source?: string) => {
    if (source === 'agent') {
      flushSync(() => onFiltersChange(next));
    } else {
      onFiltersChange(next);
    }
  };
  const visibleTopics = facets.topics.filter(
    (option, index) => showAllTopics || index < 4 || filters.topics.includes(option.value),
  );

  return (
    <aside className="rail">
      <div className="railhead">
        <b>Refine by</b>
        <span className="mono">
          {resultCount} / {totalCount}
        </span>
      </div>

      <div className="facet">
        <h3 id="facet-category">Category</h3>
        <CheckboxGroup
          aria-labelledby="facet-category"
          value={filters.categories}
          onValueChange={(categories, details) =>
            updateFilters({ ...filters, categories }, details.source)
          }
        >
          {facets.categories.map((option) => (
            <FacetCheckbox
              key={option.value}
              value={option.value}
              label={option.label}
              count={option.count}
              checked={filters.categories.includes(option.value)}
            />
          ))}
        </CheckboxGroup>
      </div>

      <div className="facet">
        <h3 id="facet-license">License</h3>
        <CheckboxGroup
          aria-labelledby="facet-license"
          value={filters.licenses}
          onValueChange={(licenses, details) =>
            updateFilters({ ...filters, licenses }, details.source)
          }
        >
          {facets.licenses.map((option) => (
            <FacetCheckbox
              key={option.value}
              value={option.value}
              label={option.label}
              checked={filters.licenses.includes(option.value)}
            />
          ))}
        </CheckboxGroup>
      </div>

      <div className="facet">
        <h3 id="facet-deployment">Deployment</h3>
        <CheckboxGroup
          aria-labelledby="facet-deployment"
          value={filters.deployments}
          onValueChange={(deployments, details) =>
            updateFilters({ ...filters, deployments }, details.source)
          }
        >
          {facets.deployments.map((option) => (
            <FacetCheckbox
              key={option.value}
              value={option.value}
              label={option.label}
              checked={filters.deployments.includes(option.value)}
            />
          ))}
        </CheckboxGroup>
      </div>

      <div className="facet">
        <h3>Open source</h3>
        <label className={filters.openSourceOnly ? 'ck' : undefined}>
          <Checkbox
            checked={filters.openSourceOnly}
            onCheckedChange={(checked, details) =>
              updateFilters({ ...filters, openSourceOnly: checked === true }, details.source)
            }
          >
            <CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
          </Checkbox>
          <span className="facet-text">Open source only</span>
        </label>
      </div>

      {/* Issue #6: the shortlist is personal scan state, not a catalog
          facet — it sits apart from the mock's facet grammar, after the
          last binary refinement and before the expandable topics. The
          trailing count is the rail's own count grammar; the hint line is
          the one piece of instructional print furniture in the rail, there
          because the row-level marking key is otherwise undiscoverable. */}
      <div className="facet">
        <h3>Shortlist</h3>
        <label className={hiddenShortlisted ? 'ck' : undefined}>
          <Checkbox
            id="hide-shortlisted-control"
            aria-label={`Hide shortlisted ${shortlistCount}`}
            checked={hiddenShortlisted}
            onCheckedChange={(checked, details) => {
              const next = checked === true;
              if (details.source === 'agent') {
                flushSync(() => onHiddenShortlistedChange(next));
              } else {
                onHiddenShortlistedChange(next);
              }
            }}
          >
            <CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
          </Checkbox>
          <span className="facet-text">Hide shortlisted</span>
          <em>{shortlistCount}</em>
        </label>
        <CopyAction
          label="Copy shortlist as markdown"
          className="more copymd"
          text={shortlistMarkdown}
          disabled={shortlistCount === 0}
          title={
            shortlistCount === 0
              ? 'Nothing shortlisted yet — press S on a row'
              : `Copy ${shortlistCount} ${shortlistCount === 1 ? 'entry' : 'entries'} as paste-ready markdown`
          }
        />
        <p className="slhint">Press S on a row to mark it</p>
      </div>

      <div className="facet">
        <h3 id="facet-topics">Topics</h3>
        <CheckboxGroup
          aria-labelledby="facet-topics"
          id="facet-topic-options"
          value={filters.topics}
          onValueChange={(topics, details) =>
            updateFilters({ ...filters, topics }, details.source)
          }
        >
          {visibleTopics.map((option) => (
            <FacetCheckbox
              key={option.value}
              value={option.value}
              label={option.label}
              checked={filters.topics.includes(option.value)}
            />
          ))}
        </CheckboxGroup>
        {facets.topics.length > 4 && (
          <button
            type="button"
            className="more"
            aria-expanded={showAllTopics}
            aria-controls="facet-topic-options"
            onClick={() => setShowAllTopics((show) => !show)}
          >
            {showAllTopics ? 'Show fewer topics' : 'Show all topics →'}
          </button>
        )}
      </div>
    </aside>
  );
}
