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
import { MemoryRouter } from 'react-router';
import { useShareSheet } from '../store/shareSheet';
import { useServers } from '../store/servers';
import { ShareSheet } from '../ui/ShareSheet';
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

it('opens the share sheet for the release instead of sharing directly', async () => {
  renderAlbum();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Поделиться' })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
  expect(screen.getByRole('dialog', { name: 'Поделиться' })).toBeInTheDocument();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('#/album/rel1');
  act(() => useShareSheet.getState().close());
});
