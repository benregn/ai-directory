import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SpecMatrix } from './SpecMatrix.tsx';

/**
 * Regression tests for review round 1, blocking finding 1: the roving tab
 * stop evaporated under virtualization. jsdom has no layout — clientHeight
 * is zero — but the virtualizer's window still tracks scrollTop, which is
 * exactly what these scenarios need.
 *
 * The invariants under test:
 *  A. Scrolled deep with no keyboard interaction, the grid still holds a
 *     tab stop — otherwise it is keyboard-unreachable.
 *  B. DOM focus alone (what Tab produces) is enough to protect the focused
 *     row: scroll it away and focus must not drop to the page.
 */

function settle() {
  return act(async () => {
    await new Promise((r) => {
      setTimeout(r, 20);
    });
  });
}

function scrollerOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.matrix-scroll');
  if (!el) {
    throw new Error('no matrix scroller');
  }
  return el;
}

function rowsOf(container: HTMLElement): Array<HTMLElement> {
  return [...container.querySelectorAll<HTMLElement>('.mrow')];
}

function stopsOf(container: HTMLElement): Array<HTMLElement> {
  return [...container.querySelectorAll<HTMLElement>('.mrow[tabindex="0"]')];
}

async function scrollDeep(container: HTMLElement) {
  const scroller = scrollerOf(container);
  fireEvent.scroll(scroller, { target: { scrollTop: 3000 } });
  await settle();
}

describe('roving tab stop under virtualization', () => {
  test('exactly one tab stop exists in the grid on first render', async () => {
    const { container } = render(<SpecMatrix />);
    await settle();
    expect(stopsOf(container)).toHaveLength(1);
  });

  test('path A: scrolled deep with no interaction, a tab stop still exists', async () => {
    const { container } = render(<SpecMatrix />);
    await settle();
    await scrollDeep(container);
    // The pre-fix failure: zero stops once row 0 unrendered. The stop must
    // sit on a row that is actually rendered.
    const stops = stopsOf(container);
    expect(stops).toHaveLength(1);
    expect(rowsOf(container)).toContain(stops[0]);
  });

  test('path B: plain DOM focus protects the row — scroll does not drop focus', async () => {
    const { container } = render(<SpecMatrix />);
    await settle();
    const first = rowsOf(container)[0];
    if (!first) {
      throw new Error('no rows rendered');
    }
    // What Tab produces: DOM focus, no key pressed, no click.
    first.focus();
    await settle();
    expect(document.activeElement).toBe(first);

    await scrollDeep(container);

    // The pre-fix failure: the row unrendered and activeElement fell to BODY.
    // With DOM focus synced, keep() covers the row wherever the scroller is.
    expect(document.activeElement).toBe(first);
    expect(document.activeElement).not.toBe(document.body);
    expect(rowsOf(container)).toContain(document.activeElement);
  });

  test('arrow keys still move focus after the scroll window moves', async () => {
    const { container } = render(<SpecMatrix />);
    await settle();
    const first = rowsOf(container)[0];
    if (!first) {
      throw new Error('no rows rendered');
    }
    first.focus();
    await settle();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    await settle();
    const focused = document.activeElement;
    expect(focused).not.toBe(first);
    expect(focused?.classList.contains('mrow')).toBe(true);
    // focus followed the move: exactly one stop, on the focused row
    const stops = stopsOf(container);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(focused);
  });

  test('enter on the focused row selects it', async () => {
    const { container } = render(<SpecMatrix />);
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
    expect(first.classList.contains('sel')).toBe(true);
  });
});

function sortButtonOf(container: HTMLElement, label: string): HTMLElement {
  const button = [...container.querySelectorAll<HTMLElement>('.msort')].find((el) =>
    el.textContent?.includes(label),
  );
  if (!button) {
    throw new Error(`no sort button: ${label}`);
  }
  return button;
}

describe('re-sort while a row holds focus', () => {
  // Round-2 blocking finding: with focus on a row, activating a sort header
  // does not move focus in Safari/Firefox-macOS or on programmatic clicks.
  // React reuses the row element for a different product, no focus event
  // fires, and scrolling dropped focus to BODY. The deliberate fix puts
  // focus on the operated control — the sort button — in every browser.
  for (const path of ['keyboard', 'mouse-click'] as const) {
    test(`${path}-focused row + programmatic re-sort: focus lands on the button and never drops`, async () => {
      const { container } = render(<SpecMatrix />);
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

      // Programmatic activation: the no-focus-on-click case, standing in
      // for Safari and Firefox on macOS.
      const license = sortButtonOf(container, 'License');
      fireEvent.click(license);
      await settle();

      expect(document.activeElement).toBe(license);

      await scrollDeep(container);
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(license);
    });
  }

  test('after re-sort the rows are keyboard-reachable again', async () => {
    const { container } = render(<SpecMatrix />);
    await settle();
    const first = rowsOf(container)[0];
    if (!first) {
      throw new Error('no rows rendered');
    }
    first.focus();
    await settle();
    fireEvent.click(sortButtonOf(container, 'License'));
    await settle();
    // focusIndex reset with the sort: exactly one stop, on a rendered row
    const stops = stopsOf(container);
    expect(stops).toHaveLength(1);
    expect(rowsOf(container)).toContain(stops[0]);
  });
});
