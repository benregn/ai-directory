import { matrixRows } from '../placeholder.ts';
import './SpecMatrix.css';

/** Machine-fact cell: absent data renders as the dimmed dash, never filler. */
function Fact({ value, className }: { value: string | null; className: string }) {
  return (
    <td className={value === null ? `${className} dim` : className}>
      {value ?? '—'}
    </td>
  );
}

/**
 * Spec-matrix table frame: fixed column grid, machine-fact cells, absent
 * data as dashes. Rows are static placeholders; the wired, sortable,
 * virtualized matrix is issue #4.
 */
export function SpecMatrix() {
  return (
    <table className="matrix">
      <colgroup>
        <col className="c-idx" />
        <col className="c-name" />
        <col className="c-cat" />
        <col className="c-lic" />
        <col className="c-dep" />
        <col className="c-oss" />
        <col className="c-star" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>
            Product<span className="srt">↕</span>
          </th>
          <th>
            Category<span className="srt">↕</span>
          </th>
          <th>
            License<span className="srt">↕</span>
          </th>
          <th>Deployment</th>
          <th>OSS</th>
          <th className="r act">
            Stars<span className="srt">▼</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {matrixRows.map((row) => (
          <tr className={row.selected ? 'sel' : undefined} key={row.idx}>
            <td className="idx">{row.idx}</td>
            <td>
              <div className="ncell">
                <span className="mtile">{row.initial}</span>
                <div className="ntxt">
                  <div className="nname">
                    <a href="#">{row.name}</a>
                  </div>
                  <div className="nsum">{row.summary}</div>
                </div>
              </div>
            </td>
            <td className="cat">{row.category}</td>
            <Fact className="lic" value={row.license} />
            <Fact className="dep" value={row.deployment} />
            <Fact className="oss" value={row.oss} />
            <Fact className="star" value={row.stars} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
