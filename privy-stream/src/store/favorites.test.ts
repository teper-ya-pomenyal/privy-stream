import { beforeEach, expect, it } from 'vitest';
import type { Track } from '../api';
import { useFavorites } from './favorites';

const a: Track = { id: 'a', title: 'First', artistId: 'artist', artist: 'Artist', releaseId: 'album', release: 'Album', durationSec: 61 };
const b: Track = { ...a, id: 'b', title: 'Second' };

beforeEach(() => useFavorites.setState({ ids: [], tracks: {} }));

it('keeps ordered ids and a snapshot of each favorited track', () => {
  useFavorites.getState().toggle(b);
  useFavorites.getState().toggle(a);
  expect(useFavorites.getState().ids).toEqual(['b', 'a']);
  expect(useFavorites.getState().tracks).toEqual({ a, b });
});

it('deduplicates a repeated favorite after toggling it off and on', () => {
  useFavorites.getState().toggle(a);
  useFavorites.getState().toggle(a);
  expect(useFavorites.getState()).toMatchObject({ ids: [], tracks: {} });
  useFavorites.getState().toggle(a);
  expect(useFavorites.getState().ids).toEqual(['a']);
});

it('removes an id and its cached snapshot together', () => {
  useFavorites.getState().toggle(a);
  useFavorites.getState().toggle(b);
  useFavorites.getState().remove('a');
  expect(useFavorites.getState()).toMatchObject({ ids: ['b'], tracks: { b } });
});
