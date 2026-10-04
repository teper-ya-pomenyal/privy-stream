import { secrets } from '../platform/secrets';
import { nodeApi } from './index';
import { NodeError, errorText, type ArtistRef, type SearchResult, type Track } from './types';

/** Итог опроса одного узла в мультипоиске: у мёртвого узла ошибка не должна ронять остальных. */
export type NodeSearchStatus = 'ok' | 'no-session' | 'unreachable' | 'timeout' | 'error';

export interface NodeSearchOutcome {
  host: string;
  status: NodeSearchStatus;
  /** Только для 'error' — текст errorText(e). */
  error?: string;
  /** Только для 'ok'. */
  result?: SearchResult;
}

/**
 * Сколько ждём ответ узла в мультипоиске. Федерация опрашивает сторонние узлы,
 * которые могут молчать: без общего потолка поиск виснет на первом мёртвом хосте.
 */
export const MULTI_SEARCH_TIMEOUT_MS = 5000;

export interface MergedSearch {
  artists: (ArtistRef & { host: string })[];
  tracks: Track[]; // Track уже несёт host от маппера
}

// 401 — сессия на узле истекла (как отсутствие токенов), 503 — узел недоступен (http.ts
// так помечает любую сетевую ошибку), остальное показываем как есть.
const outcomeOfError = (host: string, e: unknown): NodeSearchOutcome => {
  if (e instanceof NodeError && e.code === 401) return { host, status: 'no-session' };
  if (e instanceof NodeError && e.code === 503) return { host, status: 'unreachable' };
  return { host, status: 'error', error: errorText(e) };
};

/** Параллельный поиск по всем узлам; исходы в порядке входного массива, каждый со своим потолком времени. */
export async function fanOutSearch(nodes: readonly { host: string }[], query: string): Promise<NodeSearchOutcome[]> {
  const searchOn = async (host: string): Promise<NodeSearchOutcome> => {
    const tokens = await secrets.get(host).catch(() => null);
    if (!tokens) return { host, status: 'no-session' };
    return Promise.race([
      nodeApi.search(host, query).then(
        (result): NodeSearchOutcome => ({ host, status: 'ok', result }),
        (e): NodeSearchOutcome => outcomeOfError(host, e), // 401→no-session, 503→unreachable, иначе error+errorText
      ),
      new Promise<NodeSearchOutcome>((res) => setTimeout(() => res({ host, status: 'timeout' }), MULTI_SEARCH_TIMEOUT_MS)),
    ]);
  };
  return Promise.all(nodes.map((n) => searchOn(n.host)));
}

/** Чистая конкатенация ответивших узлов в порядке исходов: треки как есть, артисту хватает host его исхода. */
export function mergeOutcomes(outcomes: readonly NodeSearchOutcome[]): MergedSearch {
  return {
    artists: outcomes.flatMap((o) => (o.status === 'ok' && o.result ? o.result.artists.map((a) => ({ ...a, host: o.host })) : [])),
    tracks: outcomes.flatMap((o) => (o.status === 'ok' && o.result ? o.result.tracks : [])),
  };
}
