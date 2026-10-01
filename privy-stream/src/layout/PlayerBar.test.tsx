import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { probe: vi.fn() },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // Импорт session.ts (через стор узлов) вызывает её на верхнем уровне.
  setAuthExpiredHandler: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlayer } from '../store/player';
import { useServers } from '../store/servers';
import type { Track } from '../api';
import { PlayerBar } from './PlayerBar';

const track = (id: string): Track => ({
  id,
  title: `Track-${id}`,
  artistId: 'artist',
  artist: 'Artist',
  releaseId: 'album',
  release: 'Album',
  durationSec: 120,
});

beforeEach(() => {
  usePlayer.setState({
    queue: [track('a'), track('b')],
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
    fullscreen: false,
  });
  useServers.setState({
    nodes: [{ id: 'n1', host: '10.0.0.5:8080', name: 'node', owner: '', access: '', note: '', ping: 12, status: 'online' }],
    activeId: 'n1',
  });
});

/** true — b идёт в DOM после a. */
const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

it('arranges the collapsed bar transport exactly like the full player: ⇄ ⏮ ▶ ⏭ ↻', () => {
  render(
    // Обложка берётся через react-query (useCoverUrl в CoverThumb) — нужен провайдер.
    <QueryClientProvider client={new QueryClient()}>
      <PlayerBar />
    </QueryClientProvider>,
  );
  const shuffle = screen.getByRole('button', { name: 'Перемешивание выключено' });
  const prev = screen.getByRole('button', { name: 'Предыдущий' });
  const play = screen.getByRole('button', { name: 'Играть' });
  const next = screen.getByRole('button', { name: 'Следующий' });
  const repeat = screen.getByRole('button', { name: 'Повтор выключен' });
  expect(after(shuffle, prev)).toBe(true);
  expect(after(prev, play)).toBe(true);
  expect(after(play, next)).toBe(true);
  expect(after(next, repeat)).toBe(true);
  // Громкость — отдельно в правой колонке, полоса живёт в поповере.
  expect(screen.getByRole('slider', { name: 'Громкость' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Очередь воспроизведения' })).toBeInTheDocument();
});
