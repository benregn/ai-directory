import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { listings } from '../data/listings.ts';
import { deriveRows } from '../matrix-model.ts';
import { SpecMatrix } from './SpecMatrix.tsx';

const matrixRows = deriveRows(listings);
const clearFilters = () => undefined;

function renderMatrix(rows = matrixRows) {
  return render(<SpecMatrix rows={rows} onClearFilters={clearFilters} />);
}

/**
 * Interaction tests for the plain-rendered spec matrix. Since the owner
 * stripped virtualization, every row is always in the DOM — the round-1/2
 * evaporation scenarios are structurally impossible and their tests are
 * replaced, not preserved. What these pin is the roving-focus logic itself
 * and the deliberate focus placements, which are still real logic.
 */

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

describe('plain-rendered matrix', () => {
  test('all 239 rows are in the DOM', async () => {
    const { container } = renderMatrix();
    await settle();
    expect(rowsOf(container)).toHaveLength(239);
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

  test('arrow keys move focus row to row', async () => {
    const { container } = renderMatrix();
    await settle();
    const rows = rowsOf(container);
    rows[0]?.focus();
    await settle();
    fireEvent.keyDown(rowsOf(container)[0], { key: 'ArrowDown' });
    await settle();
    expect(document.activeElement).toBe(rowsOf(container)[1]);
    fireEvent.keyDown(rowsOf(container)[1], { key: 'ArrowUp' });
    await settle();
    expect(document.activeElement).toBe(rowsOf(container)[0]);
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

  test('Enter selects the focused row, and again deselects', async () => {
    const { container } = renderMatrix();
    await settle();
    const first = rowsOf(container)[0];
    if (!first) {
      throw new Error('no rows rendered');
    }
    first.focus();
    await settle();
    fireEvent.keyDown(first, { key: 'Enter' });
    await settle();
    expect(first.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(first, { key: 'Enter' });
    await settle();
    expect(first.getAttribute('aria-selected')).toBe('false');
  });

  test('click focuses and selects the row', async () => {
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

describe('filtered input rows', () => {
  const filtered = matrixRows.filter((row) => row.categorySlug === 'development-platforms');

  test('filtered rows keep stable catalog numbers and keyboard behavior', async () => {
    const { container } = renderMatrix(filtered);
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

  test('a focused row filtered out returns the roving stop to the first visible row', async () => {
    const utils = render(<SpecMatrix rows={matrixRows} onClearFilters={clearFilters} />);
    await settle();
    const rows = rowsOf(utils.container);
    rows[100]?.focus();
    await settle();
    expect(stopsOf(utils.container)[0]).toBe(rows[100]);

    utils.rerender(<SpecMatrix rows={filtered} onClearFilters={clearFilters} />);
    await settle();
    const stops = stopsOf(utils.container);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(rowsOf(utils.container)[0]);
  });

  test('selection survives as state while the selected row is filtered out', async () => {
    const utils = render(<SpecMatrix rows={matrixRows} onClearFilters={clearFilters} />);
    await settle();
    const first = rowsOf(utils.container)[0];
    if (!first) {
      throw new Error('no rows rendered');
    }
    const name = first.querySelector('.nname')?.textContent;
    fireEvent.click(first);
    await settle();
    expect(first.getAttribute('aria-selected')).toBe('true');

    utils.rerender(<SpecMatrix rows={filtered} onClearFilters={clearFilters} />);
    await settle();
    expect(utils.container.querySelectorAll('.mrow[aria-selected="true"]')).toHaveLength(0);

    utils.rerender(<SpecMatrix rows={matrixRows} onClearFilters={clearFilters} />);
    await settle();
    const restored = rowsOf(utils.container).find(
      (row) => row.querySelector('.nname')?.textContent === name,
    );
    expect(restored?.getAttribute('aria-selected')).toBe('true');
  });
});
