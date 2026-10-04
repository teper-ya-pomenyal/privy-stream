export type NodeStatus = 'online' | 'offline';

/** Узел в локальном списке клиента. */
export interface NodeInfo {
  id: string;
  name: string;
  host: string;
  owner: string;
  access: string;
  note: string;
  /** Последний измеренный пинг, мс. null — не измерялся или узел не ответил. */
  ping: number | null;
  status: NodeStatus;
}

/** То, что клиент знает об узле после handshake. */
export type NodeDescriptor = Pick<NodeInfo, 'name' | 'owner' | 'access' | 'note'>;

/**
 * Релиз (альбом). Год, жанр, формат и каталожный код API v1 не отдаёт — необязательные.
 */
export interface Release {
  id: string;
  title: string;
  artistId: string;
  artist: string;
  /** Есть explicit-треки (18+ / без фильтра) */
  flagged: boolean;
  code?: string;
  year?: number;
  genre?: string;
  format?: string;
  /** Когда релиз появился на узле (ISO) */
  createdAt?: string;
  /**
   * Путь файла обложки в хранилище узла (GET /catalog/albums/{id}, cover_path).
   * Пусто — обложки нет, показать генеративную заглушку. Сам файл читается
   * методом coverUrl (GET /catalog/albums/{id}/cover).
   */
  coverPath?: string;
  /** Узел, с которого сущность пришла в мультинодовом поиске */
  host?: string;
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artist: string;
  releaseId: string;
  /** Пусто, если узел не отдал альбом (например, в треках артиста) */
  release: string;
  durationSec: number;
  explicit?: boolean;
  format?: string;
  /**
   * Путь файла обложки в хранилище узла. Узел отдаёт его только в поиске
   * (схема Track); в треклистах альбомов и артистов (LightTrack) поля нет,
   * там обложку берут у альбома. Совпадает с cover_path альбома.
   */
  coverPath?: string;
  /** Узел, с которого стримится трек. Нет — трек локальный. */
  host?: string;
}

export interface ReleaseDetails extends Release {
  tracks: Track[];
}

export interface ArtistRef {
  id: string;
  name: string;
  /** Узел, с которого сущность пришла в мультинодовом поиске */
  host?: string;
}

export interface ArtistDetails extends ArtistRef {
  activeYears?: string;
  releases: Release[];
  popular: Track[];
  /** В API v1 статистики нет — блок показывается, только если узел её отдал. */
  stats?: {
    listeners: number;
    countriesUnblocked: number;
    inLibraries: number;
  };
}

export interface SearchResult {
  artists: ArtistRef[];
  tracks: Track[];
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface Credentials {
  login: string;
  password: string;
}

/** Ошибка узла. В UI всегда выводится как «код · сообщение». */
export class NodeError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'NodeError';
  }

  toString() {
    return `${this.code} · ${this.message}`;
  }
}

export function errorText(e: unknown): string {
  if (e instanceof NodeError) return e.toString();
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Всё, что клиент запрашивает у узла. Каждый метод принимает host первым аргументом:
 * baseURL подставляется из выбранного узла. Токены реализация берёт сама.
 */
export interface NodeApi {
  /** Handshake: проверить, что узел отвечает, и измерить пинг. */
  probe(host: string): Promise<{ descriptor: NodeDescriptor; ping: number }>;
  login(host: string, creds: Credentials): Promise<AuthTokens>;
  register(host: string, creds: Credentials & { birthDate: string }): Promise<AuthTokens>;
  /** Инвалидировать refresh-сессию на узле. */
  logout(host: string, tokens: AuthTokens): Promise<void>;
  /**
   * Полка узла без запроса. В API v1 такого эндпоинта нет — метод есть только у мока;
   * без него каталог работает только через поиск.
   */
  browse?(host: string): Promise<Release[]>;
  search(host: string, query: string): Promise<SearchResult>;
  release(host: string, id: string): Promise<ReleaseDetails>;
  artist(host: string, id: string): Promise<ArtistDetails>;
  /** URL для <audio>. null — у узла нет потока для трека (мок). */
  stream(host: string, trackId: string): Promise<string | null>;
  /**
   * Blob-URL обложки релиза для <img>. null — обложки нет или узел не отдал её
   * (старые gateway федеративной сети без GET .../cover). Как stream: <img> не
   * отправляет Authorization, поэтому картинка качается авторизованным fetch.
   */
  coverUrl(host: string, releaseId: string): Promise<string | null>;
  /**
   * Засчитать прослушивание (POST /catalog/tracks/{id}/listened). Узел хранит только
   * общий счётчик трека, без привязки к пользователю. Молча пропускаются: узлы без
   * эндпоинта (404/405) и ответ 429 — трек уже засчитан недавно, это не ошибка.
   */
  markListened(host: string, trackId: string): Promise<void>;
}
