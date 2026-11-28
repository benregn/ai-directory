import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { listings } from '../data/listings.ts';
import type { MatrixRowView } from '../matrix-model.ts';
import { deriveRows } from '../matrix-model.ts';
import { SpecMatrix } from './SpecMatrix.tsx';

const matrixRows = deriveRows(listings);

/**
 * Interaction tests for the plain-rendered spec matrix. Since the owner
 * stripped virtualization, every row is always in the DOM — the round-1/2
 * evaporation scenarios are structurally impossible and their tests are
 * replaced, not preserved. What these pin is the roving-focus logic itself
 * and the deliberate focus placements, which are still real logic.
 *
 * Issue #5 lifted selection to the composition root, so the harness wires
 * it the way App does. The selection contract changed with the wiring:
 * clicking never deselects, arrow keys move selection with focus, and the
 * first row auto-selects when nothing is — the drawer is always populated.
 * Rows arrive filtered through the props (issue #4): the harness mutates
 * the row set by rerendering with a different rows array, exactly what
 * every facet click, compare toggle and search keystroke does in the app.
 */

function Harness({ rows }: { rows: Array<MatrixRowView> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <SpecMatrix
      rows={rows}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onClearFilters={() => undefined}
    />
  );
}

function renderMatrix(rows = matrixRows) {
  return render(<Harness rows={rows} />);
}

function settle() {
  return act(async () => {
    await new Promise((r) => {
      setTimeout(r, 20);
    });
  });
}

function rowsOf(container: HTMLElement): Array<HTMLElement> {
  return [...container.querySelectorAll<HTMLElement>('.mrow')];
}

function stopsOf(container: HTMLElement): Array<HTMLElement> {
  return [...container.querySelectorAll<HTMLElement>('.mrow[tabindex="0"]')];
}

function sortButtonOf(container: HTMLElement, label: string): HTMLElement {
  const button = [...container.querySelectorAll<HTMLElement>('.msort')].find((el) =>
    el.textContent?.includes(label),
  );
  if (!button) {
    throw new Error(`no sort button: ${label}`);
  }
  return button;
}

const orchestrationRows = matrixRows.filter((row) => row.categorySlug === 'agent-orchestration');
const platformRows = matrixRows.filter((row) => row.categorySlug === 'development-platforms');

