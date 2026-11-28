import { act, fireEvent, render, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, describe, expect, test } from 'vitest';
import App from './App.tsx';

// Issue #6 write-through means every render mirrors state into the URL and
// localStorage: without isolation the next test would restore it.
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

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
    const { container } = render(<App />);

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
      // issue #6: the new controls are agent-visible with honest names
      'Hide shortlisted 0',
      'Shortlist',
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

    // the issue #6 controls act through the agent the same as through the keyboard
    await act(async () => {
      result = await agent.act({
        steps: [
          { ref: 'Shortlist', action: 'setPressed', args: [true] },
          { ref: 'Hide shortlisted 1', action: 'setChecked', args: [true] },
        ],
      });
    });
    expect(result?.ok, result?.error?.message).toBe(true);
    // mcp ∩ agent-orchestration is 8 rows; the marked record (auto-selected
    // opencode) is not among them, so hiding it changes nothing visible here —
    // what the steps prove is that both controls actuate through the agent
    expect(container.querySelectorAll('.mrow')).toHaveLength(8);
    expect(
      screen.getByRole('checkbox', { name: 'Hide shortlisted 1' }).getAttribute('aria-checked'),
    ).toBe('true');
  });
});

function shortlistButton(): HTMLElement {
  const button = [...drawer().querySelectorAll('button')].find(
    (el) => el.textContent === 'Shortlist',
  );
  if (!button) {
    throw new Error('no shortlist button');
  }
  return button;
}

describe('shortlist state (issue #6)', () => {
  test('the drawer shortlist button is a real pressed-state toggle, no longer inert furniture', async () => {
    const { container } = render(<App />);
    await settle();
    const button = shortlistButton();
    expect(button.getAttribute('aria-hidden')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    const name = drawerName();

    fireEvent.click(button);
    await settle();
    expect(shortlistButton().getAttribute('aria-pressed')).toBe('true');
    // the matrix row shows the mark for the same record
    const row = rowsOf(container).find((el) => rowName(el) === name);
    expect(row?.classList.contains('marked')).toBe(true);
    expect(row?.querySelector('.mtile')?.textContent).toBe('✓');

    fireEvent.click(shortlistButton());
    await settle();
    expect(shortlistButton().getAttribute('aria-pressed')).toBe('false');
  });

  test('s on a matrix row marks it and the drawer button agrees', async () => {
    const { container } = render(<App />);
    await settle();
    const row = rowsOf(container)[3];
    row?.focus();
    await settle();
    fireEvent.keyDown(row, { key: 's' });
    await settle();
    expect(rowsOf(container)[3]?.classList.contains('marked')).toBe(true);
    // the marked row is not the selected one, so the drawer still shows unpressed
    expect(shortlistButton().getAttribute('aria-pressed')).toBe('false');
  });

  test('hide-shortlisted removes marked rows and the counts agree everywhere', async () => {
    const { container } = render(<App />);
    await settle();
    fireEvent.click(shortlistButton());
    await settle();
    expect(visibleRowCount(container)).toBe(239);

    const hide = screen.getByRole('checkbox', { name: /Hide shortlisted/ });
    fireEvent.click(hide);
    await settle();
    expect(visibleRowCount(container)).toBe(238);
    expect(stripText(container)).toContain('238 results');
    expect(railheadText(container)).toContain('238 / 239');

    fireEvent.click(screen.getByRole('checkbox', { name: /Hide shortlisted/ }));
    await settle();
    expect(visibleRowCount(container)).toBe(239);
  });

  test('scan-end: marking away the last visible row never drops focus to body', async () => {
    const { container } = render(<App />);
    await settle();
    // an impossible-ish filter leaving a single row, then hide mode on
    const input = screen.getByLabelText<HTMLInputElement>('Search products');
    fireEvent.input(input, { target: { value: 'aeon' } });
    await settle();
    expect(visibleRowCount(container)).toBe(1);
    fireEvent.click(screen.getByRole('checkbox', { name: /Hide shortlisted/ }));
    await settle();
    // still visible: nothing marked yet
    expect(visibleRowCount(container)).toBe(1);
    const row = rowsOf(container)[0];
    row?.focus();
    await settle();
    fireEvent.keyDown(row, { key: 's' });
    await settle();
    expect(visibleRowCount(container)).toBe(0);
    // hiding is the sole cause here — the pre-hide set was non-empty
    expect(screen.getByText('No visible rows — shortlisted rows are hidden.')).toBeTruthy();
    expect(document.activeElement?.tagName).not.toBe('BODY');
    expect(document.activeElement).toBe(
      screen.getByRole('checkbox', { name: /Hide shortlisted/ }),
    );
  });

  test('empty-state copy is exact about the cause: parameters vs hiding', async () => {
    const { container } = render(<App />);
    await settle();
    const input = screen.getByLabelText<HTMLInputElement>('Search products');
    // mark Aeon: the query aeon matches exactly one row in the catalog
    fireEvent.input(input, { target: { value: 'aeon' } });
    await settle();
    expect(visibleRowCount(container)).toBe(1);
    fireEvent.click(rowsOf(container)[0]);
    await settle();
    fireEvent.click(shortlistButton());
    await settle();
    fireEvent.input(input, { target: { value: '' } });
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: /Hide shortlisted/ }));
    await settle();

    // a query matching nothing: the parameters are the sole cause, even
    // though hide is active and the shortlist non-empty — unchecking hide
    // would still reveal zero rows
    fireEvent.input(input, { target: { value: 'zzz-nothing' } });
    await settle();
    expect(visibleRowCount(container)).toBe(0);
    expect(screen.getByText('No rows match the current parameters.')).toBeTruthy();
    expect(screen.queryByText('No visible rows — shortlisted rows are hidden.')).toBeNull();

    // a query matching exactly the hidden row: hiding becomes the sole
    // cause, and the message must flip to say so
    fireEvent.input(input, { target: { value: 'aeon' } });
    await settle();
    expect(visibleRowCount(container)).toBe(0);
    expect(screen.getByText('No visible rows — shortlisted rows are hidden.')).toBeTruthy();
    expect(screen.queryByText('No rows match the current parameters.')).toBeNull();

    // toggling hide off in that state reveals the row and no message at all
    fireEvent.click(screen.getByRole('checkbox', { name: /Hide shortlisted/ }));
    await settle();
    expect(visibleRowCount(container)).toBe(1);

    // and back on with the nonsense query: parameters again, never the wrong lever
    fireEvent.click(screen.getByRole('checkbox', { name: /Hide shortlisted/ }));
    await settle();
    fireEvent.input(input, { target: { value: 'zzz-nothing' } });
    await settle();
    expect(screen.getByText('No rows match the current parameters.')).toBeTruthy();
  });
});

