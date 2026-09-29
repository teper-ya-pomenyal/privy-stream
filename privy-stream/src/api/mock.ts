import { MOCK_ARTISTS, MOCK_NODES, MOCK_RELEASES, MOCK_TRACKS } from './mock-data';
import { NodeError, type NodeApi, type Track } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Веб-конфиг отдаёт адрес с схемой (https://…) — мок знает узлы в виде host:port. */
const bare = (host: string) => host.replace(/^https?:\/\//, '');

/** Адреса демо-узлов из макета — их обслуживает мок, а не HTTP. */
export const isMockHost = (host: string) => MOCK_NODES.some((n) => n.host === bare(host));

const nodeIdOf = (host: string) => MOCK_NODES.find((n) => n.host === bare(host))?.id;

async function reachable(host: string, latency = 220) {
  await delay(latency);
  const known = MOCK_NODES.find((n) => n.host === bare(host));
  if (known?.status === 'offline') throw new NodeError(503, `${host} не отвечает`);
}

const releasesOn = (host: string) => MOCK_RELEASES.filter((r) => r.node === nodeIdOf(host)).map((r) => r.release);
const tracksOn = (host: string): Track[] => {
  const ids = new Set(releasesOn(host).map((r) => r.id));
  return MOCK_TRACKS.filter((t) => ids.has(t.releaseId)).map((t) => ({ ...t, host }));
};

/** Мок узла: данные и задержки из макета. Проверки ввода — как в контракте API v1. */
export const mockNodeApi: NodeApi = {
  async probe(host) {
    await reachable(host, 650);
    const { name, owner, access, note, ping } = MOCK_NODES.find((n) => n.host === bare(host))!;
    return { descriptor: { name, owner, access, note }, ping: ping ?? 0 };
  },

  async login(host, { login, password }) {
    await reachable(host, 400);
    if (!login.trim() || password.length < 8) throw new NodeError(401, 'логин или пароль неверны');
    return { access: `mock-access.${login}`, refresh: `mock-refresh.${login}` };
  },

  async register(host, { login }) {
    await reachable(host, 400);
    return { access: `mock-access.${login}`, refresh: `mock-refresh.${login}` };
  },

  async logout() {},

  async browse(host) {
    await reachable(host);
    return releasesOn(host);
  },

  async search(host, query) {
    await reachable(host);
    const q = query.trim().toLowerCase();
    const tracks = tracksOn(host).filter((t) => `${t.title} ${t.artist} ${t.release}`.toLowerCase().includes(q));
    const artistIds = new Set(releasesOn(host).map((r) => r.artistId));
    const artists = [...artistIds]
      .map((id) => ({ id, name: MOCK_ARTISTS[id].name }))
      .filter((a) => a.name.toLowerCase().includes(q));
    return { tracks, artists };
  },

  async release(host, releaseId) {
    await reachable(host);
    const release = releasesOn(host).find((r) => r.id === releaseId);
    if (!release) throw new NodeError(404, 'релиз не найден на узле');
    return { ...release, tracks: tracksOn(host).filter((t) => t.releaseId === releaseId) };
  },

  async artist(host, artistId) {
    await reachable(host);
    const meta = MOCK_ARTISTS[artistId];
    const releases = releasesOn(host).filter((r) => r.artistId === artistId);
    if (!meta || releases.length === 0) throw new NodeError(404, 'артист не найден на узле');
    return {
      id: artistId,
      name: meta.name,
      activeYears: meta.activeYears,
      releases,
      popular: tracksOn(host).filter((t) => t.artistId === artistId).slice(0, 5),
      stats: { listeners: meta.listeners, countriesUnblocked: meta.countries, inLibraries: meta.inLibraries },
    };
  },

  // У мок-треков нет аудио — плеер идёт по часам.
  async stream() {
    return null;
  },

  // У мок-релизов нет файлов обложек — UI рисует генеративную заглушку.
  async coverUrl() {
    return null;
  },

  async markListened() {},
};

