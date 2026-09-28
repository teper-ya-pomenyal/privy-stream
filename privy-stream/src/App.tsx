import { useEffect } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppShell } from './layout/AppShell';
import { Album } from './screens/Album';
import { Artist } from './screens/Artist';
import { Auth } from './screens/Auth';
import { Catalog } from './screens/Catalog';
import { Library } from './screens/Library';
import { Servers } from './screens/Servers';
import { Settings } from './screens/Settings';
import { IS_WEB, isTauri } from './platform/mode';
import { useActiveNodeOrNull, useServers } from './store/servers';
import { useSession } from './store/session';
import { useSettings } from './store/settings';

// Hash-роутер: в Tauri страница грузится из бандла, серверных маршрутов нет.
const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/catalog" replace /> },
      // Веб-версия — сайт одного узла: без смены узлов и без локальной библиотеки.
      { path: 'servers', element: IS_WEB ? <Navigate to="/catalog" replace /> : <Servers /> },
      { path: 'catalog', element: <Catalog /> },
      { path: 'album/:id', element: <Album /> },
      { path: 'artist/:id', element: <Artist /> },
      { path: 'library', element: IS_WEB ? <Navigate to="/catalog" replace /> : <Library /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/catalog" replace /> },
    ],
  },
]);

export function App() {
  const dense = useSettings((s) => s.dense);
  const theme = useSettings((s) => s.theme);
  const node = useActiveNodeOrNull();
  const { host, restoring, restore } = useSession();

  useEffect(() => {
    document.documentElement.dataset.density = dense ? 'dense' : 'airy';
  }, [dense]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Каркас окна под тему: без этого при старте тёмной темы виден светлый фон.
    if (isTauri()) {
      getCurrentWindow()
        .setBackgroundColor(theme === 'dark' ? '#111313' : '#f2efe8')
        .catch(() => {});
    }
  }, [theme]);

  useEffect(() => {
    void restore(node?.host ?? null);
    void useServers.getState().checkActive();
    // Только при запуске: смена узла внутри сессии не разлогинивает.
  }, []);

  if (restoring) return null;
  // Без узла приложению не к чему подключаться — только экран входа с добавлением узла.
  if (!host || !node) return <Auth />;
  return <RouterProvider router={router} />;
}
