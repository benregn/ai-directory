import { act, fireEvent, render, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { describe, expect, test } from 'vitest';
import App from './App.tsx';

function visibleRowCount(container: HTMLElement): number {
  return container.querySelectorAll('.mrow').length;
}

function stripText(container: HTMLElement): string {
  return container.querySelector('.strip')?.textContent?.replaceAll(/\s+/g, ' ') ?? '';
}

function railheadText(container: HTMLElement): string {
  return container.querySelector('.railhead')?.textContent?.replaceAll(/\s+/g, ' ') ?? '';
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

function drawer(): HTMLElement {
  const el = document.querySelector<HTMLElement>('section.drawer');
  if (!el) {
    throw new Error('no drawer rendered');
  }
  return el;
}

function drawerName(): string | null | undefined {
  return drawer().querySelector('h2')?.textContent;
}

function rowName(row: HTMLElement | undefined): string | null | undefined {
  return row?.querySelector('.nname')?.textContent;
}

function compareButton(): HTMLElement {
  const button = [...drawer().querySelectorAll('button')].find(
    (el) => el.textContent === 'Compare',
  );
  if (!button) {
    throw new Error('no compare button');
  }
  return button;
}

describe('filtering composition', () => {
  test('starts unfiltered with every parameter explicitly any', () => {
    const { container } = render(<App />);
    expect(visibleRowCount(container)).toBe(239);
    expect(railheadText(container)).toContain('239 / 239');
    expect(stripText(container)).toContain('Category: any');
    expect(stripText(container)).toContain('License: any');
    expect(stripText(container)).toContain('Deployment: any');
    expect(stripText(container)).toContain('Open source: any');
    expect(stripText(container)).toContain('Topics: any');
    expect(stripText(container)).toContain('Search: any');
    expect(stripText(container)).toContain('239 results');
  });

  test('category multi-select ORs, the strip mirrors it, and per-filter clear works', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Agent orchestration 74' }));
    expect(visibleRowCount(container)).toBe(74);
    expect(railheadText(container)).toContain('74 / 239');
    expect(stripText(container)).toContain('Category: Agent orchestration');
    expect(stripText(container)).toContain('74 results');

    fireEvent.click(screen.getByRole('checkbox', { name: 'App builders 65' }));
    expect(visibleRowCount(container)).toBe(139);
    expect(stripText(container)).toContain('Category: Agent orchestration, App builders');
    expect(stripText(container)).toContain('139 results');

    fireEvent.click(screen.getByRole('checkbox', { name: 'MIT' }));
    expect(visibleRowCount(container)).toBe(35);
    expect(stripText(container)).toContain('License: MIT');

    fireEvent.click(screen.getByRole('button', { name: 'Clear Category' }));
    expect(stripText(container)).not.toContain('Category:');
    expect(stripText(container)).toContain('License: MIT');
  });

  test('show-all expands topics and a topic outside the first four filters rows', () => {
    const { container } = render(<App />);
    expect(screen.queryByRole('checkbox', { name: 'Prompt to app' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all topics →' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Prompt to app' }));
    expect(visibleRowCount(container)).toBe(63);
    expect(stripText(container)).toContain('Topics: Prompt to app');

    fireEvent.click(screen.getByRole('button', { name: 'Show fewer topics' }));
    expect(screen.getByRole('checkbox', { name: 'Prompt to app' })).toBeTruthy();
    expect(visibleRowCount(container)).toBe(63);
  });

  test('an impossible search renders the empty state and clear-all restores the catalog', () => {
    const { container } = render(<App />);
    const input = screen.getByLabelText<HTMLInputElement>('Search products');
    fireEvent.input(input, { target: { value: 'no such product exists' } });
    expect(input.value).toBe('no such product exists');
    expect(visibleRowCount(container)).toBe(0);
    expect(screen.getByText('No rows match the current parameters.')).toBeTruthy();
    expect(stripText(container)).toContain('0 results');

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear all' })[0]);
    expect(visibleRowCount(container)).toBe(239);
    expect(input.value).toBe('');
    expect(stripText(container)).toContain('Search: any');
  });
});

describe('compare through the real filter system', () => {
  // opencode — the auto-selected first row — is Engineering factories.
  test('compare constrains the category facet coherently: matrix, strip, rail, count', async () => {
    const { container } = render(<App />);
    await settle();
    fireEvent.click(compareButton());
    await settle();

    expect(rowsOf(container).length).toBe(56);
    for (const row of rowsOf(container)) {
      expect(row.querySelector('.cat')?.textContent).toBe('Engineering factories');
    }
    // the whole point of the integration: every surface agrees
    expect(stripText(container)).toContain('Category: Engineering factories');
    expect(stripText(container)).toContain('56 results');
    expect(railheadText(container)).toContain('56 / 239');
    expect(screen.getByRole('button', { name: 'Clear Category' })).toBeTruthy();
    expect(
      screen
        .getByRole('checkbox', { name: 'Engineering factories 56' })
        .getAttribute('aria-checked'),
    ).toBe('true');

    fireEvent.click(compareButton());
    await settle();
    expect(rowsOf(container).length).toBe(239);
    expect(stripText(container)).toContain('Category: any');
    expect(
      screen
        .getByRole('checkbox', { name: 'Engineering factories 56' })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  test('compare composes with the other facets as an AND, and lifting preserves them', async () => {
    const { container } = render(<App />);
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'MIT' }));
    expect(visibleRowCount(container)).toBe(46);
    fireEvent.click(screen.getByRole('checkbox', { name: 'MCP' }));
    // MIT ∩ MCP across the catalog
    expect(visibleRowCount(container)).toBe(9);

    fireEvent.click(compareButton());
    await settle();
    // Engineering factories ∩ MIT ∩ MCP
    expect(visibleRowCount(container)).toBe(4);
    for (const row of rowsOf(container)) {
      expect(row.querySelector('.cat')?.textContent).toBe('Engineering factories');
    }
    expect(stripText(container)).toContain('Category: Engineering factories');
    expect(stripText(container)).toContain('License: MIT');
    expect(stripText(container)).toContain('Topics: MCP');

    fireEvent.click(compareButton());
    await settle();
    // the category constraint lifts; license and topics survive untouched
    expect(visibleRowCount(container)).toBe(9);
    expect(stripText(container)).not.toContain('Category:');
    expect(stripText(container)).toContain('License: MIT');
    expect(stripText(container)).toContain('Topics: MCP');
    expect(
      screen.getByRole('checkbox', { name: 'MIT' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('checkbox', { name: 'MCP' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  test('compare replaces a manual category selection, and lifting restores empty — not the manual selection', async () => {
    const { container } = render(<App />);
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Agent orchestration 74' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'App builders 65' }));
    expect(visibleRowCount(container)).toBe(139);
    expect(stripText(container)).toContain('Category: Agent orchestration, App builders');

    // Compare is a targeting action: it replaces the category selection
    // with exactly its own record's category.
    fireEvent.click(compareButton());
    await settle();
    expect(visibleRowCount(container)).toBe(56);
    expect(stripText(container)).toContain('Category: Engineering factories');
    expect(stripText(container)).not.toContain('Agent orchestration');

    // Lifting restores empty, honestly — the pre-compare manual selection
    // is gone; remembering it would need stateful memory nobody asked for.
    fireEvent.click(compareButton());
    await settle();
    expect(visibleRowCount(container)).toBe(239);
    expect(stripText(container)).toContain('Category: any');
  });
});

describe('composition root wiring', () => {
  test('the drawer renders the auto-selected first row on load', async () => {
    const { container } = render(<App />);
    await settle();
    expect(rowName(rowsOf(container)[0])).toBe('opencode');
    expect(drawerName()).toBe(rowName(rowsOf(container)[0]));
  });

  test('clicking a matrix row populates the drawer with that record', async () => {
    const { container } = render(<App />);
    await settle();
    const row = rowsOf(container)[4];
    fireEvent.click(row);
    await settle();
    expect(drawerName()).toBe(rowName(row));
    expect(drawer().querySelector('.dpill')?.textContent).toBe(
      row?.querySelector('.cat')?.textContent,
    );
  });

  test('the facts grid carries the canon rows and footer the entry position', async () => {
    render(<App />);
    await settle();
    const facts = [...drawer().querySelectorAll('.fact span:first-child')].map(
      (el) => el.textContent,
    );
    expect(facts).toEqual([
      'CATEGORY',
      'LICENSE',
      'STARS',
      'OPEN SOURCE',
      'TOPICS',
      'DEPLOYMENT',
      'COMMERCIAL',
      'LISTED',
      'VERIFIED',
    ]);
    // opencode's stable catalog position in dataset order is 114.
    expect(drawer().querySelector('.dfoot')?.textContent).toContain('ENTRY 114 / 239');
  });

  test('open listing anchors to the record external URL', async () => {
    render(<App />);
    await settle();
    const link = drawer().querySelector<HTMLAnchorElement>('.dactions a.pri');
    expect(link?.textContent).toBe('Open listing');
    expect(link?.href).toBe('https://opencode.ai/');
  });

  test('clicking a same-class item selects that record in matrix and drawer', async () => {
    const { container } = render(<App />);
    await settle();
    const first = drawer().querySelector('.cmp button');
    if (!first) {
      throw new Error('no compare items');
    }
    const targetName = first.childNodes[0]?.textContent;
    fireEvent.click(first);
    await settle();
    expect(drawerName()).toBe(targetName);
    const selected = container.querySelector('.mrow.sel .nname');
    expect(selected?.textContent).toBe(targetName);
  });

  test('same-class activation moves focus to the new record heading, never body', async () => {
    render(<App />);
    await settle();
    const first = drawer().querySelector<HTMLElement>('.cmp button');
    if (!first) {
      throw new Error('no compare items');
    }
    const targetName = first.childNodes[0]?.textContent;
    // Focused like a keyboard user's Enter: activation happens with focus
    // on the button, which then unmounts with the drawer's re-render.
    // jsdom does not synthesize button activation from keyDown, so the
    // click stands in; the real-Enter path is browser-verified.
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    await settle();
    expect(drawerName()).toBe(targetName);
    expect(document.activeElement?.tagName).not.toBe('BODY');
    expect(document.activeElement).toBe(drawer().querySelector('h2'));
  });

  test('chaining: focus survives repeated same-class activations', async () => {
    render(<App />);
    await settle();
    for (let step = 0; step < 2; step++) {
      const item = drawer().querySelector<HTMLElement>('.cmp button');
      if (!item) {
        throw new Error('no compare items');
      }
      item.focus();
      fireEvent.click(item);
      await settle();
      expect(document.activeElement).toBe(drawer().querySelector('h2'));
    }
  });

  test('selection survives re-sort in both matrix and drawer', async () => {
    const { container } = render(<App />);
    await settle();
    const row = rowsOf(container)[4];
    fireEvent.click(row);
    await settle();
    const name = rowName(row);
    expect(drawerName()).toBe(name);

    const productSort = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Product'));
    if (!productSort) {
      throw new Error('no product sort button');
    }
    fireEvent.click(productSort);
    await settle();
    expect(drawerName()).toBe(name);
    expect(container.querySelector('.mrow.sel .nname')?.textContent).toBe(name);
  });

  test('arrow keys move the drawer selection with the matrix cursor', async () => {
    const { container } = render(<App />);
    await settle();
    const first = rowsOf(container)[0];
    first?.focus();
    await settle();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    await settle();
    expect(drawerName()).toBe(rowName(rowsOf(container)[1]));
  });
});

describe('agent readiness', () => {
  test('an agent can find and change the filter controls', async () => {
    const agent = createAgent();
    render(<App />);

    const components = agent
      .snapshot()
      .filter((entry) => !entry.offPage && entry.component !== 'more');
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }
    const labels = components.map((entry) => entry.label);
    for (const label of [
      'Search products',
      'Category',
      'License',
      'Deployment',
      'Topics',
      'Open source only',
      'Agent orchestration 74',
    ]) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label);
    }

    let result: Awaited<ReturnType<typeof agent.act>> | undefined;
    await act(async () => {
      result = await agent.act({
        steps: [
          { ref: 'Search products', action: 'setValue', args: ['mcp'] },
          { ref: 'Category', action: 'setValue', args: ['agent-orchestration'] },
        ],
      });
    });
    expect(result?.ok, result?.error?.message).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Search products').value).toBe('mcp');
    expect(
      screen
        .getByRole('checkbox', { name: 'Agent orchestration 74' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });
});
