import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from '../api';

/** Режим повтора: выключен / вся очередь по кругу / текущий трек. */
export type RepeatMode = 'off' | 'all' | 'one';

/** Случайная перестановка 0..len-1 (Фишер—Йетс) — порядок перемешанной очереди. */
const shuffled = (len: number) => {
  const order = [...Array(len).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

/** Шаг по перемешанному порядку: позиция текущего трека в перестановке ± 1 по кругу. */
const orderStep = (order: number[], index: number, step: 1 | -1) => {
  const pos = order.indexOf(index);
  return order[(pos + step + order.length) % order.length];
};

interface PlayerState {
  queue: Track[];
  index: number;
  playing: boolean;
  /** Позиция в текущем треке, сек. */
  position: number;
  /** Растёт при каждом seek — AudioEngine по нему переставляет <audio>. */
  seekNonce: number;
  /** Растёт при каждом новом проигрывании (play/next/prev), в том числе того же трека. */
  playId: number;
  fullscreen: boolean;
  /** Длительность из метаданных файла; 0 — не известна, берётся из трека. */
  mediaDuration: number;
  /** Трек скачивается с узла */
  loading: boolean;
  /** Ошибка стрима в формате «код · сообщение» */
  error: string;
  /** Положение регулятора громкости 0–1; громкость <audio> — его квадрат (см. AudioEngine). */
  volume: number;
  muted: boolean;
  /** Режим повтора: off — доиграл и стоп, all — очередь по кругу, one — трек заново. */
  repeat: RepeatMode;
  /** Перемешивание: «дальше» и конец трека идут по случайной перестановке очереди. */
  shuffle: boolean;
  /** Перестановка индексов очереди; null — перемешивание выключено. */
  shuffleOrder: number[] | null;

  setQueue: (queue: Track[]) => void;
  /** Начать трек; если передан список — он становится очередью. */
  play: (track: Track, list?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  /** Трек кончился сам (не клик по «дальше») — развилка по режиму повтора. */
  trackEnded: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  seek: (fraction: number) => void;
  tick: (position: number) => void;
  setMedia: (patch: Partial<Pick<PlayerState, 'mediaDuration' | 'loading' | 'error' | 'playing'>>) => void;
  setFullscreen: (open: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: 0,
      playing: false,
      position: 0,
      seekNonce: 0,
      playId: 0,
      fullscreen: false,
      mediaDuration: 0,
      loading: false,
      error: '',
      volume: 1,
      muted: false,
      repeat: 'off',
      shuffle: false,
      shuffleOrder: null,

      setQueue: (queue) =>
        set((s) => ({ queue, index: 0, position: 0, shuffleOrder: s.shuffle ? shuffled(queue.length) : null })),

      play(track, list) {
        const queue = list ?? get().queue;
        let index = queue.findIndex((t) => t.id === track.id);
        const nextQueue = index === -1 ? [...queue, track] : queue;
        if (index === -1) index = nextQueue.length - 1;
        set((s) => ({
          queue: nextQueue,
          index,
          position: 0,
          playing: true,
          seekNonce: s.seekNonce + 1,
          playId: s.playId + 1,
          // Порядок перемешивания жив, пока совпадает длиной с очередью;
          // новая или подросшая очередь — новая перестановка.
          shuffleOrder: s.shuffle
            ? s.shuffleOrder?.length === nextQueue.length
              ? s.shuffleOrder
              : shuffled(nextQueue.length)
            : null,
        }));
      },

      toggle: () => set((s) => ({ playing: s.queue.length > 0 && !s.playing })),

      next: () =>
        set((s) => ({
          index: s.queue.length
            ? s.shuffle && s.shuffleOrder && s.queue.length > 1
              ? orderStep(s.shuffleOrder, s.index, 1)
              : (s.index + 1) % s.queue.length
            : 0,
          position: 0,
          playing: s.queue.length > 0,
          seekNonce: s.seekNonce + 1,
          playId: s.playId + 1,
        })),

      prev: () =>
        set((s) => ({
          index: s.queue.length
            ? s.shuffle && s.shuffleOrder && s.queue.length > 1
              ? orderStep(s.shuffleOrder, s.index, -1)
              : (s.index - 1 + s.queue.length) % s.queue.length
            : 0,
          position: 0,
          playing: s.queue.length > 0,
          seekNonce: s.seekNonce + 1,
          playId: s.playId + 1,
        })),

      /** Окончание трека само по себе (не клик по «дальше»): повтор трека — заново,
          повтор очереди — по кругу, без повтора — стоп на последнем треке
          (при перемешивании «последний» — последний в случайном порядке).
          Ручные «дальше» и «назад» крутятся по кругу при любом режиме. */
      trackEnded: () => {
        const s = get();
        if (!s.queue.length) return;
        if (s.repeat === 'one') {
          // Новый playId: рестарт считается новым проигрыванием (см. listenReporter).
          set((st) => ({ position: 0, playing: true, seekNonce: st.seekNonce + 1, playId: st.playId + 1 }));
          return;
        }
        const atEnd =
          s.shuffle && s.shuffleOrder && s.queue.length > 1
            ? s.shuffleOrder.indexOf(s.index) === s.queue.length - 1
            : s.index === s.queue.length - 1;
        if (s.repeat === 'off' && atEnd) {
          set({ position: 0, playing: false });
          return;
        }
        get().next();
      },

      // Цикл: выключен → вся очередь → текущий трек → выключен.
      cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),

      // Включение строит новую случайную перестановку очереди, выключение возвращает порядок списка.
      toggleShuffle: () =>
        set((s) => (s.shuffle ? { shuffle: false, shuffleOrder: null } : { shuffle: true, shuffleOrder: shuffled(s.queue.length) })),

      seek(fraction) {
        const track = get().queue[get().index];
        if (!track) return;
        const f = Math.max(0, Math.min(1, fraction));
        set((s) => ({ position: f * (s.mediaDuration || track.durationSec), seekNonce: s.seekNonce + 1 }));
      },

      tick: (position) => set({ position }),

      setMedia: (patch) => set(patch),

      setFullscreen: (fullscreen) => set({ fullscreen }),

      // Движение регулятора снимает «без звука», как в системных плеерах.
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), muted: false }),

      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: 'privy.player',
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        position: s.position,
        volume: s.volume,
        muted: s.muted,
        repeat: s.repeat,
        shuffle: s.shuffle,
        shuffleOrder: s.shuffleOrder,
      }),
    },
  ),
);

export const useCurrentTrack = () => usePlayer((s) => s.queue[s.index] as Track | undefined);

/** Длительность текущего трека: из файла, если узел не прислал duration_ms. */
export const useDuration = () => usePlayer((s) => s.mediaDuration || s.queue[s.index]?.durationSec || 0);
