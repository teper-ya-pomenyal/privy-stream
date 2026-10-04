import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { probe: vi.fn() },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // Импорт session.ts (через стор узлов) вызывает её на верхнем уровне.
  setAuthExpiredHandler: vi.fn(),
}));

import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    fullscreen: true,
  });
  useServers.setState({
    nodes: [{ id: 'n1', host: '10.0.0.5:8080', name: 'node', owner: '', access: '', note: '', ping: 12, status: 'online' }],
    activeId: 'n1',
  });
});

/** true — b идёт в DOM после a. */
const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const renderPlayer = () =>
  render(
    // Обложка берётся через react-query (useCoverUrl в CoverThumb) — нужен провайдер.
    <QueryClientProvider client={new QueryClient()}>
      <FullPlayer />
    </QueryClientProvider>,
  );

it('lays the transport out as ⇄ ▶-cluster left and volume on the right with a popover slider', () => {
  renderPlayer();
  const shuffle = screen.getByRole('button', { name: 'Перемешивание выключено' });
  const prev = screen.getByRole('button', { name: 'Предыдущий' });
  const play = screen.getByRole('button', { name: 'Играть' });
  const next = screen.getByRole('button', { name: 'Следующий' });
  const repeat = screen.getByRole('button', { name: 'Повтор выключен' });
  expect(after(shuffle, prev)).toBe(true);
  expect(after(prev, play)).toBe(true);
  expect(after(play, next)).toBe(true);
  expect(after(next, repeat)).toBe(true);
  // Полоса громкости живёт в поповере, но из дерева доступности не исчезает.
  expect(screen.getByRole('slider', { name: 'Громкость' })).toBeInTheDocument();
});

it('shuffle button toggles the shuffled order over the queue', () => {
  renderPlayer();
  fireEvent.click(screen.getByRole('button', { name: 'Перемешивание выключено' }));
  expect(usePlayer.getState().shuffle).toBe(true);
  expect(usePlayer.getState().shuffleOrder).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Перемешивание включено' }));
  expect(usePlayer.getState().shuffle).toBe(false);
  expect(usePlayer.getState().shuffleOrder).toBeNull();
});

it('keeps the volume popover open for a grace period after the cursor leaves', () => {
  vi.useFakeTimers();
  try {
    const { container } = renderPlayer();
    // .volBar → .volumePop → .volume
    const volumeBox = screen.getByRole('slider', { name: 'Громкость' }).parentElement!.parentElement!;
    fireEvent.mouseEnter(volumeBox);
    expect(volumeBox).toHaveAttribute('data-open');
    fireEvent.mouseLeave(volumeBox);
    // Задержка: сразу после ухода курсора поповер ещё открыт
    expect(volumeBox).toHaveAttribute('data-open');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(volumeBox).not.toHaveAttribute('data-open');
    // Возврат курсора до истечения таймера отменяет закрытие
    fireEvent.mouseEnter(volumeBox);
    fireEvent.mouseLeave(volumeBox);
    fireEvent.mouseEnter(volumeBox);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(volumeBox).toHaveAttribute('data-open');
    void container;
  } finally {
    vi.useRealTimers();
  }
});

it('places the share button next to the like badge and opens the track sheet', async () => {
  renderPlayer();
  // Порядок: артист, бейдж будущего лайка, кнопка «поделиться» после него
  const fav = screen.getByLabelText('Лайк трека — скоро');
  const share = screen.getByRole('button', { name: 'поделиться' });
  expect(after(fav, share)).toBe(true);
  fireEvent.click(share);
  // Шторка «Поделиться» открылась за текущий трек (монтируется в AppShell —
  // здесь проверяем только стор, как контракт между FullPlayer и ShareSheet).
  expect(useShareSheet.getState().target).toEqual({ kind: 'track', track: track('a') });
  useShareSheet.getState().close();
});

it('keeps the player open when Escape closes the share sheet above it', () => {
  renderPlayer();
  fireEvent.click(screen.getByRole('button', { name: 'поделиться' }));
  expect(useShareSheet.getState().target).not.toBeNull();
  // Пока шторка открыта, Escape не закрывает плеер (сама шторка закрывается
  // своим листенером — покрыто в ShareSheet.test).
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(usePlayer.getState().fullscreen).toBe(true);
  useShareSheet.getState().close();
  // После закрытия шторки Escape снова сворачивает плеер.
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(usePlayer.getState().fullscreen).toBe(false);
});
