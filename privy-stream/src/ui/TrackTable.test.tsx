import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Track } from '../api';
import type { FavControl } from '../store/favorites';
import { usePlayer } from '../store/player';
import { TrackTable } from './index';

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
