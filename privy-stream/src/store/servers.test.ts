import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { probe: vi.fn() },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // Импорт session.ts (из remove) вызывает её на верхнем уровне.
  setAuthExpiredHandler: vi.fn(),
}));

import { nodeApi } from '../api';
import { useServers } from './servers';
import { useSession } from './session';

const descriptor = { name: 'node-a', owner: 'own', access: 'open', note: '' };
const okProbe = { descriptor, ping: 12 };
const stored = (id: string, host: string, status: 'online' | 'offline' = 'offline') => ({
  id, host, name: id, owner: '', access: '', note: '', ping: status === 'online' ? 12 : null, status,
});

beforeEach(() => {
  vi.mocked(nodeApi.probe).mockReset();
  useServers.setState({ nodes: [], activeId: '', connectingId: null, adding: false, checking: false, error: '' });
  useSession.setState({ host: null, restoring: false });
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

it('treats schemeless and http:// forms of one address as the same node', async () => {
  vi.mocked(nodeApi.probe).mockResolvedValue(okProbe);
  await useServers.getState().add('http://10.0.0.5:8443');
  const second = await useServers.getState().add('10.0.0.5:8443');
  expect(second).toBeNull();
  expect(useServers.getState().error).toContain('уже в списке');
  expect(useServers.getState().nodes).toHaveLength(1);
});

it('falls back to https and stores the address with it when only TLS answers', async () => {
  vi.mocked(nodeApi.probe).mockRejectedValueOnce(new Error('503 · нет ответа')).mockResolvedValueOnce(okProbe);
  const result = await useServers.getState().add('10.0.0.5:8443');
  expect(result).toEqual({ id: expect.any(String), online: true });
  expect(useServers.getState().nodes[0]).toMatchObject({ host: 'https://10.0.0.5:8443', status: 'online' });
});

it('checkActive reports the reason when the node still does not answer', async () => {
  useServers.setState({
    nodes: [{ id: 'n1', host: '10.0.0.5:8080', name: 'n', owner: '', access: '', note: '', ping: null, status: 'offline' }],
    activeId: 'n1',
    error: '',
  });
  vi.mocked(nodeApi.probe).mockRejectedValue(new Error('503 · 10.0.0.5:8080 не отвечает'));
  await useServers.getState().checkActive();
  expect(useServers.getState().checking).toBe(false);
  expect(useServers.getState().error).toContain('503 · 10.0.0.5:8080 не отвечает');
});

it('checkActive brings the node online and clears the error', async () => {
  useServers.setState({
    nodes: [{ id: 'n1', host: '10.0.0.5:8080', name: 'n', owner: '', access: '', note: '', ping: null, status: 'offline' }],
    activeId: 'n1',
    error: '503 · 10.0.0.5:8080 не отвечает',
  });
  vi.mocked(nodeApi.probe).mockResolvedValue(okProbe);
  await useServers.getState().checkActive();
  expect(useServers.getState().nodes[0]).toMatchObject({ status: 'online', ping: 12 });
  expect(useServers.getState().error).toBe('');
});

it('remove drops the node together with the session bound to it', async () => {
  useServers.setState({ nodes: [stored('n1', '10.0.0.5:8080', 'online'), stored('n2', '10.0.0.6:8080')], activeId: 'n1' });
  useSession.setState({ host: '10.0.0.5:8080' });
  await useServers.getState().remove('n1');
  expect(useServers.getState().nodes.map((n) => n.id)).toEqual(['n2']);
  // Активный узел не автоподменяется: выбор остается за пользователем.
  expect(useServers.getState().activeId).toBe('');
  expect(useSession.getState().host).toBeNull();
});

it('remove keeps the active node and its session when another node goes', async () => {
  useServers.setState({ nodes: [stored('n1', '10.0.0.5:8080', 'online'), stored('n2', '10.0.0.6:8080')], activeId: 'n1' });
  useSession.setState({ host: '10.0.0.5:8080' });
  await useServers.getState().remove('n2');
  expect(useServers.getState().nodes.map((n) => n.id)).toEqual(['n1']);
  expect(useServers.getState().activeId).toBe('n1');
  expect(useSession.getState().host).toBe('10.0.0.5:8080');
});

it('remove ignores an unknown id', async () => {
  useServers.setState({ nodes: [stored('n1', '10.0.0.5:8080')], activeId: 'n1' });
  await useServers.getState().remove('ghost');
  expect(useServers.getState().nodes).toHaveLength(1);
});
