import { Fragment } from 'react';
import { stripParams } from '../placeholder.ts';
import './ParameterStrip.css';

/**
 * Parameter strip: reflects active filters as machine parameters with a
 * result count. Static placeholder grammar; live filter state is issue #4.
 */
export function ParameterStrip() {
  return (
    <div className="strip">
      {stripParams.map((param) => (
        <Fragment key={param.label}>
          <span>
            {param.clearable && <span className="x">×</span>}
            {param.label}: <b>{param.value}</b>
          </span>
          <span className="sep">·</span>
        </Fragment>
      ))}
      <span className="res">38 results</span>
      <a className="clear" href="#">
        Clear all
      </a>
    </div>
  );
}
