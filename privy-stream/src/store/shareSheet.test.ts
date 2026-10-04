import { beforeEach, expect, it } from 'vitest';
import { useShareSheet } from './shareSheet';
import type { Release, Track } from '../api/types';

const track: Track = { id: 't1', title: 'Song', artistId: 'a', artist: 'Artist', releaseId: 'r1', release: 'Album', durationSec: 60 };
const release: Release = { id: 'r1', title: 'Album', artistId: 'a', artist: 'Artist', flagged: false };

beforeEach(() => {
  useShareSheet.getState().close();
});

it('opens with a target and closes back to null', () => {
  expect(useShareSheet.getState().target).toBeNull();
  useShareSheet.getState().open({ kind: 'track', track });
  expect(useShareSheet.getState().target).toEqual({ kind: 'track', track });
  useShareSheet.getState().close();
  expect(useShareSheet.getState().target).toBeNull();
});

it('replaces the target when opened again', () => {
  useShareSheet.getState().open({ kind: 'track', track });
  useShareSheet.getState().open({ kind: 'release', release });
  expect(useShareSheet.getState().target).toEqual({ kind: 'release', release });
});

it('remembers the trigger element for focus return', () => {
  document.body.innerHTML = '<button id="trigger">Поделиться</button>';
  const trigger = document.getElementById('trigger')!;
  trigger.focus();
  useShareSheet.getState().open({ kind: 'track', track });
  expect(useShareSheet.getState().trigger).toBe(trigger);
});
