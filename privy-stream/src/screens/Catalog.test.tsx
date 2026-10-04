import { expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../api', () => ({
  browseApi: () => async () => [],
  nodeApi: {
    search: vi.fn(async () => ({ artists: [], tracks: [] })),
    // В мульти-тестах в выдаче есть релизы — ReleaseCard спрашивает обложку.
    coverUrl: vi.fn(async () => null),
  },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // Стор узлов тянет session.ts, а тот зовёт её на верхнем уровне.
  setAuthExpiredHandler: vi.fn(),
}));

// Витная среда — «веб» (isTauri() там false), а мультипоиск гейтится !IS_WEB.
// Подменяем только режим: isTauri внутри secrets берётся из @tauri-apps/api/core
// напрямую и остаётся прежним — токены по-прежнему читаются из localStorage.
vi.mock('../platform/mode', () => ({ CLIENT_MODE: 'app', IS_WEB: false, isTauri: () => false }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { nodeApi } from '../api';
import { NodeError, type NodeInfo, type Track } from '../api/types';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { useServers } from '../store/servers';
import { Catalog } from './Catalog';

const NODE_1: NodeInfo = { id: 'n1', name: 'node-1', host: '10.0.0.1:1', owner: '', access: '', note: '', ping: 15, status: 'online' };
const NODE_2: NodeInfo = { id: 'n2', name: 'node-2', host: '10.0.0.2:2', owner: '', access: '', note: '', ping: 25, status: 'online' };

// Как fromTrack в http.ts: найденный трек несёт host узла, на котором нашёлся.
const trackOn = (host: string, n: number): Track => ({
  id: `t${n}`,
  title: `Трек ${n}`,
  artistId: `a${n}`,
  artist: `Артист ${n}`,
  releaseId: `r${n}`,
  release: `Релиз ${n}`,
  durationSec: 100 + n,
  host,
});

// Экран открывается только с выбранным узлом (useActiveNode) — сеем узлы в стор,
// как это делают остальные тесты экранов (см. Servers.test.tsx).
const seedServers = (...nodes: NodeInfo[]) => useServers.setState({ nodes, activeId: nodes[0]?.id ?? '' });

// fanOutSearch перед запросом смотрит секреты узла: без токенов узел отвечает no-session.
const seedTokens = (...hosts: string[]) =>
  hosts.forEach((host) => localStorage.setItem(`privy.tokens:${host}`, JSON.stringify({ access: 'a', refresh: 'r' })));

beforeEach(() => {
  vi.mocked(nodeApi.search).mockReset();
  seedServers(NODE_1);
  useSettings.setState({ multiNodeSearch: false });
  useSession.setState({ host: NODE_1.host });
});

afterEach(() => {
  useSettings.setState({ multiNodeSearch: false });
  useSession.setState({ host: null });
});

const renderCatalog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Catalog />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const typeQuery = () => userEvent.type(screen.getByRole('textbox', { name: 'Поиск по узлу' }), 'весна');

it('shows shelf tabs only while searching', async () => {
  renderCatalog();
  expect(screen.queryByRole('button', { name: 'Артисты' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Треки' })).toBeNull();
  await typeQuery();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Артисты' })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Артисты' })).toBeNull());
});

it('переключатель скрыт при одном узле, виден при двух', async () => {
  renderCatalog();
  expect(screen.queryByRole('switch', { name: 'По всем моим узлам' })).toBeNull();
  seedServers(NODE_1, NODE_2);
  await waitFor(() => expect(screen.getByRole('switch', { name: 'По всем моим узлам' })).toBeInTheDocument());
});

it('мульти-поиск склеивает выдачу и вешает бейджи', async () => {
  seedServers(NODE_1, NODE_2);
  seedTokens(NODE_1.host, NODE_2.host);
  useSettings.setState({ multiNodeSearch: true });
  vi.mocked(nodeApi.search).mockImplementation(async (host) =>
    host === NODE_1.host
      ? { artists: [{ id: 'a1', name: 'Исполнитель 1' }], tracks: [trackOn(NODE_1.host, 1)] }
      : { artists: [{ id: 'a2', name: 'Исполнитель 2' }], tracks: [trackOn(NODE_2.host, 2)] },
  );
  renderCatalog();
  await typeQuery();
  expect(await screen.findByRole('heading', { name: 'Поиск по узлам' })).toBeInTheDocument();
  expect(await screen.findByText('Трек 1')).toBeInTheDocument();
  expect(screen.getByText('Трек 2')).toBeInTheDocument();
  // У каждой строки — бейдж её узла: имя узла, а не адрес (треки и артисты).
  expect(screen.getAllByText('node-1')).toHaveLength(2);
  expect(screen.getAllByText('node-2')).toHaveLength(2);
  // Бейдж в строке артиста называет именно его узел.
  expect(screen.getByText('Исполнитель 1').closest('button')).toHaveTextContent('node-1');
  expect(screen.getByText('Исполнитель 2').closest('button')).toHaveTextContent('node-2');
});

it('все узлы молчат → статусы, а не «ничего не найдено»', async () => {
  seedServers(NODE_1, NODE_2);
  seedTokens(NODE_1.host, NODE_2.host);
  useSettings.setState({ multiNodeSearch: true });
  vi.mocked(nodeApi.search).mockRejectedValue(new NodeError(503, 'узел не отвечает'));
  renderCatalog();
  await typeQuery();
  expect(await screen.findAllByText(/не отвечает/)).toHaveLength(2);
  expect(screen.queryByText('НИЧЕГО НЕ НАЙДЕНО')).toBeNull();
});

it('401 на чужом узле не разлогинивает', async () => {
  seedServers(NODE_1, NODE_2);
  seedTokens(NODE_1.host, NODE_2.host);
  useSettings.setState({ multiNodeSearch: true });
  useSession.setState({ host: NODE_1.host });
  vi.mocked(nodeApi.search).mockImplementation(async (host) =>
    host === NODE_2.host ? Promise.reject(new NodeError(401, 'сессия истекла')) : { artists: [], tracks: [trackOn(NODE_1.host, 1)] },
  );
  renderCatalog();
  await typeQuery();
  expect(await screen.findByText('Трек 1')).toBeInTheDocument();
  expect(screen.getByText(/нужен вход/)).toBeInTheDocument();
  // Чужой 401 не трогает сессию активного узла.
  expect(useSession.getState().host).toBe(NODE_1.host);
});
