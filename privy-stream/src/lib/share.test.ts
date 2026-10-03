import { expect, it } from 'vitest';
import type { ArtistRef, Release, Track } from '../api/types';
import { buildShareText, buildShareUrl, smsHref } from './share';

const loc = (protocol: string, origin = 'https://node.example', pathname = '/'): Location =>
  ({ protocol, origin, pathname }) as Location;

const track: Track = {
  id: 't1',
  title: 'Song',
  artistId: 'ar1',
  artist: 'Artist',
  releaseId: 'rel1',
  release: 'Album',
  durationSec: 100,
};
const release: Release = { id: 'rel1', title: 'Album', artistId: 'ar1', artist: 'Artist', flagged: false, code: 'PS-001' };
const artist: ArtistRef = { id: 'ar1', name: 'Artist' };

it('builds album, artist and track links from an http(s) location', () => {
  expect(buildShareUrl({ kind: 'release', release }, loc('https:'))).toBe('https://node.example/#/album/rel1');
  expect(buildShareUrl({ kind: 'artist', artist }, loc('https:'))).toBe('https://node.example/#/artist/ar1');
  // Трек — альбом с параметром ?t=, страницу трека в API v1 не открыть.
  expect(buildShareUrl({ kind: 'track', track }, loc('https:'))).toBe('https://node.example/#/album/rel1?t=t1');
});

it('keeps the pathname of the http LAN deployment in the link', () => {
  expect(buildShareUrl({ kind: 'release', release }, loc('http:', 'http://192.168.1.4:8081'))).toBe(
    'http://192.168.1.4:8081/#/album/rel1',
  );
});

it('returns null outside http(s) — app mode has no public address', () => {
  expect(buildShareUrl({ kind: 'release', release }, loc('tauri:'))).toBeNull();
  expect(buildShareUrl({ kind: 'track', track }, loc('file:'))).toBeNull();
});

it('returns null for a track whose release is unknown', () => {
  const orphan = { ...track, releaseId: '' };
  expect(buildShareUrl({ kind: 'track', track: orphan }, loc('https:'))).toBeNull();
});

it('encodes ids with special characters', () => {
  const tricky = { ...release, id: 'a b/c' };
  expect(buildShareUrl({ kind: 'release', release: tricky }, loc('https:'))).toBe(
    'https://node.example/#/album/a%20b%2Fc',
  );
  const trickyTrack = { ...track, id: 'x&y' };
  expect(buildShareUrl({ kind: 'track', track: trickyTrack }, loc('https:'))).toBe(
    'https://node.example/#/album/rel1?t=x%26y',
  );
});

it('builds messenger text with the link on its own line', () => {
  const url = 'https://node.example/#/album/rel1';
  expect(buildShareText({ kind: 'release', release }, url, 'node.example:8443')).toBe(
    `«Album» — Artist · Privy Stream\n${url}`,
  );
  expect(buildShareText({ kind: 'track', track }, url, 'node.example:8443')).toBe(
    `«Song» — Artist · Privy Stream\n${url}`,
  );
  expect(buildShareText({ kind: 'artist', artist }, url, 'node.example:8443')).toBe(
    `«Artist» — артист · Privy Stream\n${url}`,
  );
});

it('builds app-mode text with node and catalog lines when there is no url', () => {
  expect(buildShareText({ kind: 'release', release }, null, 'node.example:8443')).toBe(
    '«Album» — Artist · Privy Stream\nУзел: node.example:8443\nКаталог: PS-001',
  );
  // Без каталожного кода строки «Каталог» нет (API v1 его не гарантирует).
  expect(buildShareText({ kind: 'track', track }, null, 'node.example:8443')).toBe(
    '«Song» — Artist · Privy Stream\nУзел: node.example:8443',
  );
});

it('formats sms body separator per platform', () => {
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
  const body = 'Послушай «Song» https://node.example/#/album/rel1';
  expect(smsHref(body, ios)).toBe(`sms:&body=${encodeURIComponent(body)}`);
  expect(smsHref(body, android)).toBe(`sms:?body=${encodeURIComponent(body)}`);
  // Платформу не распознали — Android-разделитель: он встречается чаще.
  expect(smsHref(body, 'Mozilla/5.0 (X11; Linux x86_64)')).toBe(`sms:?body=${encodeURIComponent(body)}`);
});
