import { beforeEach, describe, expect, it } from 'vitest';
import type { Track } from '../api';
import { usePlayer } from './player';

const first: Track = { id: 'a', title: 'First', artistId: 'artist', artist: 'Artist', releaseId: 'album', release: 'Album', durationSec: 120 };
const second: Track = { ...first, id: 'b', title: 'Second', durationSec: 240 };
const third: Track = { ...first, id: 'c', title: 'Third' };
const state = () => usePlayer.getState();

beforeEach(() => {
  usePlayer.setState({ queue: [], index: 0, playing: false, position: 0, seekNonce: 0, playId: 0, mediaDuration: 0, volume: 1, muted: false, repeat: 'off' });
});

describe('player queue and playback', () => {
  it('does not start an empty queue when toggled', () => {
    state().toggle();
    expect(state().playing).toBe(false);
  });

  it('handles next and prev with empty and single-item queues', () => {
    state().next();
    state().prev();
    expect(state()).toMatchObject({ index: 0, playing: false });
    state().play(first, [first]);
    state().next();
    expect(state()).toMatchObject({ index: 0, playing: true, playId: 4 });
    state().prev();
    expect(state()).toMatchObject({ index: 0, playing: true, playId: 5 });
  });

  it('appends a played item outside the supplied queue', () => {
    state().play(third, [first, second]);
    expect(state().queue.map((track) => track.id)).toEqual(['a', 'b', 'c']);
    expect(state()).toMatchObject({ index: 2, playing: true, playId: 1 });
  });

  it('cycles repeat and restarts a track with a fresh play id', () => {
    state().play(first, [first, second]);
    state().cycleRepeat();
    expect(state().repeat).toBe('all');
    state().cycleRepeat();
    expect(state().repeat).toBe('one');
    state().tick(99);
    state().trackEnded();
    expect(state()).toMatchObject({ index: 0, position: 0, playing: true, playId: 2 });
    state().cycleRepeat();
    expect(state().repeat).toBe('off');
  });

  it('stops at the last track with repeat off and wraps with repeat all', () => {
    state().play(second, [first, second]);
    state().trackEnded();
    expect(state()).toMatchObject({ index: 1, playing: false, playId: 1 });
    state().cycleRepeat();
    state().trackEnded();
    expect(state()).toMatchObject({ index: 0, playing: true, playId: 2 });
  });

  it('clamps seek and prefers media duration when present', () => {
    state().play(first);
    state().seek(2);
    expect(state().position).toBe(120);
    state().setMedia({ mediaDuration: 180 });
    state().seek(-1);
    expect(state().position).toBe(0);
    state().seek(0.5);
    expect(state().position).toBe(90);
  });

  it('moving volume unmutes and clamps the control', () => {
    state().toggleMute();
    state().setVolume(2);
    expect(state()).toMatchObject({ volume: 1, muted: false });
    state().setVolume(-1);
    expect(state().volume).toBe(0);
  });

  it('persists only the listening position and durable controls', () => {
    state().play(first, [first, second]);
    state().tick(42);
    state().setVolume(0.4);
    state().setMedia({ mediaDuration: 180, loading: true, error: 'temporary' });
    state().setFullscreen(true);
    const snapshot = usePlayer.persist.getOptions().partialize?.(state());
    expect(snapshot).toEqual({
      queue: [first, second],
      index: 0,
      position: 42,
      volume: 0.4,
      muted: false,
      repeat: 'off',
    });
  });
});