describe('plain-rendered matrix', () => {
  test('all 239 rows are in the DOM', async () => {
    const { container } = renderMatrix();
    await settle();
    expect(rowsOf(container)).toHaveLength(239);
  });

  test('the first row auto-selects when nothing is selected', async () => {
    const { container } = renderMatrix();
    await settle();
    expect(rowsOf(container)[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('exactly one tab stop exists at all times', async () => {
    const { container } = renderMatrix();
    await settle();
    expect(stopsOf(container)).toHaveLength(1);

    // after focusing a row deep in the list
    const rows = rowsOf(container);
    rows[100]?.focus();
    await settle();
    const stops = stopsOf(container);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(rows[100]);

    // after a re-sort
    fireEvent.click(sortButtonOf(container, 'License'));
    await settle();
    expect(stopsOf(container)).toHaveLength(1);
  });

  test('arrow keys move focus and selection together row to row', async () => {
    const { container } = renderMatrix();
    await settle();
    const rows = rowsOf(container);
    rows[0]?.focus();
    await settle();
    fireEvent.keyDown(rowsOf(container)[0], { key: 'ArrowDown' });
    await settle();
    expect(document.activeElement).toBe(rowsOf(container)[1]);
    expect(rowsOf(container)[1]?.getAttribute('aria-selected')).toBe('true');
    expect(rowsOf(container)[0]?.getAttribute('aria-selected')).toBe('false');
    fireEvent.keyDown(rowsOf(container)[1], { key: 'ArrowUp' });
    await settle();
    expect(document.activeElement).toBe(rowsOf(container)[0]);
    expect(rowsOf(container)[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('End focuses the last row, Home the first', async () => {
    const { container } = renderMatrix();
    await settle();
    const rows = rowsOf(container);
    rows[0]?.focus();
    await settle();
    fireEvent.keyDown(rowsOf(container)[0], { key: 'End' });
    await settle();
    const last = rowsOf(container)[238];
    expect(document.activeElement).toBe(last);
    expect(last?.getAttribute('aria-rowindex')).toBe('240');
    fireEvent.keyDown(rowsOf(container)[238], { key: 'Home' });
    await settle();
    expect(document.activeElement).toBe(rowsOf(container)[0]);
  });

  test('Enter selects the focused row, and again keeps it selected', async () => {
    const { container } = renderMatrix();
    await settle();
    // Focus without selection — what Tab into the grid produces. The first
    // row auto-selected on mount, so use a row further down.
    const fifth = rowsOf(container)[4];
    if (!fifth) {
      throw new Error('no rows rendered');
    }
    fifth.focus();
    await settle();
    expect(fifth.getAttribute('aria-selected')).toBe('false');
    fireEvent.keyDown(fifth, { key: 'Enter' });
    await settle();
    expect(fifth.getAttribute('aria-selected')).toBe('true');
    // The drawer has no nothing-selected state: activation never deselects.
    fireEvent.keyDown(fifth, { key: 'Enter' });
    await settle();
    expect(fifth.getAttribute('aria-selected')).toBe('true');
  });

  test('click focuses and selects the row, and re-click never deselects', async () => {
    const { container } = renderMatrix();
    await settle();
    const third = rowsOf(container)[2];
    if (!third) {
      throw new Error('no rows rendered');
    }
    fireEvent.click(third);
    await settle();
    expect(document.activeElement).toBe(third);
    expect(third.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(third);
    await settle();
    expect(third.getAttribute('aria-selected')).toBe('true');
  });
});

describe('filtered input rows', () => {
  test('filtered rows keep stable catalog numbers and keyboard behavior', async () => {
    const { container } = renderMatrix(platformRows);
    await settle();
    const rows = rowsOf(container);
    expect(rows).toHaveLength(2);
    expect(
      rows
        .map((row) => row.querySelector('.idx')?.textContent)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(['234', '235']);
    expect(stopsOf(container)).toHaveLength(1);

    rows[0]?.focus();
    await settle();
    fireEvent.keyDown(rowsOf(container)[0], { key: 'ArrowDown' });
    await settle();
    expect(document.activeElement).toBe(rowsOf(container)[1]);
  });

  test('mounting with filtered rows auto-selects the first of them', async () => {
    const { container } = renderMatrix(orchestrationRows);
    await settle();
    expect(rowsOf(container)).toHaveLength(74);
    expect(rowsOf(container)[0]?.getAttribute('aria-selected')).toBe('true');
  });

  test('deep focus survives row-set mutation: exactly one tab stop remains', async () => {
    const { container, rerender } = renderMatrix();
    await settle();
    // Focus a deep row outside the incoming subset — past the end of the
    // filtered set, where an index-keyed stop would strand.
    const rows = rowsOf(container);
    const deepIndex = rows.findIndex(
      (row, index) =>
        index > 100 && row.querySelector('.cat')?.textContent !== 'Agent orchestration',
    );
    expect(deepIndex).toBeGreaterThan(100);
    const deep = rows[deepIndex];
    if (!deep) {
      throw new Error('no deep row found');
    }
    const deepName = deep.querySelector('.nname')?.textContent;
    deep.focus();
    await settle();
    expect(stopsOf(container)[0]).toBe(deep);

    rerender(<Harness rows={orchestrationRows} />);
    await settle();
    expect(rowsOf(container)).toHaveLength(74);
    const stops = stopsOf(container);
    expect(stops).toHaveLength(1);
    // the keyed row left the set: the first row takes the stop
    expect(stops[0]).toBe(rowsOf(container)[0]);

    // the stop returns with the row when the row set restores
    rerender(<Harness rows={matrixRows} />);
    await settle();
    expect(stopsOf(container)[0]?.querySelector('.nname')?.textContent).toBe(deepName);
  });

  test('the tab stop tracks the focused row by id across row-set mutation', async () => {
    const { container, rerender } = renderMatrix();
    await settle();
    const rows = rowsOf(container);
    const target = rows.find(
      (row, index) =>
        index > 50 && row.querySelector('.cat')?.textContent === 'Agent orchestration',
    );
    if (!target) {
      throw new Error('no in-category target row found');
    }
    const name = target.querySelector('.nname')?.textContent;
    target.focus();
    await settle();

    rerender(<Harness rows={orchestrationRows} />);
    await settle();
    // Rows before it leave the set, so its index changes — but the stop
    // tracks the row itself, never the number.
    const stops = stopsOf(container);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.querySelector('.nname')?.textContent).toBe(name);
  });

  test('selection survives as state while the selected row is filtered out', async () => {
    const { container, rerender } = renderMatrix();
    await settle();
    const first = rowsOf(container)[0];
    if (!first) {
      throw new Error('no rows rendered');
    }
    const name = first.querySelector('.nname')?.textContent;
    fireEvent.click(first);
    await settle();
    expect(first.getAttribute('aria-selected')).toBe('true');

    rerender(<Harness rows={platformRows} />);
    await settle();
    expect(container.querySelectorAll('.mrow[aria-selected="true"]')).toHaveLength(0);

    rerender(<Harness rows={matrixRows} />);
    await settle();
    const restored = rowsOf(container).find(
      (row) => row.querySelector('.nname')?.textContent === name,
    );
    expect(restored?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('re-sort while a row holds focus', () => {
  // Rows never carry focus across a re-sort: focus moves onto the operated
  // control deliberately, since Safari/Firefox-macOS and programmatic
  // activation never focus clicked buttons.
  for (const path of ['keyboard', 'mouse-click'] as const) {
    test(`${path}-focused row + programmatic re-sort: focus lands on the button`, async () => {
      const { container } = renderMatrix();
      await settle();
      const first = rowsOf(container)[0];
      if (!first) {
        throw new Error('no rows rendered');
      }
      first.focus();
      await settle();
      if (path === 'keyboard') {
        fireEvent.keyDown(first, { key: 'ArrowDown' });
      } else {
        fireEvent.click(first);
      }
      await settle();
      expect(document.activeElement?.classList.contains('mrow')).toBe(true);

      const license = sortButtonOf(container, 'License');
      fireEvent.click(license);
      await settle();
      expect(document.activeElement).toBe(license);

      // deep scrolling changes nothing: the header never unrenders
      const scroller = container.querySelector<HTMLElement>('.matrix-scroll');
      if (!scroller) {
        throw new Error('no scroller');
      }
      fireEvent.scroll(scroller, { target: { scrollTop: 4000 } });
      await settle();
      expect(document.activeElement).toBe(license);
      expect(document.activeElement).not.toBe(document.body);
    });
  }

  test('selection survives re-sort by row id', async () => {
    const { container } = renderMatrix();
    await settle();
    const first = rowsOf(container)[0];
    if (!first) {
      throw new Error('no rows rendered');
    }
    const name = first.querySelector('.nname')?.textContent;
    fireEvent.click(first);
    await settle();
    expect(first.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(sortButtonOf(container, 'Product'));
    await settle();
    const moved = rowsOf(container).find(
      (row) => row.querySelector('.nname')?.textContent === name,
    );
    expect(moved?.getAttribute('aria-selected')).toBe('true');
  });
});
