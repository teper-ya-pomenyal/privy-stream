import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useMobile } from '../lib/useMobile';
import { IS_WEB } from '../platform/mode';
import { useFavorites } from '../store/favorites';
import { useActiveNode } from '../store/servers';
import { usePlayer } from '../store/player';
import { useSession } from '../store/session';
import { CatalogIcon, cx, GearIcon, hostLabel, LibraryIcon, Logo, NodesIcon, StatusDot } from '../ui';
import { AudioEngine } from './AudioEngine';
import { FullPlayer } from './FullPlayer';
import { startListenReporter } from './listenReporter';
import { MiniPlayer, PlayerBar } from './PlayerBar';
import s from './layout.module.css';

export function AppShell() {
  const favIds = useFavorites((f) => f.ids);
  const favSnapshots = useFavorites((f) => f.tracks);
  const queueEmpty = usePlayer((p) => p.queue.length === 0);
  const setQueue = usePlayer((p) => p.setQueue);
  const fullscreen = usePlayer((p) => p.fullscreen);
  const mobile = useMobile();

  useEffect(() => startListenReporter(), []);

  // Первый запуск приложения: очередь — фонотека (в вебе её нет).
  useEffect(() => {
    if (!IS_WEB && queueEmpty && favIds.length) {
      setQueue(favIds.map((id) => favSnapshots[id]).filter((t) => t != null));
    }
  }, [queueEmpty, favIds, favSnapshots, setQueue]);

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
  const signOut = useSession((x) => x.signOut);
  const closeFull = usePlayer((p) => p.setFullscreen);
  const offline = node.status !== 'online';

  return (
    <header className={s.header}>
      <Link to="/catalog" className={s.home} aria-label="На главную">
        <Logo small />
      </Link>
      <div className={s.headerRight}>
        <button
          type="button"
          className={cx(s.nodeChip, IS_WEB && s.nodeChipStatic)}
          onClick={IS_WEB ? undefined : () => navigate('/servers')}
          title={IS_WEB ? undefined : 'Сменить узел'}
        >
          <span className={s.nodeChipStatus}>
            <StatusDot size={7} color={offline ? 'var(--warn)' : 'var(--ok)'} blink={offline ? undefined : '2.2s'} />
            <span className={s.nodeChipLabel}>Текущий узел</span>
          </span>
          <span className={s.nodeChipHost}>
            <span className={cx(s.nodeChipName, 'ellipsis')}>{hostLabel(node.host)}</span>
            {offline || node.ping == null ? (
              <span className={s.nodeChipPing}>—</span>
            ) : (
              <span className={s.nodeChipPing}>{node.ping} ms</span>
            )}
            {!IS_WEB && <Chevron />}
          </span>
        </button>
        <button
          type="button"
          className={s.signOut}
          onClick={() => {
            closeFull(false);
            void signOut();
          }}
        >
          Выйти
        </button>
      </div>
    </header>
  );
}

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const NAV_ICONS = {
  catalog: CatalogIcon,
  nodes: NodesIcon,
  library: LibraryIcon,
  settings: GearIcon,
} as const;

function NavItem({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: keyof typeof NAV_ICONS;
  active?: boolean;
}) {
  const Ico = NAV_ICONS[icon];
  return (
    <NavLink to={to} className={({ isActive }) => cx(s.navItem, (isActive || active) && s.active)}>
      <span className={s.navIco}>
        <Ico size={19} />
      </span>
      <span className={s.navLabel}>{label}</span>
    </NavLink>
  );
}

function Sidebar() {
  const { pathname } = useLocation();
  const inCatalog = /^\/(catalog|album|artist)/.test(pathname);

  return (
    <aside className={s.sidebar}>
      <nav className={s.nav}>
        <NavItem to="/catalog" label="Каталог" icon="catalog" active={inCatalog} />
        {!IS_WEB && <NavItem to="/servers" label="Узлы" icon="nodes" />}
        {!IS_WEB && <NavItem to="/library" label="Фонотека" icon="library" />}
      </nav>
      <nav className={s.nav}>
        <NavItem to="/settings" label="Настройки" icon="settings" />
      </nav>
    </aside>
  );
}

/** Мобильная навигация вместо сайдбара — таб-бар. */
function TabBar() {
  const { pathname } = useLocation();
  const inCatalog = /^\/(catalog|album|artist)/.test(pathname);

  const tabs = [
    { to: '/catalog', label: 'Каталог', icon: 'catalog' as const, active: inCatalog },
    { to: '/servers', label: 'Узлы', icon: 'nodes' as const, app: true },
    { to: '/library', label: 'Фонотека', icon: 'library' as const, app: true },
    { to: '/settings', label: 'Настройки', icon: 'settings' as const },
  ].filter((it) => !(IS_WEB && it.app));

  return (
    <nav className={s.tabBar}>
      {tabs.map((it) => {
        const Ico = NAV_ICONS[it.icon];
        return (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => cx(s.tabItem, (isActive || it.active) && s.tabActive)}>
            <span className={s.tabIco}>
              <Ico size={21} />
            </span>
            {it.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
