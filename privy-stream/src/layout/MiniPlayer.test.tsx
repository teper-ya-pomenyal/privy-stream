import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { probe: vi.fn() },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // Импорт session.ts (через стор узлов) вызывает её на верхнем уровне.
  setAuthExpiredHandler: vi.fn(),
}));

import { createEvent, fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motionValue } from 'motion/react';
import { usePlayer } from '../store/player';
import { useServers } from '../store/servers';
import type { Track } from '../api';
import { flingVelocity, MiniPlayer } from './PlayerBar';

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
    mediaDuration: 120,
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

const renderMini = (props?: Parameters<typeof MiniPlayer>[0]) =>
  render(
    // Обложка берётся через react-query (useCoverUrl в CoverThumb) — нужен провайдер.
    <QueryClientProvider client={new QueryClient()}>
      <MiniPlayer {...props} />
    </QueryClientProvider>,
  );

type PointerPhase = 'pointerDown' | 'pointerMove' | 'pointerUp';

/** Событие указателя с точным временем: скорость рывка в тестах должна быть воспроизводимой. */
const pointer = (phase: PointerPhase, el: Element, y: number, t: number) => {
  const ev = createEvent[phase](el, { clientY: y, button: 0, buttons: 1, pointerId: 1, isPrimary: true });
  Object.defineProperty(ev, 'timeStamp', { value: t });
  fireEvent(el, ev);
};

it('opens the full player when the bar is pulled up past a quarter of the screen', () => {
  const { container } = renderMini();
  const bar = container.firstElementChild as HTMLElement;
  // jsdom: window.innerHeight = 768
  pointer('pointerDown', bar, 700, 1000);
  pointer('pointerMove', bar, 660, 1040); // порог 8px пройден — шторка встаёт под палец
  expect(usePlayer.getState().fullscreen).toBe(true);
  pointer('pointerMove', bar, 400, 1200);
  pointer('pointerUp', bar, 400, 1400); // пауза перед отпусканием — не рывок
  // Дотянули на 300px вверх (> 768 * 0.25) — шторка открылась и осталась открытой
  expect(usePlayer.getState().fullscreen).toBe(true);
});

it('follows the finger one to one and clamps at the top edge', () => {
  const sheetY = motionValue<string | number>('100%');
  const { container } = renderMini({ sheetY });
  const bar = container.firstElementChild as HTMLElement;
  pointer('pointerDown', bar, 700, 1000);
  pointer('pointerMove', bar, 660, 1040);
  expect(sheetY.get()).toBe(768 - 40);
  pointer('pointerMove', bar, 60, 1100);
  expect(sheetY.get()).toBe(768 + (60 - 700)); // один к одному за пальцем
  pointer('pointerMove', bar, -100, 1120); // выше верхнего края
  expect(sheetY.get()).toBe(0);
  pointer('pointerUp', bar, -100, 1400);
  expect(usePlayer.getState().fullscreen).toBe(true);
});

it('slides back down when released before a quarter of the screen', () => {
  const { container } = renderMini();
  const bar = container.firstElementChild as HTMLElement;
  pointer('pointerDown', bar, 700, 1000);
  pointer('pointerMove', bar, 660, 1040);
  expect(usePlayer.getState().fullscreen).toBe(true);
  pointer('pointerUp', bar, 660, 1100); // 40px < четверти, скорость 0.4 px/ms < рывка
  expect(usePlayer.getState().fullscreen).toBe(false);
});

it('opens on a quick upward flick even for a short pull', () => {
  const { container } = renderMini();
  const bar = container.firstElementChild as HTMLElement;
  pointer('pointerDown', bar, 700, 1000);
  pointer('pointerMove', bar, 660, 1040);
  pointer('pointerUp', bar, 660, 1050); // 40px за 50ms — рывок 0.8 px/ms вверх
  expect(usePlayer.getState().fullscreen).toBe(true);
});

it('still opens by a plain tap on the track area and never by the seek line', () => {
  const { container } = renderMini();
  const bar = container.firstElementChild as HTMLElement;
  // Тяга от полоски перемотки — жест перемотки, шторку не открывает
  const seek = bar.querySelector('[role="slider"]') as HTMLElement;
  pointer('pointerDown', seek, 700, 1000);
  pointer('pointerMove', seek, 300, 1100);
  pointer('pointerUp', seek, 300, 1200);
  expect(usePlayer.getState().fullscreen).toBe(false);
  // Тап по названию трека открывает шторку как раньше
  fireEvent.click(bar.querySelector('button:not([aria-label])') as HTMLElement);
  expect(usePlayer.getState().fullscreen).toBe(true);
});

it('keeps the play button a tap that toggles playback, not a drag handle', () => {
  const { container } = renderMini();
  const bar = container.firstElementChild as HTMLElement;
  const play = bar.querySelector('button[aria-label="Играть"]') as HTMLElement;
  pointer('pointerDown', play, 700, 1000);
  pointer('pointerMove', play, 300, 1100);
  pointer('pointerUp', play, 300, 1200);
  expect(usePlayer.getState().fullscreen).toBe(false);
  // Тяга не съела тап: из pointer-событий браузер рождает клик, играющий трек
  fireEvent.click(play);
  expect(usePlayer.getState().playing).toBe(true);
});

it('computes fling velocity over the last 100ms of the gesture', () => {
  const samples = [
    { t: 0, y: 700 },
    { t: 50, y: 690 },
    { t: 190, y: 680 }, // за пределами окна: в скорость идёт (190 → 200)
    { t: 200, y: 640 },
  ];
  // (640 - 680) / 10ms = -4 px/ms
  expect(flingVelocity(samples)).toBe(-4);
  // Замерший перед отпусканием палец рывком не считается
  expect(flingVelocity([{ t: 0, y: 700 }, { t: 500, y: 640 }])).toBe(0);
  // Жест короче кадра — тоже
  expect(flingVelocity([{ t: 0, y: 700 }, { t: 5, y: 640 }])).toBe(0);
});
