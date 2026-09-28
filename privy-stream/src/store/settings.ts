import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface SettingsState {
  dense: boolean;
  theme: Theme;
  setDense: (dense: boolean) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      dense: false,
      theme: 'light',
      setDense: (dense) => set({ dense }),
      setTheme: (theme) => set({ theme }),
    }),
    // merge по умолчанию дополнит старые сохранённые настройки полем theme
    { name: 'privy.settings' },
  ),
);
