import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { Toggle } from '@ui-sdk/react/toggle';
import type { Listing } from '../data/types.ts';
import {
  compareItemsOf,
  entryLabelOf,
  factsOf,
  footerRightOf,
  subLineOf,
  websiteHrefOf,
} from '../drawer-model.ts';
import './DetailDrawer.css';

/**
 * Right detail drawer column: canon structure (pill, name, actions, fact
 * rows, sections, entry-position footer) at print density, wired to the
 * selected listing's real detail payload. Every string derives through
 * drawer-model — absence renders as `—`, never filler.
 *
 * Furniture decisions:
 * - Shortlist is a real control since issue #6: a ui-sdk Toggle with
 *   aria-pressed, filled like `.pri` while pressed. The label stays
 *   "Shortlist" in both states — screen readers announce the pressed
 *   state, and a changing label would confuse exactly them.
 * - The ✕ remains inert. Closing the drawer has no honest meaning yet:
 *   the mock shows no collapsed state and no reopen affordance, and the
 *   shell geometry is issue #2's.
 * - Same-class rows are buttons, not links: they select that record in
 *   this viewer (every similar item resolves to a dataset record), they
 *   don't navigate anywhere.
 */
export function DetailDrawer({
  listing,
  entry,
  total,
  shortlisted,
  onToggleShortlist,
  onCompare,
  onSelect,
}: {
  listing: Listing | null;
  /** Stable 1-based catalog position of the listing, null when unknown. */
  entry: number | null;
  total: number;
  shortlisted: boolean;
  onToggleShortlist: (id: string, marked?: boolean) => void;
  onCompare: (categorySlug: string) => void;
  onSelect: (id: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Null is transient: the matrix auto-selects its first row in a layout
  // effect, before paint. The column frame stays so the shell never jumps.
  if (listing === null) {
    return <section className="drawer" aria-label="Selected product" />;
  }

  const websiteHref = websiteHrefOf(listing);

  // Same-class activation re-renders the drawer for a different record, so
  // the activating button unmounts and focus would drop to <body>. The
  // destination is deliberately the new record's heading, not the matrix
  // row: same-class navigation is inspection inside the drawer — chaining
  // through a cluster of similar products — and the route-change pattern
  // (focus the new heading) lets keyboard users chain again with one Tab
  // while screen readers announce the new record immediately. flushSync
  // commits the selection before focus moves; mouse activation shows no
  // focus ring, so only keyboard modality sees it.
  function pressCompareItem(id: string) {
    flushSync(() => {
      onSelect(id);
    });
    headingRef.current?.focus();
  }

  return (
    <section className="drawer" aria-label="Selected product">
      <div className="dtop">
        <div className="dmeta-row">
          <span className="dpill">{listing.category}</span>
          {/* inert furniture (see module doc): not focusable, not announced —
              a button that does nothing must not promise action */}
          <button type="button" className="xbtn" aria-hidden="true" tabIndex={-1}>
            ✕
          </button>
        </div>
        <h2 ref={headingRef} tabIndex={-1}>
          {listing.name}
        </h2>
        <div className="dsub">{subLineOf(listing)}</div>
      </div>
      <div className="dactions">
        {websiteHref === null ? (
          <button type="button" className="pri" disabled>
            Open listing
          </button>
        ) : (
          <a className="pri" href={websiteHref} target="_blank" rel="noopener noreferrer">
            Open listing
          </a>
        )}
        <button type="button" onClick={() => onCompare(listing.categorySlug)}>
          Compare
        </button>
        <Toggle
          pressed={shortlisted}
          onPressedChange={(pressed, details) => {
            // same agent-source contract as the rail and masthead: the
            // change must commit synchronously for the agent to observe it
            if (details.source === 'agent') {
              flushSync(() => onToggleShortlist(listing.id, pressed));
            } else {
              onToggleShortlist(listing.id, pressed);
            }
          }}
          title="Shortlist — press S on a focused matrix row for the same action"
        >
          Shortlist
        </Toggle>
      </div>
      <div className="facts">
        {factsOf(listing).map(({ label, value, absent }) => (
          <div className="fact" key={label}>
            <span>{label}</span>
            <span className={absent ? 'dim' : undefined}>{value}</span>
          </div>
        ))}
      </div>
      <div className="dbody">
        <div className="dsec">
          <h4>Overview</h4>
          {listing.detail.overview.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
        <div className="dsec cmp">
          <h4>Same class · starred</h4>
          {compareItemsOf(listing).map((item) => (
            <button type="button" key={item.id} onClick={() => pressCompareItem(item.id)}>
              {item.name}
              <em className={item.starsLabel === null ? 'dim' : undefined}>
                {item.starsLabel ?? '—'}
              </em>
            </button>
          ))}
        </div>
      </div>
      <div className="dfoot">
        <span>{entryLabelOf(entry ?? 0, total)}</span>
        <span>{footerRightOf(listing)}</span>
      </div>
    </section>
  );
}
