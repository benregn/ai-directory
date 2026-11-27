import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { listings } from '../data/listings.ts';
import type { MatrixRowView, SortColumn, SortDirection } from '../matrix-model.ts';
import { deriveRows, initialDirection, sortRows } from '../matrix-model.ts';
import './SpecMatrix.css';

/**
 * Spec matrix: all 239 rows plain-rendered in one scroll — owner decision,
 * no virtualization: 239 rows is a few thousand DOM nodes, which browsers
 * render trivially, and every defect the review rounds caught was
 * virtualization-induced complexity. The behavioral contract is unchanged:
 * 27px rows, seven sortable columns, click/keyboard selection, roving tab
 * stop — all of it trivially implementable because every row is always in
 * the DOM: focus() scrolls a row into view on its own, and scroll-margin-top
 * on the rows keeps them clear of the sticky header, no machinery needed.
 *
 * Density deviates from the mock deliberately (issue #3: 26–28px rows, not
 * the mock's 48px): the row furniture is the mock's — index, tile, name,
 * summary, category, license, deployment, oss, stars — compressed to a
 * single truncated line per row. The tile shrinks 24px → 16px and the
 * two-line name/summary stack becomes one line; nothing else is dropped.
 */
const ROW_H = 27;
const HEAD_H = 30;

interface HeaderSpec {
  column: SortColumn;
  label: string;
  right?: boolean;
}

const HEADERS: Array<HeaderSpec> = [
  { column: 'idx', label: '#' },
  { column: 'name', label: 'Product' },
  { column: 'cat', label: 'Category' },
  { column: 'lic', label: 'License' },
  { column: 'dep', label: 'Deployment' },
  { column: 'oss', label: 'OSS' },
  { column: 'star', label: 'Stars', right: true },
];

function Fact({ value, className }: { value: string | null; className: string }) {
  return (
    <div className={value === null ? `${className} dim` : className} role="gridcell">
      {value ?? '—'}
    </div>
  );
}

function Row({
  row,
  index,
  selected,
  tabStop,
  onPress,
  onKey,
  onFocus,
  rowRef,
}: {
  row: MatrixRowView;
  index: number;
  selected: boolean;
  tabStop: boolean;
  onPress: (index: number) => void;
  onKey: (event: ReactKeyboardEvent, index: number) => void;
  onFocus: (index: number) => void;
  rowRef: (id: string, el: HTMLElement | null) => void;
}) {
  return (
    <div
      className={selected ? 'mrow sel' : 'mrow'}
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      tabIndex={tabStop ? 0 : -1}
      ref={(el) => rowRef(row.id, el)}
      onClick={() => onPress(index)}
      onKeyDown={(event) => onKey(event, index)}
      onFocus={() => onFocus(index)}
    >
      <div className="idx" role="gridcell">
        {row.entryLabel}
      </div>
      <div className="ncell" role="gridcell">
        <span className="mtile">{row.initial}</span>
        <span className="nname">{row.name}</span>
        <span className="nsum">{row.summary}</span>
      </div>
      <div className="cat" role="gridcell">
        {row.category}
      </div>
      <Fact className="lic" value={row.licenseLabel} />
      <Fact className="dep" value={row.deploymentLabel} />
      <Fact className="oss" value={row.ossYes ? 'YES' : null} />
      <Fact className="star" value={row.starsLabel} />
    </div>
  );
}

export function SpecMatrix() {
  const rows = useMemo(() => deriveRows(listings), []);
  const [sortColumn, setSortColumn] = useState<SortColumn>('star');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const sorted = useMemo(
    () => sortRows(rows, sortColumn, sortDirection),
    [rows, sortColumn, sortDirection],
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const rowRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      rowEls.current.set(id, el);
    } else {
      rowEls.current.delete(id);
    }
  }, []);

  // A re-sort is a new scan: start at the top of the new ordering.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [sorted]);

  function pressHeader(event: ReactMouseEvent<HTMLButtonElement>, column: SortColumn) {
    // Rows never carry focus across a re-sort: focus moves onto the control
    // deliberately, because Safari and Firefox on macOS never focus clicked
    // buttons and programmatic activation never does. Standard, correct
    // focus placement in every browser.
    event.currentTarget.focus();
    setFocusIndex(null);
    if (column === sortColumn) {
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(initialDirection(column));
    }
  }

  // DOM focus — exactly what Tab produces — syncs the roving stop. No
  // scrolling, no selecting: focus alone.
  function focusRow(index: number) {
    setFocusIndex(index);
  }

  function pressRow(index: number) {
    const row = sorted[index];
    if (!row) {
      return;
    }
    // Deliberate focus, as with the sort buttons: clicking a row must put
    // keyboard focus on it in every browser, not almost every browser.
    rowEls.current.get(row.id)?.focus({ preventScroll: true });
    setFocusIndex(index);
    setSelectedId((current) => (current === row.id ? null : row.id));
  }

  function moveFocus(index: number) {
    const next = Math.max(0, Math.min(sorted.length - 1, index));
    const row = sorted[next];
    if (!row) {
      return;
    }
    // Every row is always in the DOM, so focus lands synchronously and the
    // browser scrolls it into view — scroll-margin-top keeps it clear of
    // the sticky header. No effects, no retries, nothing to lose.
    rowEls.current.get(row.id)?.focus();
  }

  function keyRow(event: ReactKeyboardEvent, index: number) {
    const page = Math.max(
      1,
      Math.floor(((scrollerRef.current?.clientHeight ?? 600) - HEAD_H) / ROW_H) - 1,
    );
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(0);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(sorted.length - 1);
        break;
      case 'PageDown':
        event.preventDefault();
        moveFocus(index + page);
        break;
      case 'PageUp':
        event.preventDefault();
        moveFocus(index - page);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        pressRow(index);
        break;
    }
  }

  return (
    <div
      className="matrix-scroll"
      role="grid"
      aria-label="Product specification matrix"
      aria-rowcount={sorted.length + 1}
      ref={scrollerRef}
    >
      <div className="mhead" role="row" aria-rowindex={1}>
        {HEADERS.map((header) => {
          const active = header.column === sortColumn;
          return (
            <div
              className={header.right ? 'mth r' : 'mth'}
              role="columnheader"
              aria-sort={
                active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
              }
              key={header.column}
            >
              <button
                className={active ? 'msort act' : 'msort'}
                type="button"
                onClick={(event) => pressHeader(event, header.column)}
              >
                {header.label}
                <span className="srt">
                  {active ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {sorted.map((row, index) => (
        <Row
          key={row.id}
          row={row}
          index={index}
          selected={row.id === selectedId}
          tabStop={focusIndex === null ? index === 0 : focusIndex === index}
          onPress={pressRow}
          onKey={keyRow}
          onFocus={focusRow}
          rowRef={rowRef}
        />
      ))}
    </div>
  );
}
