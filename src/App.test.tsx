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
