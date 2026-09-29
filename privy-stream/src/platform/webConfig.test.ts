import { expect, it, vi } from 'vitest';
import { loadWebConfig } from './webConfig';

function config(body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}

it('normalizes HTTP(S) node URLs and derives a fallback name', async () => {
  config({ node: { url: 'https://node.example/music///', name: '  ' } });
  expect(await loadWebConfig()).toEqual({ ok: true, config: { node: { url: 'https://node.example/music', name: 'node.example' } } });
});

it('rejects a non-HTTP node scheme', async () => {
  config({ node: { url: 'ftp://node.example' } });
  expect(await loadWebConfig()).toEqual({ ok: false, reason: 'адрес узла должен начинаться с https://' });
});

it('reports a missing node address', async () => {
  config({ node: {} });
  expect(await loadWebConfig()).toEqual({ ok: false, reason: 'не указан адрес узла (PRIVY_NODE_URL)' });
});
