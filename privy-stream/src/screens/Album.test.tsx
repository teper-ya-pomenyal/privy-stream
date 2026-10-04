import { expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  browseApi: () => undefined,
  nodeApi: {
    release: vi.fn(async () => ({
      id: 'rel1',
      title: 'Album',
      artistId: 'ar1',
      artist: 'Artist',
      flagged: false,
      code: 'PS-1',
      tracks: [{ id: 't1', title: 'Song', artistId: 'ar1', artist: 'Artist', releaseId: 'rel1', release: 'Album', durationSec: 60 }],
    })),
    coverUrl: vi.fn(async () => null),
  },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  setAuthExpiredHandler: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { nodeApi } from '../api';
import { useShareSheet } from '../store/shareSheet';
import { useServers } from '../store/servers';
import { ShareSheet } from '../ui/ShareSheet';
import ui from '../ui/ui.module.css';
import { Album } from './Album';

useServers.setState({
  nodes: [{ id: 'n1', name: 'node-1', host: '10.0.0.1:1', owner: '', access: '', note: '', ping: 15, status: 'online' }],
  activeId: 'n1',
});

const renderAlbum = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/album/rel1']}>
        <Album />
        {/* Шторка живёт в AppShell — в тесте монтируем рядом с экраном */}
        <ShareSheet />
      </MemoryRouter>
    </QueryClientProvider>,
  );

// Проба адреса: вложенные переходы проверяем по фактическому URL роутера.
const LocationProbe = () => {
  const { pathname, search } = useLocation();
  return <span data-testid="route">{pathname}{search}</span>;
};

const TWO_NODES = [
  { id: 'n1', name: 'node-1', host: '10.0.0.1:1', owner: '', access: '', note: '', ping: 15, status: 'online' as const },
  { id: 'ru-ind', name: 'ru-ind', host: '10.0.0.2:2', owner: '', access: '', note: '', ping: 25, status: 'online' as const },
];

it('opens the share sheet for the release instead of sharing directly', async () => {
  renderAlbum();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Поделиться' })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
  expect(screen.getByRole('dialog', { name: 'Поделиться' })).toBeInTheDocument();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('#/album/rel1');
  act(() => useShareSheet.getState().close());
});

it('highlights the shared track from the ?t= parameter and scrolls to it', async () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/album/rel1?t=t1']}>
        <Album />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Играть «Song»' })).toBeInTheDocument());
  const row = screen.getByRole('button', { name: 'Играть «Song»' }).closest('div')!;
  expect(row).toHaveClass(ui.rowTarget);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it('loads the release from the node in ?host= instead of the active one', async () => {
  useServers.setState({ nodes: TWO_NODES, activeId: 'n1' });
  vi.mocked(nodeApi.release).mockClear();
  render(
    <QueryClientProvider client={new QueryClient()}>
      {/* Route с :id — иначе useParams не достаёт идентификатор из адреса. */}
      <MemoryRouter initialEntries={['/album/AR-021?host=10.0.0.2%3A2']}>
        <Routes>
          <Route element={<Album />} path="/album/:id" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  // Релиз запрошен с узла из ссылки, а не с активного.
  await waitFor(() => expect(vi.mocked(nodeApi.release)).toHaveBeenCalledWith('10.0.0.2:2', 'AR-021'));
  expect(vi.mocked(nodeApi.release)).not.toHaveBeenCalledWith('10.0.0.1:1', expect.anything());
  // Имя узла в шапке метаданных — узел из ссылки, не активный.
  await waitFor(() => expect(screen.getByText('ru-ind')).toBeInTheDocument());
  expect(screen.queryByText('node-1')).toBeNull();
});

it('carries ?host= from the album link into the artist link', async () => {
  useServers.setState({ nodes: TWO_NODES, activeId: 'n1' });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/album/AR-021?host=10.0.0.2%3A2']}>
        <LocationProbe />
        <Routes>
          <Route element={<Album />} path="/album/:id" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  // Ссылка на артиста ведёт на его узел (тот же, что в ссылке альбома);
  // формат — как в Catalog (Task 4): encodeURIComponent(host) → %3A вместо ':'.
  await userEvent.click(await screen.findByRole('button', { name: 'Artist' }));
  await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/artist/ar1?host=10.0.0.2%3A2'));
});

it('shares the release on the node from ?host=, not the active one', async () => {
  useServers.setState({ nodes: TWO_NODES, activeId: 'n1' });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/album/AR-021?host=10.0.0.2%3A2']}>
        {/* Шторка живёт в AppShell — для проверки строки «Узел» монтируем рядом. */}
        <Routes>
          <Route element={<Album />} path="/album/:id" />
        </Routes>
        <ShareSheet />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Поделиться' }));
  // Честная пара «имя узла ссылки · его адрес», не активная сессия.
  expect(screen.getByText('Узел: ru-ind · 10.0.0.2:2')).toBeInTheDocument();
});
