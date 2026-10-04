import { expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { coverUrl: vi.fn(async () => null) },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  setAuthExpiredHandler: vi.fn(),
}));

// App-режим фиксируется на весь файл: шторка шаринга должна открываться и в Tauri.
vi.mock('../platform/mode', () => ({ CLIENT_MODE: 'app', IS_WEB: false, isTauri: () => true }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePlayer } from '../store/player';
import { useServers } from '../store/servers';
import { useShareSheet } from '../store/shareSheet';
import type { Track } from '../api';
import { FullPlayer } from './FullPlayer';

const track = (id: string): Track => ({
  id,
  title: `Track-${id}`,
  artistId: 'artist',
  artist: 'Artist',
  releaseId: 'album',
  release: 'Album',
  durationSec: 120,
});

usePlayer.setState({
  queue: [track('a')],
  index: 0,
  playing: false,
  position: 0,
  seekNonce: 0,
  playId: 0,
  mediaDuration: 0,
  volume: 1,
  muted: false,
  repeat: 'off',
  shuffle: false,
  shuffleOrder: null,
  fullscreen: true,
});
useServers.setState({
  nodes: [{ id: 'n1', host: '10.0.0.5:8080', name: 'node', owner: '', access: '', note: '', ping: 12, status: 'online' }],
  activeId: 'n1',
});

it('shows the share button without the like badge in app mode and opens the track sheet', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FullPlayer />
    </QueryClientProvider>,
  );
  // В app-режиме бейджа «лайк — скоро» нет, а «поделиться» есть (гейт IS_WEB снят).
  expect(screen.queryByLabelText('Лайк трека — скоро')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'поделиться' }));
  expect(useShareSheet.getState().target).toEqual({ kind: 'track', track: track('a') });
  useShareSheet.getState().close();
});
