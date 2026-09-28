import { httpNodeApi } from './http';
import { isMockHost, mockNodeApi } from './mock';
import type { NodeApi } from './types';

/**
 * Узлы с адресами из макета обслуживает мок (для демо без бэкенда),
 * все остальные — HTTP-клиент по контракту API v1.
 */
export const nodeApi: NodeApi = {
  probe: (host) => pick(host).probe(host),
  login: (host, creds) => pick(host).login(host, creds),
  register: (host, creds) => pick(host).register(host, creds),
  logout: (host, tokens) => pick(host).logout(host, tokens),
  search: (host, query) => pick(host).search(host, query),
  release: (host, id) => pick(host).release(host, id),
  artist: (host, id) => pick(host).artist(host, id),
  stream: (host, trackId) => pick(host).stream(host, trackId),
  markListened: (host, trackId) => pick(host).markListened(host, trackId),
};

const pick = (host: string): NodeApi => (isMockHost(host) ? mockNodeApi : httpNodeApi);

/** Полка узла без поиска — есть только у мока, в API v1 такого эндпоинта нет. */
export const browseApi = (host: string) => pick(host).browse;

export { setAuthExpiredHandler } from './http';
export * from './types';
