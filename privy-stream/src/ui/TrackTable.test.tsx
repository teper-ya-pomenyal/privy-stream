import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Track } from '../api';
import type { FavControl } from '../store/favorites';
import { usePlayer } from '../store/player';
import { TrackTable } from './index';
import s from './ui.module.css';

const track: Track = { id: 'track', title: 'Test song', artistId: 'artist', artist: 'Test artist', releaseId: 'album', release: 'Test album', durationSec: 61 };

beforeEach(() => usePlayer.setState({ queue: [], index: 0, playing: false }));

it('plays the clicked row', () => {
  const onPlay = vi.fn();
  render(<TrackTable tracks={[track]} variant="release" onPlay={onPlay} />);
  fireEvent.click(screen.getByText('Test song'));
  expect(onPlay).toHaveBeenCalledWith(track);
  expect(onPlay).toHaveBeenCalledTimes(1);
});

it('toggles favorite without playing its row', () => {
  const onPlay = vi.fn();
  function Harness() {
    const [favorite, setFavorite] = useState(false);
    const fav: FavControl = { isFav: () => favorite, toggle: () => setFavorite((value) => !value) };
    return <TrackTable tracks={[track]} variant="release" onPlay={onPlay} fav={fav} />;
  }
  render(<Harness />);
  const heart = screen.getByRole('button', { name: 'Добавить в фонотеку' });
  fireEvent.click(heart);
  expect(screen.getByRole('button', { name: 'Убрать из фонотеки' })).toHaveAttribute('aria-pressed', 'true');
  expect(onPlay).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Убрать из фонотеки' }));
  expect(screen.getByRole('button', { name: 'Добавить в фонотеку' })).toHaveAttribute('aria-pressed', 'false');
  expect(onPlay).not.toHaveBeenCalled();
});

it('shows the web soon heart as disabled and does not toggle it', () => {
  const onPlay = vi.fn();
  const toggle = vi.fn();
  render(<TrackTable tracks={[track]} variant="release" onPlay={onPlay} fav={{ isFav: () => false, toggle, soon: true }} />);
  const heart = screen.getByRole('button', { name: 'Избранное — скоро' });
  expect(heart).toHaveAttribute('aria-disabled', 'true');
  expect(heart).toHaveAttribute('tabindex', '-1');
  fireEvent.click(heart);
  expect(toggle).not.toHaveBeenCalled();
  expect(onPlay).not.toHaveBeenCalled();
});

it('exposes play and favorite as sibling buttons and does not mix them', () => {
  const onPlay = vi.fn();
  const toggle = vi.fn();
  render(<TrackTable tracks={[track]} variant="release" onPlay={onPlay} fav={{ isFav: () => false, toggle }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Играть «Test song»' }));
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(toggle).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить в фонотеку' }));
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(onPlay).toHaveBeenCalledTimes(1);
});

it('highlights only the playing node row when two tracks share one id', () => {
  // Мультипоиск: тот же трек пришёл и с локального контекста, и с чужого узла.
  // Плеер играет чужую версию — подсветка не должна переползти на локальную строку.
  const remote: Track = { ...track, host: 'ind.local:9000' };
  usePlayer.setState({ queue: [remote], index: 0, playing: true });
  const onPlay = vi.fn();
  render(<TrackTable tracks={[track, remote]} variant="library" onPlay={onPlay} />);
  const rows = screen.getAllByRole('button', { name: /«Test song»$/ }).map((b) => b.closest('div')!);
  expect(rows).toHaveLength(2);
  expect(rows[0]).not.toHaveClass(s.playing);
  expect(rows[1]).toHaveClass(s.playing);
  // Клик по неподсвеченной строке играет её, а не ставит на паузу чужую.
  fireEvent.click(screen.getByRole('button', { name: 'Играть «Test song»' }));
  expect(onPlay).toHaveBeenCalledWith(track);
});
