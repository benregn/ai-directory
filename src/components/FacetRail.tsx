import { facetGroups } from '../placeholder.ts';
import './FacetRail.css';

/* Placeholder inputs are controlled with a no-op change handler, so clicks
   cannot take them out of sync with the static parameter strip; issue #4
   replaces them with real faceting. Renders identically to the mock. */
const noop = () => undefined;

/**
 * Left facet rail. Shell layer renders the rail head and section structure
 * with static placeholder options; interactive faceting lands in issue #4.
 */
export function FacetRail() {
  return (
    <aside className="rail">
      <div className="railhead">
        <b>Refine by</b>
        <span className="mono">239 / 239</span>
      </div>
      {facetGroups.map((group) => (
        <div className="facet" key={group.title}>
          <h3>{group.title}</h3>
          {group.options.map((option) => (
            <label className={option.checked ? 'ck' : undefined} key={option.label}>
              <input type="checkbox" checked={option.checked === true} onChange={noop} />
              {option.label}
              {option.count !== undefined && <em>{option.count}</em>}
            </label>
          ))}
          {group.moreLink && (
            <a className="more" href="#">
              {group.moreLink}
            </a>
          )}
        </div>
      ))}
    </aside>
  );
}
