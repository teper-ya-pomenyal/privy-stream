import { afterEach, expect, it, vi } from 'vitest';
import { nodeApi } from '../api';
import { secrets } from '../platform/secrets';
import { MULTI_SEARCH_TIMEOUT_MS, fanOutSearch, mergeOutcomes } from './multiSearch';
import { NodeError, type SearchResult, type Track } from './types';

vi.mock('../api', () => ({ nodeApi: { search: vi.fn() } }));
vi.mock('../platform/secrets', () => ({ secrets: { get: vi.fn() } }));

afterEach(() => vi.useRealTimers());

const search = vi.mocked(nodeApi.search);
const getTokens = vi.mocked(secrets.get);

const track = (id: string, host: string): Track => ({
  id,
  title: `Трек ${id}`,
  artistId: `artist-${id}`,
  artist: `Артист ${id}`,
  releaseId: `release-${id}`,
  release: `Релиз ${id}`,
  durationSec: 100,
  host,
});

it('ok-исходы склеиваются в порядке узлов', async () => {
  vi.useFakeTimers();
  const a: SearchResult = { artists: [{ id: 'a1', name: 'Артист А' }], tracks: [track('t1', 'a.test')] };
  const b: SearchResult = { artists: [{ id: 'b1', name: 'Артист Б' }], tracks: [track('t2', 'b.test'), track('t3', 'b.test')] };
  getTokens.mockResolvedValue({ access: 'acc', refresh: 'ref' });
  search.mockImplementation((host) => Promise.resolve(host === 'a.test' ? a : b));

  const outcomes = await fanOutSearch([{ host: 'a.test' }, { host: 'b.test' }], 'к heartbeat');
  expect(outcomes.map((o) => o.host)).toEqual(['a.test', 'b.test']);
  expect(outcomes.map((o) => o.status)).toEqual(['ok', 'ok']);
  expect(search).toHaveBeenCalledWith('a.test', 'к heartbeat');
  expect(search).toHaveBeenCalledWith('b.test', 'к heartbeat');

  const merged = mergeOutcomes(outcomes);
  expect(merged.artists).toEqual([
    { id: 'a1', name: 'Артист А', host: 'a.test' },
    { id: 'b1', name: 'Артист Б', host: 'b.test' },
  ]);
  expect(merged.tracks.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
});

it('узел без токенов не опрашивается', async () => {
  vi.useFakeTimers();
  getTokens.mockImplementation((host) =>
    Promise.resolve(host === 'closed.test' ? null : { access: 'acc', refresh: 'ref' }));
  search.mockResolvedValue({ artists: [], tracks: [] });

  const outcomes = await fanOutSearch([{ host: 'open.test' }, { host: 'closed.test' }], 'q');
  expect(outcomes.find((o) => o.host === 'closed.test')).toEqual({ host: 'closed.test', status: 'no-session' });
  expect(search).not.toHaveBeenCalledWith('closed.test', 'q');
  expect(search).toHaveBeenCalledTimes(1);
});

it('медленный узел даёт timeout, остальные отвечают', async () => {
  vi.useFakeTimers();
  getTokens.mockResolvedValue({ access: 'acc', refresh: 'ref' });
  search.mockImplementation((host) =>
    host === 'slow.test'
      ? new Promise<SearchResult>(() => {})
      : Promise.resolve({ artists: [{ id: 'f1', name: 'Быстрый' }], tracks: [track('t1', 'fast.test')] }));

  const pending = fanOutSearch([{ host: 'slow.test' }, { host: 'fast.test' }], 'q');
  await vi.advanceTimersByTimeAsync(MULTI_SEARCH_TIMEOUT_MS);
  const outcomes = await pending;
  expect(outcomes[0]).toEqual({ host: 'slow.test', status: 'timeout' });
  expect(outcomes[1]).toEqual({
    host: 'fast.test',
    status: 'ok',
    result: { artists: [{ id: 'f1', name: 'Быстрый' }], tracks: [track('t1', 'fast.test')] },
  });
});

it('503 маппится в unreachable, чужие результаты выживают', async () => {
  vi.useFakeTimers();
  getTokens.mockResolvedValue({ access: 'acc', refresh: 'ref' });
  search.mockImplementation((host) =>
    host === 'bad.test'
      ? Promise.reject(new NodeError(503, 'x не отвечает'))
      : Promise.resolve({ artists: [{ id: 'g1', name: 'Живой' }], tracks: [track('t1', 'good.test')] }));

  const outcomes = await fanOutSearch([{ host: 'bad.test' }, { host: 'good.test' }], 'q');
  expect(outcomes[0]).toEqual({ host: 'bad.test', status: 'unreachable' });
  expect(outcomes[1].status).toBe('ok');

  const merged = mergeOutcomes(outcomes);
  expect(merged.artists).toEqual([{ id: 'g1', name: 'Живой', host: 'good.test' }]);
  expect(merged.tracks.map((t) => t.id)).toEqual(['t1']);
});

it('401 маппится в no-session', async () => {
  vi.useFakeTimers();
  getTokens.mockResolvedValue({ access: 'acc', refresh: 'ref' });
  search.mockRejectedValue(new NodeError(401, 'нет сессии на этом узле, войди заново'));

  const [outcome] = await fanOutSearch([{ host: 'stale.test' }], 'q');
  expect(outcome).toEqual({ host: 'stale.test', status: 'no-session' });
  expect(outcome.error).toBeUndefined();
});
