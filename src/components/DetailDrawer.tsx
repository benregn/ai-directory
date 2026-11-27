import { drawerCompare, drawerFacts } from '../placeholder.ts';
import './DetailDrawer.css';

/**
 * Right detail drawer column: canon structure (pill, name, actions, fact
 * rows, sections, entry-position footer) at print density. Content is a
 * static placeholder showing the frame with a selection; the wired drawer
 * is issue #5.
 */
export function DetailDrawer() {
  return (
    <section className="drawer" aria-label="Selected product">
      <div className="dtop">
        <div className="dmeta-row">
          <span className="dpill">Agent orchestration</span>
          <button type="button" className="xbtn">
            ✕
          </button>
        </div>
        <h2>Aeon</h2>
        <div className="dsub">★ 777 · MIT · open source</div>
      </div>
      <div className="dactions">
        <button type="button" className="pri">
          Open listing
        </button>
        <button type="button">Compare</button>
        <button type="button">Shortlist</button>
      </div>
      <div className="facts">
        {drawerFacts.map(([label, value]) => (
          <div className="fact" key={label}>
            <span>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      <div className="dsec">
        <h4>Overview</h4>
        <p>
          Open-source framework that runs unattended on GitHub Actions,
          dispatching markdown-defined skills and repairing failing ones.
        </p>
      </div>
      <div className="dsec cmp">
        <h4>Same class · starred</h4>
        {drawerCompare.map((item) => (
          <a href="#" key={item.name}>
            {item.name}
            <em>{item.stars}</em>
          </a>
        ))}
      </div>
      <div className="dfoot">
        <span>ENTRY 004 / 239</span>
        <span>MIT · OSS</span>
      </div>
    </section>
  );
}
