import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn() }));
vi.mock('@tauri-apps/plugin-store', () => ({ load: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_CLIENT_MODE', 'app');
  vi.mocked(isTauri).mockReturnValue(false);
  localStorage.clear();
});
afterEach(() => vi.unstubAllEnvs());

it('uses localStorage in browser app mode', async () => {
  const { nodesStorage } = await import('./nodesStorage');
  const storage = nodesStorage<{ nodes: string[] }>()!;
  await storage.setItem('privy.servers', { state: { nodes: ['one'] }, version: 1 });
  expect(await storage.getItem('privy.servers')).toEqual({ state: { nodes: ['one'] }, version: 1 });
  expect(localStorage.getItem('privy.servers')).toContain('one');
});

it('uses no persistent storage in web mode', async () => {
  vi.stubEnv('VITE_CLIENT_MODE', 'web');
  const { nodesStorage } = await import('./nodesStorage');
  const storage = nodesStorage<{ nodes: string[] }>()!;
  await storage.setItem('privy.servers', { state: { nodes: ['one'] }, version: 1 });
  expect(await storage.getItem('privy.servers')).toBeNull();
  expect(localStorage.getItem('privy.servers')).toBeNull();
});

it('migrates a legacy localStorage snapshot into the Tauri file', async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  const values = new Map<string, unknown>();
  const file = { get: vi.fn(async (name: string) => values.get(name)), set: vi.fn(async (name: string, value: unknown) => { values.set(name, value); }), delete: vi.fn(), save: vi.fn() };
  vi.mocked(load).mockResolvedValue(file as never);
  const legacy = { state: { nodes: ['legacy'] }, version: 1 };
  localStorage.setItem('privy.servers', JSON.stringify(legacy));
  const { nodesStorage } = await import('./nodesStorage');
  expect(await nodesStorage<{ nodes: string[] }>()!.getItem('privy.servers')).toEqual(legacy);
  expect(load).toHaveBeenCalledWith('nodes.json', { autoSave: false, defaults: {} });
  expect(values.get('privy.servers')).toEqual(legacy);
  expect(file.save).toHaveBeenCalledOnce();
  expect(localStorage.getItem('privy.servers')).toBeNull();
});