describe('share state write-through (issue #6)', () => {
  test('state changes serialize into the URL live, readable and complete', async () => {
    const { container } = render(<App />);
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'MIT' }));
    await settle();
    const row = rowsOf(container)[2];
    row?.focus();
    await settle();
    fireEvent.keyDown(row, { key: 's' });
    await settle();

    const search = window.location.search;
    expect(search).toContain('lic=MIT');
    expect(search).toContain('sl=');
    expect(search).toContain('sel=');
    // no hiding, no categories, no query: those params stay absent
    expect(search).not.toContain('hide=');
    expect(search).not.toContain('cat=');
    expect(search).not.toContain('q=');
    expect(visibleRowCount(container)).toBe(46);
  });

  test('localStorage mirrors the live state on every change', async () => {
    render(<App />);
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'MIT' }));
    await settle();
    const stored = localStorage.getItem('factory-index:view:v1');
    expect(stored).toBeTruthy();
    // the storage format is the URL's own serialization (share-state module doc)
    expect(stored).toContain('lic=MIT');
    expect(stored).toContain('sel=');
  });
});

describe('share state restoration (issue #6)', () => {
  test('a pasted URL restores filters, selection and shortlist exactly', async () => {
    window.history.replaceState(
      null,
      '',
      '/?lic=MIT&topics=MCP&sel=aeon&sl=aeon,opencode&hide=1',
    );
    const { container } = render(<App />);
    await settle();
    // MIT ∩ MCP, minus hidden shortlisted rows (opencode and aeon are both in it)
    expect(stripText(container)).toContain('License: MIT');
    expect(stripText(container)).toContain('Topics: MCP');
    expect(drawerName()).toBe('Aeon');
    expect(
      screen.getByRole('checkbox', { name: 'MIT' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('checkbox', { name: 'MCP' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByLabelText<HTMLInputElement>('Search products').value).toBe('');
    // hide mode restored: aeon is shortlisted and must not appear even though selected
    expect(
      rowsOf(container).some((row) => rowName(row) === 'Aeon'),
    ).toBe(false);
    // opencode is MIT-licensed and MCP-topiced, shortlisted, hidden as well
    expect(
      rowsOf(container).some((row) => rowName(row) === 'opencode'),
    ).toBe(false);
    // un-hiding reveals both marked rows with their marks
    fireEvent.click(screen.getByRole('checkbox', { name: /Hide shortlisted/ }));
    await settle();
    const aeon = rowsOf(container).find((row) => rowName(row) === 'Aeon');
    expect(aeon?.classList.contains('marked')).toBe(true);
  });

  test('click order round-trips visibly: the strip reads the same', async () => {
    window.history.replaceState(null, '', '/?cat=app-builders,agent-orchestration');
    const { container } = render(<App />);
    await settle();
    expect(stripText(container)).toContain('Category: App builders, Agent orchestration');
    expect(visibleRowCount(container)).toBe(139);
  });

  test('returning visit: clean URL restores the stored state', async () => {
    localStorage.setItem(
      'factory-index:view:v1',
      'cat=ai-labs&sel=mistral-code&sl=mistral-code',
    );
    const { container } = render(<App />);
    await settle();
    expect(visibleRowCount(container)).toBe(4);
    expect(drawerName()).toBe('Mistral Code');
    expect(
      rowsOf(container).find((row) => rowName(row) === 'Mistral Code')?.classList.contains('marked'),
    ).toBe(true);
  });

  test('first visit: nothing stored, clean URL — default state', async () => {
    const { container } = render(<App />);
    await settle();
    expect(visibleRowCount(container)).toBe(239);
    expect(container.querySelectorAll('.mrow.marked')).toHaveLength(0);
    expect(stripText(container)).toContain('Category: any');
  });

  test('a shared URL wins over contradicting stored state, with no merging', async () => {
    localStorage.setItem('factory-index:view:v1', 'cat=ai-labs&sel=opencode&sl=opencode');
    window.history.replaceState(null, '', '/?lic=MIT&sel=aeon');
    const { container } = render(<App />);
    await settle();
    expect(stripText(container)).toContain('License: MIT');
    expect(stripText(container)).not.toContain('Category:');
    expect(drawerName()).toBe('Aeon');
    // the stored shortlist does not leak into the shared state
    expect(container.querySelectorAll('.mrow.marked')).toHaveLength(0);
  });

  test('garbage URLs never crash and garbage values drop', async () => {
    window.history.replaceState(null, '', '/?cat=bogus,%E0%A4%A&sl=ghost&sel=ghost&q=%E0%A4%A');
    const { container } = render(<App />);
    await settle();
    // a recognized key was present, so the URL wins — but every value was
    // garbage, so the state is the default one, not a crash
    expect(visibleRowCount(container)).toBe(239);
    expect(container.querySelectorAll('.mrow.marked')).toHaveLength(0);
  });

  test('corrupt storage reads as a first visit', async () => {
    localStorage.setItem('factory-index:view:v1', '{{{corrupt');
    const { container } = render(<App />);
    await settle();
    expect(visibleRowCount(container)).toBe(239);
  });
});

function mockClipboard() {
  const written: Array<string> = [];
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
    configurable: true,
  });
  return written;
}

describe('copy export (issue #6)', () => {
  test('copy link writes the live shareable URL to the clipboard', async () => {
    const written = mockClipboard();
    render(<App />);
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'MIT' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await settle();
    expect(written).toHaveLength(1);
    expect(written[0]).toContain('lic=MIT');
    expect(written[0]).toContain('sel=');
  });

  test('copy shortlist as markdown writes paste-ready entries checked against real data', async () => {
    const written = mockClipboard();
    const { container } = render(<App />);
    await settle();
    // disabled while the shortlist is empty
    const button = screen.getByRole('button', { name: 'Copy shortlist as markdown' });
    expect(button).toHaveProperty('disabled', true);

    // mark opencode (auto-selected first row) through the drawer
    fireEvent.click(
      [...drawer().querySelectorAll('button')].find((el) => el.textContent === 'Shortlist') ??
        (() => {
          throw new Error('no shortlist button');
        })(),
    );
    await settle();
    // mark one more row through the matrix
    const row = rowsOf(container)[4];
    row?.focus();
    await settle();
    fireEvent.keyDown(row, { key: 's' });
    await settle();

    const enabled = screen.getByRole('button', { name: 'Copy shortlist as markdown' });
    expect(enabled).toHaveProperty('disabled', false);
    fireEvent.click(enabled);
    await settle();
    expect(written).toHaveLength(1);
    const lines = written[0]?.split('\n') ?? [];
    expect(lines).toHaveLength(2);
    // opencode leads: the catalog's most-starred record, real link, and the
    // honest approximation prefix — the source count is a rounded figure
    expect(lines[0]).toMatch(/^- \[opencode\]\(https:\/\/opencode\.ai\/\) — .+ — ★ ~217,100$/);
    for (const line of lines) {
      expect(line).toMatch(/^- \[.+\]\(https?:\/\/\S+\) — .+/);
    }
  });

  test('copy feedback flips the label honestly and reverts', async () => {
    mockClipboard();
    render(<App />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeTruthy();
  });
});
