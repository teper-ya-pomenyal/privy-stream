import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useBrowse, useLibrary } from '../api/queries';
import { useMobile } from '../lib/useMobile';
import { IS_WEB } from '../platform/mode';
import { useActiveNode, useOnlineCount, useServers } from '../store/servers';
import { usePlayer } from '../store/player';
import { useSession } from '../store/session';
import { Button, cx, hostLabel, Logo, StatusDot } from '../ui';
import { AudioEngine } from './AudioEngine';
import { FullPlayer } from './FullPlayer';
import { startListenReporter } from './listenReporter';
import { MiniPlayer, PlayerBar } from './PlayerBar';
import s from './layout.module.css';

export function AppShell() {
  const library = useLibrary();
  const queueEmpty = usePlayer((p) => p.queue.length === 0);
  const setQueue = usePlayer((p) => p.setQueue);
  const fullscreen = usePlayer((p) => p.fullscreen);
  const mobile = useMobile();

  useEffect(() => startListenReporter(), []);

  // Первый запуск приложения: очередь — локальная фонотека (в вебе её нет).
  useEffect(() => {
    if (!IS_WEB && queueEmpty && library.data?.length) setQueue(library.data);
  }, [queueEmpty, library.data, setQueue]);

  return (
    <div className={s.app}>
      <Header />
      <div className={s.body}>
        {!mobile && <Sidebar />}
        <main className={s.content}>
          <Outlet />
        </main>
      </div>
      {mobile ? (
        <div className={s.mobileFoot}>
          <MiniPlayer />
          <TabBar />
        </div>
      ) : (
        <PlayerBar />
      )}
      {fullscreen && <FullPlayer />}
      <AudioEngine />
    </div>
  );
}

function Header() {
  const node = useActiveNode();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signOut = useSession((x) => x.signOut);
  const closeFull = usePlayer((p) => p.setFullscreen);

  const [, screen, id] = pathname.split('/');
  const albumId = id ? decodeURIComponent(id) : '';
  // UUID из API сокращаем до первого блока, коды мок-релизов (AR-014) — как есть.
  const crumbs = `/${screen}${screen === 'album' && albumId ? ` / ${/^[0-9a-f-]{36}$/.test(albumId) ? albumId.slice(0, 8) : albumId}` : ''}`;
  const offline = node.status !== 'online';

  return (
    <header className={s.header}>
      <div className={s.headerLeft}>
        <Link to="/catalog" className={s.home} aria-label="На главную">
          <Logo small />
        </Link>
        <div className={s.crumbs}>{crumbs}</div>
        <button
          type="button"
          className={cx(s.nodeChip, IS_WEB && s.nodeChipStatic)}
          onClick={IS_WEB ? undefined : () => navigate('/servers')}
          title={IS_WEB ? undefined : 'Сменить узел'}
        >
          <StatusDot size={6} color={offline ? 'var(--warn)' : 'var(--accent)'} blink="1.8s" />
          <span className={cx(s.nodeChipHost, 'ellipsis')}>{hostLabel(node.host)}</span>
          <span className={s.nodeChipPing}>
            {offline || node.ping == null ? '—' : `${node.ping} ms`}
            {IS_WEB ? '' : ' ▾'}
          </span>
        </button>
      </div>
      <div className={s.headerRight}>
        <Button
          variant="quiet"
          size="xs"
          onClick={() => {
            closeFull(false);
            void signOut();
          }}
        >
          ВЫХОД
        </Button>
      </div>
    </header>
  );
}

function Sidebar() {
  const node = useActiveNode();
  const total = useServers((x) => x.nodes.length);
  const online = useOnlineCount();
  const browse = useBrowse(node.host);
  const library = useLibrary();
  const playing = usePlayer((p) => p.playing);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inCatalog = /^\/(catalog|album|artist)/.test(pathname);

  const items = [
    { to: '/servers', label: 'СЕРВЕРЫ', count: `${online}/${total}`, app: true },
    // Число релизов известно, только если узел отдаёт полку (в API v1 — только поиск).
    { to: '/catalog', label: 'КАТАЛОГ', count: browse.data ? String(browse.data.length) : '', active: inCatalog },
    { to: '/library', label: 'БИБЛИОТЕКА', count: library.data ? String(library.data.length) : '—', app: true },
    { to: '/settings', label: 'НАСТРОЙКИ', count: '' },
  ].filter((it) => !(IS_WEB && it.app));

  return (
    <aside className={s.sidebar}>
      <nav className={s.nav}>
        <div className={cx(s.navTitle, 't-section')}>НАВИГАЦИЯ</div>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => cx(s.navItem, (isActive || it.active) && s.active)}>
            <span className={s.navLabel}>{it.label}</span>
            <span className={s.navCount}>{it.count}</span>
          </NavLink>
        ))}
      </nav>
      <div className={s.sideFoot}>
        <div className={s.rule} />
        <div className={s.kvList}>
          <div className={s.kv}>
            <span>КАНАЛ</span>
            <span>FLAC 24/96</span>
          </div>
          <div className={s.kv}>
            <span>БУФЕР</span>
            <span>{playing ? '96%' : '100%'}</span>
          </div>
          <div className={s.kv}>
            <span>УЗЕЛ</span>
            <span className="ellipsis">{node.name}</span>
          </div>
        </div>
        {!IS_WEB && (
          <button type="button" className={s.switchNode} onClick={() => navigate('/servers')}>
            <StatusDot size={6} color="var(--accent)" blink="1.6s" />
            СМЕНИТЬ УЗЕЛ · {online} ОНЛАЙН
          </button>
        )}
      </div>
    </aside>
  );
}

/** Мобильная навигация вместо сайдбара — таб-бар из макета. */
function TabBar() {
  const { pathname } = useLocation();
  const inCatalog = /^\/(catalog|album|artist)/.test(pathname);

  const tabs = [
    { to: '/catalog', label: 'ПОЛКА', active: inCatalog },
    { to: '/servers', label: 'УЗЛЫ', app: true },
    { to: '/library', label: 'ФОНОТЕКА', app: true },
    { to: '/settings', label: 'Я' },
  ].filter((it) => !(IS_WEB && it.app));

  return (
    <nav className={s.tabBar}>
      {tabs.map((it) => (
        <NavLink key={it.to} to={it.to} className={({ isActive }) => cx(s.tabItem, (isActive || it.active) && s.tabActive)}>
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
