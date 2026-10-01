import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { nodeApi, errorText, NodeError } from './index';
import { baseUrl } from './http';
import { secrets } from '../platform/secrets';

const host = 'https://node.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { server.resetHandlers(); localStorage.clear(); });
afterAll(() => server.close());

it('uses plain HTTP for schemeless nodes and keeps an explicit scheme', () => {
  expect(baseUrl('192.168.1.4:8443')).toBe('http://192.168.1.4:8443');
  expect(baseUrl('195.209.213.79:8080')).toBe('http://195.209.213.79:8080');
  expect(baseUrl('http://node.example/')).toBe('http://node.example');
  expect(baseUrl('https://node.example/')).toBe('https://node.example');
});

it('maps login failure to a user-facing NodeError', async () => {
  server.use(http.post(`${host}/login`, () => new HttpResponse(null, { status: 401 })));
  await expect(nodeApi.login(host, { login: 'listener', password: 'wrongpass' })).rejects.toMatchObject({ code: 401, message: 'логин или пароль неверны' });
});

it('maps register validation codes', async () => {
  server.use(http.post(`${host}/register`, () => HttpResponse.json({ code: 'password_missing_special' }, { status: 400 })));
  await expect(nodeApi.register(host, { login: 'listener', password: 'abcdefgh', birthDate: '1990-01-01' })).rejects.toMatchObject({ code: 400, message: 'пароль: нужен хотя бы один спецсимвол (!@#$% и т.п.)' });
});

it('refreshes an expired token and retries the real-node request', async () => {
  await secrets.set(host, { access: 'old', refresh: 'refresh-old' });
  server.use(
    http.get(`${host}/catalog/tracks/search`, ({ request }) => request.headers.get('Authorization') === 'Bearer old'
      ? new HttpResponse(null, { status: 401 })
      : HttpResponse.json([])),
    http.get(`${host}/catalog/artists/search`, () => HttpResponse.json([])),
    http.post(`${host}/refresh`, () => HttpResponse.json({ access_token: 'new', refresh_token: 'refresh-new' })),
  );
  expect(await nodeApi.search(host, 'night')).toEqual({ tracks: [], artists: [] });
  expect(await secrets.get(host)).toEqual({ access: 'new', refresh: 'refresh-new' });
});

it('routes a known mock node without making HTTP requests', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const result = await nodeApi.probe('eu3.privy.stream:8443');
  expect(result).toEqual({
    descriptor: {
      name: 'open.eu3',
      owner: 'alt_arkhiv',
      access: 'открытый',
      note: 'публичный узел, регистрация свободная',
    },
    ping: 12,
  });
  expect(fetch).not.toHaveBeenCalled();
});

it('renders errors with code and message', () => {
  expect(errorText(new NodeError(503, 'offline'))).toBe('503 · offline');
});
