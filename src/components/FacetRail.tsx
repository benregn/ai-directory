import { facetGroups } from '../placeholder.ts';
import './FacetRail.css';

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
              <input type="checkbox" defaultChecked={option.checked} />
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
