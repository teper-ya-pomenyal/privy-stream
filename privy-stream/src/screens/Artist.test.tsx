import { expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  browseApi: () => undefined,
  nodeApi: {
    artist: vi.fn(async () => ({
      id: 'ar1',
      name: 'Artist',
      releases: [],
      popular: [{ id: 't1', title: 'Song', artistId: 'ar1', artist: 'Artist', releaseId: 'rel1', release: 'Album', durationSec: 60 }],
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
import { Artist } from './Artist';

useServers.setState({
  nodes: [{ id: 'n1', name: 'node-1', host: '10.0.0.1:1', owner: '', access: '', note: '', ping: 15, status: 'online' }],
  activeId: 'n1',
});

const renderArtist = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/artist/ar1']}>
        <Artist />
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

it('has a share button that opens the artist sheet', async () => {
  renderArtist();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Поделиться' })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
  expect(screen.getByRole('dialog', { name: 'Поделиться' })).toBeInTheDocument();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('#/artist/ar1');
  act(() => useShareSheet.getState().close());
});

it('carries ?host= from the artist link into the release link', async () => {
  useServers.setState({ nodes: TWO_NODES, activeId: 'n1' });
  vi.mocked(nodeApi.artist).mockResolvedValue({
    id: 'ar1',
    name: 'Artist',
    releases: [{ id: 'rel1', title: 'Disco Release', artistId: 'ar1', artist: 'Artist', flagged: false }],
    popular: [],
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      {/* Route с :id — иначе useParams не достаёт идентификатор из адреса. */}
      <MemoryRouter initialEntries={['/artist/ar1?host=10.0.0.2%3A2']}>
        <LocationProbe />
        <Routes>
          <Route element={<Artist />} path="/artist/:id" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  // Плитка дискографии ведёт на альбом на том же узле, что и ссылка артиста;
  // формат — как в Catalog (Task 4): encodeURIComponent(host) → %3A вместо ':'.
  const discoTitle = await screen.findByText('Disco Release');
  // Кликабельный элемент — обёртка плитки вокруг текста релиза.
  await userEvent.click(discoTitle.closest('div')!.parentElement!);
  await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/album/rel1?host=10.0.0.2%3A2'));
});
