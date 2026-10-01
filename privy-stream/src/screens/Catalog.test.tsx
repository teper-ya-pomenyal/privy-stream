import { expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  browseApi: () => async () => [],
  nodeApi: { search: vi.fn(async () => ({ artists: [], tracks: [] })) },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // Стор узлов тянет session.ts, а тот зовёт её на верхнем уровне.
  setAuthExpiredHandler: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { useServers } from '../store/servers';
import { Catalog } from './Catalog';

// Экран открывается только с выбранным узлом (useActiveNode) — сеем узел в стор,
// как это делают остальные тесты экранов (см. Servers.test.tsx).
useServers.setState({
  nodes: [{ id: 'n1', name: 'node-1', host: '10.0.0.1:1', owner: '', access: '', note: '', ping: 15, status: 'online' }],
  activeId: 'n1',
});

const renderCatalog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Catalog />
      </MemoryRouter>
    </QueryClientProvider>,
  );

it('shows shelf tabs only while searching', async () => {
  renderCatalog();
  expect(screen.queryByRole('button', { name: 'Артисты' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Треки' })).toBeNull();
  await userEvent.type(screen.getByRole('textbox', { name: 'Поиск по узлу' }), 'a');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Артисты' })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Артисты' })).toBeNull());
});
