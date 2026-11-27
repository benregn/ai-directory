import './Masthead.css';

/**
 * Dark masthead: product tile + FACTORY INDEX wordmark, CAT. NO. furniture,
 * primary nav, and the typeahead search field with the register count.
 */
export function Masthead() {
  return (
    <header className="masthead">
      <div className="mark">
        <span className="tile">F</span>
        <b>Factory Index</b>
        <span className="mono catno">CAT. NO. FIX-239</span>
      </div>
      <nav className="mastnav" aria-label="Primary">
        <a className="on" href="#">
          Index
        </a>
        <a href="#">Categories</a>
        <a href="#">Topics</a>
        <a href="#">About</a>
      </nav>
      <div className="mastsearch">
        <input
          type="search"
          placeholder="Search 239 products — name, topic, license…"
          aria-label="Search products"
        />
        <span className="count mono">239 PRODUCTS / 8 CATEGORIES</span>
      </div>
    </header>
  );
}
