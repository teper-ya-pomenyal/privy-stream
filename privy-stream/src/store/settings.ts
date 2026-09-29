import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { flushSync } from 'react-dom';

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
      theme: 'dark',
      setDense: (dense) => set({ dense }),
      setTheme: (theme) => {
        // Плавная смена: View Transitions делает кросс-фейд всей страницы
        // (Chromium 111+, WebKit 18+); без API или при reduced-motion — мгновенно.
        const start = (document as Document & {
          startViewTransition?: (update: () => void) => unknown;
        }).startViewTransition;
        if (!start || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          set({ theme });
          return;
        }
        start.call(document, () => {
          // flushSync: перерисовка (обложки и т.п.) попадает в «новый» снимок,
          // а не дёргается после кросс-фейда.
          flushSync(() => set({ theme }));
          // Атрибут выставляем здесь же: снимок снимается, когда колбэк вернулся,
          // а useEffect из App может сработать позже.
          document.documentElement.dataset.theme = theme;
        });
      },
    }),
    // merge по умолчанию дополнит старые сохранённые настройки полем theme
    { name: 'privy.settings' },
  ),
);
