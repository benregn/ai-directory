import { flushSync } from 'react-dom';
import { Input } from '@ui-sdk/react/input';
import './Masthead.css';

/**
 * Dark masthead: product tile + FACTORY INDEX wordmark, CAT. NO. furniture,
 * primary nav, and the catalog search field with the register count.
 */
export function Masthead({
  query,
  productCount,
  categoryCount,
  onQueryChange,
}: {
  query: string;
  productCount: number;
  categoryCount: number;
  onQueryChange: (query: string) => void;
}) {
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
        <Input
          type="search"
          placeholder={`Search ${productCount} products — name, topic, license…`}
          aria-label="Search products"
          value={query}
          onValueChange={(value, details) => {
            if (details.source === 'agent') {
              flushSync(() => onQueryChange(value));
            } else {
              onQueryChange(value);
            }
          }}
        />
        <span className="count mono">
          {productCount} PRODUCTS / {categoryCount} CATEGORIES
        </span>
      </div>
    </header>
  );
}
