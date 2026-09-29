import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { probe: vi.fn() },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

import { nodeApi } from '../api';
import { useServers } from './servers';

const descriptor = { name: 'node-a', owner: 'own', access: 'open', note: '' };
const okProbe = { descriptor, ping: 12 };

beforeEach(() => {
  vi.mocked(nodeApi.probe).mockReset();
  useServers.setState({ nodes: [], activeId: '', connectingId: null, adding: false, error: '' });
});

it('adds an answered node as online', async () => {
  vi.mocked(nodeApi.probe).mockResolvedValue(okProbe);
  const result = await useServers.getState().add('10.0.0.5:8443');
  expect(result).toEqual({ id: expect.any(String), online: true });
  expect(useServers.getState().nodes[0]).toMatchObject({ host: '10.0.0.5:8443', status: 'online', ping: 12 });
});

it('keeps an unreachable node but reports it is not online', async () => {
  vi.mocked(nodeApi.probe).mockRejectedValue(new Error('503 · нет ответа'));
  const result = await useServers.getState().add('10.0.0.5:8443');
  expect(result).toEqual({ id: expect.any(String), online: false });
  expect(useServers.getState().nodes[0]).toMatchObject({ host: '10.0.0.5:8443', status: 'offline' });
  expect(useServers.getState().error).toContain('503 · нет ответа');
  expect(useServers.getState().error).toContain('сохранён');
});

it('allows the same ip on different ports', async () => {
  vi.mocked(nodeApi.probe).mockResolvedValue(okProbe);
  await useServers.getState().add('10.0.0.5:8443');
  const second = await useServers.getState().add('10.0.0.5:8444');
  expect(second).toEqual({ id: expect.any(String), online: true });
  expect(useServers.getState().nodes).toHaveLength(2);
});

it('rejects a malformed address without adding anything', async () => {
  expect(await useServers.getState().add('not a host')).toBeNull();
  expect(useServers.getState().nodes).toHaveLength(0);
});
