import { drawerCompare, drawerFacts, drawerShell } from '../placeholder.ts';
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
          <span className="dpill">{drawerShell.categoryPill}</span>
          <button type="button" className="xbtn">
            ✕
          </button>
        </div>
        <h2>{drawerShell.name}</h2>
        <div className="dsub">{drawerShell.sub}</div>
      </div>
      <div className="dactions">
        {drawerShell.actions.map((action) => (
          <button type="button" className={action.primary ? 'pri' : undefined} key={action.label}>
            {action.label}
          </button>
        ))}
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
        <p>{drawerShell.overview}</p>
      </div>
      <div className="dsec cmp">
        <h4>{drawerShell.compareHead}</h4>
        {drawerCompare.map((item) => (
          <a href="#" key={item.name}>
            {item.name}
            <em>{item.stars}</em>
          </a>
        ))}
      </div>
      <div className="dfoot">
        <span>{drawerShell.footerLeft}</span>
        <span>{drawerShell.footerRight}</span>
      </div>
    </section>
  );
}
