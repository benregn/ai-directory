import { flushSync } from 'react-dom';
import { Input } from '@ui-sdk/react/input';
import { CopyAction } from './CopyAction.tsx';
import './Masthead.css';

/**
 * Dark masthead: product tile + FACTORY INDEX wordmark, CAT. NO. furniture,
 * primary nav, and the catalog search field with the register count.
 * Issue #6's Copy link lives here rather than the parameter strip: the
 * strip's full default parameter readout leaves no honest room for it,
 * and a whole-viewer share action is global chrome — which is what the
 * masthead is. It sits outside the inert nav furniture, in the search
 * cluster, visibly separate from the links that do nothing.
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
        <CopyAction
          label="Copy link"
          className="copylink"
          text={() => window.location.href}
          title="Copy the shareable URL — filters, selection and shortlist"
        />
        <span className="count mono">
          {productCount} PRODUCTS / {categoryCount} CATEGORIES
        </span>
      </div>
    </header>
  );
}
