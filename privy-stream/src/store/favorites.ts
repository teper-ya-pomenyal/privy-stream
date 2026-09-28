import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from '../api';
import { IS_WEB } from '../platform/mode';
import { jsonFileStorage } from '../platform/nodesStorage';

/**
 * Избранное — локальная фонотека слушателя. Под капотом — просто JSON:
 * упорядоченный список UUID треков + снимки треков для отображения
 * (API v1 не умеет отдавать трек по одному id, поэтому имя/артист/время
 * кэшируются рядом; каноничен всё равно список UUID).
 * Десктоп: favorites.json в app data. Веб: функция отключена («скоро»).
 */
interface FavoritesState {
  /** Каноничный список: UUID треков в порядке добавления. */
  ids: string[];
  /** Снимки треков по UUID — только чтобы показать название, артиста, время. */
  tracks: Record<string, Track>;
  /** Добавить трек или убрать, если он уже в избранном. */
  toggle: (track: Track) => void;
  remove: (id: string) => void;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set) => ({
      ids: [],
      tracks: {},
      toggle: (track) =>
        set((s) => {
          if (s.ids.includes(track.id)) {
            const { [track.id]: _, ...tracks } = s.tracks;
            return { ids: s.ids.filter((id) => id !== track.id), tracks };
          }
          return { ids: [...s.ids, track.id], tracks: { ...s.tracks, [track.id]: track } };
        }),
      remove: (id) =>
        set((s) => {
          const { [id]: _, ...tracks } = s.tracks;
          return { ids: s.ids.filter((x) => x !== id), tracks };
        }),
    }),
    { name: 'privy.favorites', storage: jsonFileStorage<FavoritesState>('favorites.json') },
  ),
);

/** Управление сердечком для списков треков. soon — веб: функция ещё не работает. */
export interface FavControl {
  isFav: (t: Track) => boolean;
  toggle: (t: Track) => void;
  soon?: boolean;
}

export function useFavControl(): FavControl {
  const ids = useFavorites((s) => s.ids);
  const toggle = useFavorites((s) => s.toggle);
  if (IS_WEB) return soonFavControl;
  return { isFav: (t) => ids.includes(t.id), toggle };
}

const soonFavControl: FavControl = { isFav: () => false, toggle: () => {}, soon: true };

/** Гидратация из файла асинхронная — экраны ждут её, чтобы не мигать пустотой. */
export function useFavoritesHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useFavorites.persist.hasHydrated());
  useEffect(() => useFavorites.persist.onFinishHydration(() => setHydrated(true)), []);
  return hydrated;
}
