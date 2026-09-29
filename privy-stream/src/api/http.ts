// HTTP-реализация NodeApi по контракту api/v1/openapi.yaml (Privy Stream API 1.0.0).
// Только пользовательские эндпоинты: авторизация, GET каталога/стрима и отметка прослушивания.
// Админские POST (добавление артистов, альбомов, треков, загрузка файлов) сюда не входят.

import { secrets } from '../platform/secrets';
import { NodeError, type AuthTokens, type NodeApi, type Release, type Track } from './types';

// ---------- Схемы ответов (components/schemas) ----------

interface ApiAuthResponse {
  user_uuid: string;
  access_token: string;
  refresh_token: string;
  birth_date?: string;
}
interface ApiRefreshResponse {
  access_token: string;
  refresh_token: string;
}
interface ApiTrack {
  track_uuid: string;
  track_name: string;
  artist_uuid: string;
  artist_name: string;
  album_uuid: string;
  album_name: string;
  explicit: boolean;
  duration_ms: number;
  cover_path?: string;
}
interface ApiLightTrack {
  track_uuid: string;
  track_name: string;
  explicit: boolean;
  duration_ms: number;
}
interface ApiArtist {
  artist_uuid: string;
  artist_name: string;
}
interface ApiLightAlbum {
  album_uuid: string;
  album_name: string;
  created_at: string;
  cover_path?: string;
}
interface ApiAlbum extends ApiLightAlbum {
  artist_uuid: string;
}

/** Сколько элементов брать в списках (limit в API, по умолчанию там 20). */
const PAGE = 50;
const PROBE_TIMEOUT_MS = 5000;

// ---------- Адрес узла ----------

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^.]+\.local(:|$))/;

/**
 * baseURL узла. Схему можно указать явно (https://…). Без неё локальные и
 * приватные адреса идут по http (gateway в docker-compose слушает plain HTTP),
 * остальные — только по https, чтобы пароль не уходил в сеть открытым текстом.
 */
