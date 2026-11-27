import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createVirtualizer } from '@ui-sdk/core';
import { listings } from '../data/listings.ts';
import type { MatrixRowView, SortColumn, SortDirection } from '../matrix-model.ts';
import { deriveRows, initialDirection, sortRows } from '../matrix-model.ts';
import './SpecMatrix.css';

/**
 * Spec matrix: all 239 rows in one scroll, virtualized with ui-sdk's
 * createVirtualizer, sorted by every column, absence as the dimmed dash.
 *
 * Density deviates from the mock deliberately (issue #3: 26–28px rows, not
 * the mock's 48px): the row furniture is the mock's — index, tile, name,
 * summary, category, license, deployment, oss, stars — compressed to a
 * single truncated line per row. The tile shrinks 24px → 16px and the
 * two-line name/summary stack becomes one line; nothing else is dropped.
 *
 * Rows are fixed-height by construction, so the virtualizer's estimate is
 * exact and no measurement pass is needed. The sticky header is exactly
 * HEAD_H tall: the virtualizer's scrollMargin depends on it.
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

/**
 * The virtualizer outlives any single render, so its closures read the live
 * ordering and focus through refs — they only run post-commit (scroll,
 * refresh, scrollToIndex), never during render. Fixed-height rows are never
 * measured, so no per-row key option is needed: sizes can't drift.
 */
function createMatrixVirtualizer(
  rowsRef: { current: Array<MatrixRowView> },
  focusIndexRef: { current: number | null },
) {
  return createVirtualizer({
    count: () => rowsRef.current.length,
    estimate: () => ROW_H,
    overscan: 6,
    scrollMargin: HEAD_H,
    keep: () => (focusIndexRef.current === null ? [] : [focusIndexRef.current]),
  });
}

function Fact({ value, className }: { value: string | null; className: string }) {
  return (
    <div className={value === null ? `${className} dim` : className} role="gridcell">
      {value ?? '—'}
    </div>
  );
}

function Row({
  row,
  item,
  selected,
  tabStop,
  onPress,
  onKey,
  rowRef,
}: {
  row: MatrixRowView;
  item: { index: number; start: number };
  selected: boolean;
  tabStop: boolean;
  onPress: (index: number) => void;
  onKey: (event: ReactKeyboardEvent, index: number) => void;
  rowRef: (index: number, el: HTMLElement | null) => void;
}) {
  return (
    <div
      className={selected ? 'mrow sel' : 'mrow'}
      role="row"
      aria-rowindex={item.index + 2}
      aria-selected={selected}
      tabIndex={tabStop ? 0 : -1}
      style={{ transform: `translateY(${item.start}px)` }}
      ref={(el) => rowRef(item.index, el)}
      onClick={() => onPress(item.index)}
      onKeyDown={(event) => onKey(event, item.index)}
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

  // The virtualizer is created once and reads the live ordering through
  // refs; refresh() re-reads it after every sort or focus change. The refs
  // sync in the first effect so every later effect and handler reads the
  // committed ordering, never a stale one.
  const rowsRef = useRef(sorted);
  const focusIndexRef = useRef(focusIndex);
  useEffect(() => {
    rowsRef.current = sorted;
    focusIndexRef.current = focusIndex;
  }, [sorted, focusIndex]);

  // Passing the ref objects, not their values: the factory's closures read
  // .current only post-commit. This is the latest-ref pattern the rule means
  // to protect, not a render-time read.
  // oxlint-disable-next-line react/refs
  const [virtual] = useState(() => createMatrixVirtualizer(rowsRef, focusIndexRef));

  const subscribe = useCallback(
    (listener: () => void) => virtual.subscribe(listener),
    [virtual],
  );
  const getItems = useCallback(() => virtual.items(), [virtual]);
  const items = useSyncExternalStore(subscribe, getItems);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    return virtual.connect(el);
  }, [virtual]);

  useEffect(() => {
    virtual.refresh();
    const el = scrollerRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [virtual, sorted]);

  const rowEls = useRef(new Map<number, HTMLElement>());
  const rowRef = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      rowEls.current.set(index, el);
    } else {
      rowEls.current.delete(index);
    }
  }, []);

  // Focus moves only on explicit intent (arrow keys, row press) — never on
  // scroll-driven re-renders, or scrolling the matrix would steal focus back
  // from anywhere else on the page. preventScroll: the virtualizer already
  // scrolled the row into view.
  const pendingFocus = useRef(false);
  useEffect(() => {
    virtual.refresh();
    if (focusIndex !== null && pendingFocus.current) {
      const el = rowEls.current.get(focusIndex);
      if (el) {
        el.focus({ preventScroll: true });
        pendingFocus.current = false;
      }
    }
  }, [virtual, focusIndex, items]);

  function pressHeader(column: SortColumn) {
    setFocusIndex(null);
    if (column === sortColumn) {
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(initialDirection(column));
    }
  }

  function pressRow(index: number) {
    pendingFocus.current = true;
    setFocusIndex(index);
    const row = rowsRef.current[index];
    if (row) {
      setSelectedId((current) => (current === row.id ? null : row.id));
    }
  }

  function moveFocus(index: number) {
    const last = rowsRef.current.length - 1;
    const next = Math.max(0, Math.min(last, index));
    pendingFocus.current = true;
    setFocusIndex(next);
    virtual.scrollToIndex(next);
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
        moveFocus(rowsRef.current.length - 1);
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
                onClick={() => pressHeader(header.column)}
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
      <div className="mbody" role="presentation" style={{ height: virtual.size() }}>
        {items.map((item) => {
          const row = sorted[item.index];
          if (!row) {
            return null;
          }
          return (
            <Row
              key={item.key}
              row={row}
              item={item}
              selected={row.id === selectedId}
              tabStop={focusIndex === null ? item.index === 0 : focusIndex === item.index}
              onPress={pressRow}
              onKey={keyRow}
              rowRef={rowRef}
            />
          );
        })}
      </div>
    </div>
  );
}
