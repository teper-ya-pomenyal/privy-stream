import { useQuery } from '@tanstack/react-query';
import { browseApi, nodeApi } from './index';

// Ключи всегда начинаются с host, чтобы данные разных узлов не смешивались.
export const keys = {
  browse: (host: string) => ['node', host, 'browse'] as const,
  search: (host: string, query: string) => ['node', host, 'search', query] as const,
  release: (host: string, id: string) => ['node', host, 'release', id] as const,
  artist: (host: string, id: string) => ['node', host, 'artist', id] as const,
};

/** Полка узла; data === undefined и enabled === false, если узел её не отдаёт. */
export function useBrowse(host: string) {
  const browse = browseApi(host);
  const query = useQuery({
    queryKey: keys.browse(host),
    queryFn: () => browse!(host),
    enabled: !!browse,
  });
  return { ...query, supported: !!browse };
}

export const useSearch = (host: string, query: string) =>
  useQuery({
    queryKey: keys.search(host, query),
    queryFn: () => nodeApi.search(host, query),
    enabled: query.length > 0,
    placeholderData: (prev) => prev,
  });

export const useRelease = (host: string, id: string) =>
  useQuery({ queryKey: keys.release(host, id), queryFn: () => nodeApi.release(host, id) });

export const useArtist = (host: string, id: string) =>
  useQuery({ queryKey: keys.artist(host, id), queryFn: () => nodeApi.artist(host, id) });