export function baseUrl(host: string): string {
  if (/^https?:\/\//.test(host)) return host.replace(/\/+$/, '');
  return `${PRIVATE_HOST.test(host) ? 'http' : 'https'}://${host}`;
}

// ---------- Ошибки ----------

type ErrorMessages = Partial<Record<number, string>>;

const COMMON_MESSAGES: ErrorMessages = {
  400: 'неверные данные запроса',
  401: 'сессия истекла, войди заново',
  403: 'доступ запрещён',
  404: 'не найдено на узле',
  409: 'уже существует',
  500: 'внутренняя ошибка узла',
};

async function toNodeError(res: Response, messages: ErrorMessages = {}): Promise<NodeError> {
  const known = messages[res.status] ?? COMMON_MESSAGES[res.status];
  // Gateway отвечает на ошибки text/plain (http.Error) на английском.
  const text = known ?? ((await res.text().catch(() => '')).trim() || res.statusText);
  return new NodeError(res.status, text);
}

// Коды ошибок валидации POST /register (ValidationError в openapi.yaml).
const REGISTER_ERRORS: Record<string, string> = {
  login_required: 'логин: укажи логин',
  login_too_short: 'логин: минимум 3 символа',
  login_too_long: 'логин: максимум 20 символов',
  login_invalid_characters: 'логин: только латиница, цифры и . _ -, без двух спецсимволов подряд',
  password_required: 'пароль: укажи пароль',
  password_too_short: 'пароль: минимум 8 символов',
  password_too_long: 'пароль: максимум 128 символов',
  password_missing_special: 'пароль: нужен хотя бы один спецсимвол (!@#$% и т.п.)',
  birth_date_required: 'дата рождения: укажи дату',
  birth_date_invalid_format: 'дата рождения: неверный формат',
  birth_date_out_of_range: 'дата рождения: не раньше 1900 года и не в будущем',
};

async function registerError(res: Response): Promise<NodeError> {
  if (res.status === 400) {
    const body = (await res.clone().json().catch(() => null)) as { code?: string } | null;
    const text = body?.code ? REGISTER_ERRORS[body.code] : undefined;
    if (text) return new NodeError(400, text);
  }
  return toNodeError(res, {
    400: 'неверные данные регистрации',
    409: 'пользователь с таким логином уже есть на узле',
  });
}

async function send(host: string, path: string, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
  try {
    return await fetch(baseUrl(host) + path, { ...init, signal: ctrl.signal });
  } catch {
    // Сеть, DNS, CORS или таймаут — для пользователя это одно: узел недоступен.
    throw new NodeError(503, `${host} не отвечает`);
  } finally {
    clearTimeout(timer);
  }
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ---------- Токены ----------

/** Вызывается, когда refresh-токен больше не действует: сессию на узле надо открыть заново. */
let onAuthExpired: (host: string) => void = () => {};
export function setAuthExpiredHandler(handler: (host: string) => void) {
  onAuthExpired = handler;
}

const toTokens = (r: ApiRefreshResponse): AuthTokens => ({ access: r.access_token, refresh: r.refresh_token });

// Refresh-токен ротируется: одновременные 401 должны делить один запрос /refresh.
const refreshing = new Map<string, Promise<AuthTokens>>();

function refreshTokens(host: string, current: AuthTokens): Promise<AuthTokens> {
  let pending = refreshing.get(host);
  if (!pending) {
    pending = (async () => {
      const res = await send(host, '/refresh', json({ refresh_token: current.refresh }));
      if (!res.ok) {
        await secrets.remove(host);
        onAuthExpired(host);
        throw await toNodeError(res, { 401: 'сессия истекла, войди заново' });
      }
      const tokens = toTokens(await res.json());
      await secrets.set(host, tokens);
      return tokens;
    })().finally(() => refreshing.delete(host));
    refreshing.set(host, pending);
  }
  return pending;
}

/** Запрос с Bearer-токеном (по умолчанию GET); при 401 один раз обновляет пару токенов и повторяет. */
async function authed(host: string, path: string, messages?: ErrorMessages, method = 'GET'): Promise<Response> {
  let tokens = await secrets.get(host);
  if (!tokens) {
    onAuthExpired(host);
    throw new NodeError(401, 'нет сессии на этом узле, войди заново');
  }
  const request = (t: AuthTokens) => send(host, path, { method, headers: { Authorization: `Bearer ${t.access}` } });

  let res = await request(tokens);
  if (res.status === 401) {
    tokens = await refreshTokens(host, tokens);
    res = await request(tokens);
  }
  if (!res.ok) throw await toNodeError(res, messages);
  return res;
}

async function getJson<T>(host: string, path: string, messages?: ErrorMessages): Promise<T> {
  const res = await authed(host, path, messages);
  // Пустые списки Go может отдать как null.
  return ((await res.json()) ?? []) as T;
}

const q = (params: Record<string, string | number>) => '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
const id = (s: string) => encodeURIComponent(s);

// ---------- Маппинг в модель клиента ----------

function fromTrack(t: ApiTrack, host: string): Track {
  return {
    id: t.track_uuid,
    title: t.track_name,
    artistId: t.artist_uuid,
    artist: t.artist_name,
    releaseId: t.album_uuid,
    release: t.album_name,
    durationSec: Math.round((t.duration_ms ?? 0) / 1000),
    explicit: t.explicit,
    coverPath: t.cover_path || undefined,
    host,
  };
}

function fromLightTrack(t: ApiLightTrack, host: string, ctx: Pick<Track, 'artistId' | 'artist' | 'releaseId' | 'release'>): Track {
  return {
    id: t.track_uuid,
    title: t.track_name,
    durationSec: Math.round((t.duration_ms ?? 0) / 1000),
    explicit: t.explicit,
    host,
    ...ctx,
  };
}

function fromAlbum(a: ApiLightAlbum, artist: ApiArtist, flagged = false): Release {
  return {
    id: a.album_uuid,
    title: a.album_name,
    artistId: artist.artist_uuid,
    artist: artist.artist_name,
    flagged,
    createdAt: a.created_at,
    coverPath: a.cover_path || undefined,
  };
}

// ---------- NodeApi ----------

export const httpNodeApi: NodeApi = {
  async probe(host) {
    // Дескриптора узла в API v1 нет. Живость проверяем любым ответом gateway:
    // поиск без токена отдаёт 401 — значит, узел на месте.
    const started = performance.now();
    await send(host, `/catalog/tracks/search${q({ track_name: '' })}`, {}, PROBE_TIMEOUT_MS);
    const ping = Math.max(1, Math.round(performance.now() - started));
    return {
      descriptor: {
        name: host.replace(/^https?:\/\//, '').split(':')[0],
        owner: 'добавлен тобой',
        access: 'неизвестно',
        note: 'API v1 не отдаёт описание узла',
      },
      ping,
    };
  },

  async login(host, { login, password }) {
    const res = await send(host, '/login', json({ user_name: login, password }));
    if (!res.ok) throw await toNodeError(res, { 400: 'логин или пароль неверны', 401: 'логин или пароль неверны' });
    return toTokens((await res.json()) as ApiAuthResponse);
  },

  async register(host, { login, password, birthDate }) {
    const res = await send(host, '/register', json({ user_name: login, password, birth_date: birthDate }));
    if (!res.ok) throw await registerError(res);
    return toTokens((await res.json()) as ApiAuthResponse);
  },

  async logout(host, tokens) {
    await send(host, '/logout', {
      ...json({ refresh_token: tokens.refresh }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access}` },
    });
  },

  async search(host, query) {
    const [tracks, artists] = await Promise.all([
      getJson<ApiTrack[]>(host, `/catalog/tracks/search${q({ track_name: query, limit: PAGE })}`),
      getJson<ApiArtist[]>(host, `/catalog/artists/search${q({ artist_name: query, limit: PAGE })}`),
    ]);
    return {
      tracks: tracks.map((t) => fromTrack(t, host)),
      artists: artists.map((a) => ({ id: a.artist_uuid, name: a.artist_name })),
    };
  },

  async release(host, releaseId) {
    const notFound = { 400: 'релиз не найден на узле', 404: 'релиз не найден на узле' };
    const [album, tracks] = await Promise.all([
      getJson<ApiAlbum>(host, `/catalog/albums/${id(releaseId)}`, notFound),
      getJson<ApiLightTrack[]>(host, `/catalog/albums/${id(releaseId)}/tracks`, notFound),
    ]);
    // Альбом плоский — имя артиста отдельным запросом.
    const artist = await getJson<ApiArtist>(host, `/catalog/artists/${id(album.artist_uuid)}`);
    const ctx = { artistId: artist.artist_uuid, artist: artist.artist_name, releaseId: album.album_uuid, release: album.album_name };
    const mapped = tracks.map((t) => fromLightTrack(t, host, ctx));
    return { ...fromAlbum(album, artist, mapped.some((t) => t.explicit)), tracks: mapped };
  },

  async artist(host, artistId) {
    const notFound = { 400: 'артист не найден на узле', 404: 'артист не найден на узле' };
    const [artist, albums, tracks] = await Promise.all([
      getJson<ApiArtist>(host, `/catalog/artists/${id(artistId)}`, notFound),
      getJson<ApiLightAlbum[]>(host, `/catalog/artists/${id(artistId)}/albums${q({ limit: PAGE })}`),
      getJson<ApiLightTrack[]>(host, `/catalog/artists/${id(artistId)}/tracks${q({ limit: PAGE })}`),
    ]);
    const ctx = { artistId: artist.artist_uuid, artist: artist.artist_name, releaseId: '', release: '' };
    return {
      id: artist.artist_uuid,
      name: artist.artist_name,
      releases: albums.map((a) => fromAlbum(a, artist)),
      popular: tracks.map((t) => fromLightTrack(t, host, ctx)),
    };
  },

  async stream(host, trackId) {
    // /stream требует заголовок Authorization, а <audio src> его не отправляет.
    // Пока трек скачивается целиком и играет из памяти. Range-стриминг — через
    // кастомный протокол Tauri на стороне Rust (см. README).
    const res = await authed(host, `/stream/${id(trackId)}`, {
      403: 'трек 18+ заблокирован для твоего аккаунта',
      404: 'трек не найден на узле',
      500: 'узел не смог отдать файл трека',
    });
    return URL.createObjectURL(await res.blob());
  },

  async markListened(host, trackId) {
    try {
      await authed(host, `/catalog/tracks/${id(trackId)}/listened`, undefined, 'POST');
    } catch (e) {
      // Сеть федеративная: на узле может стоять gateway без этого эндпоинта (404/405),
      // а 429 — «уже засчитано недавно» (лимит узла), оба случая не ошибки клиента.
      if (e instanceof NodeError && (e.code === 404 || e.code === 405 || e.code === 429)) return;
      throw e;
    }
  },
};
