import { create } from 'zustand';
import type { ShareTarget } from '../lib/share';

/**
 * Состояние окна «Поделиться». Открывается из любой точки вызовом
 * useShareSheet.getState().open(...) — тот же паттерн, что у fullscreen плеера.
 * Триггер запоминается, чтобы после закрытия вернуть фокус на кнопку.
 */
interface ShareSheetState {
  target: ShareTarget | null;
  trigger: HTMLElement | null;
  open: (target: ShareTarget) => void;
  close: () => void;
}

export const useShareSheet = create<ShareSheetState>()((set) => ({
  target: null,
  trigger: null,
  open: (target) =>
    set({ target, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null }),
  close: () => set({ target: null }),
}));
