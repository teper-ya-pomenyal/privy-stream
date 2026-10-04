import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSearchParams } from 'react-router';
import { errorText, nodeApi, type NodeInfo } from '../api';
import { secrets } from '../platform/secrets';
import { nodesStorage } from '../platform/nodesStorage';
import { useSession } from './session';

/** host[:port], схема необязательна: без неё узел идёт по http (см. api/http.ts). */
const HOST_RE = /^(https?:\/\/)?[\w.-]+(:\d+)?$/;

/** Адрес без схемы и хвостовых косых — ключ сравнения: «http://x:8080» и «x:8080» один узел. */
const withoutScheme = (host: string) => host.replace(/^https?:\/\//, '').replace(/\/+$/, '');

/** id демо-узлов из макета, которые до v1 клали в список при первом запуске. */
const LEGACY_DEMO_IDS = new Set(['eu3', 'ru-ind', 'nl-vault', 'home']);

interface ServersState {
  nodes: NodeInfo[];
  activeId: string;
  /** id узла, к которому идёт подключение */
  connectingId: string | null;
  adding: boolean;
  /** идёт перепроверка активного узла («Проверить снова» на экране входа) */
  checking: boolean;
  error: string;
  /**
   * Выбор узла на экране входа — без handshake.
   * keepError: не трогать store.error (ни записывать, ни сбрасывать) —
   * форма добавления уже показала причину, generic-ошибкой затирать её нельзя.
   */
  pick: (id: string, opts?: { keepError?: boolean }) => void;
  /** Handshake с узлом; true — узел стал активным. */
  connect: (id: string) => Promise<boolean>;
  /** Пробить узел и добавить в список. online: false — адрес сохранён, но узел не ответил. */
  add: (host: string) => Promise<{ id: string; online: boolean } | null>;
  /** Удалить узел из списка: вместе с сессией и токенами, которые жили на нём. */
  remove: (id: string) => Promise<void>;
  clearError: () => void;
  /** Веб-версия: единственный узел из config.json, сменить его нельзя. */
  initWeb: (node: { url: string; name: string }) => void;
  /** При запуске: тихо обновить статус и пинг активного узла, без ошибок в UI. */
  checkActive: () => Promise<void>;
}

type Persisted = Pick<ServersState, 'nodes' | 'activeId'>;

export const useServers = create<ServersState>()(
  persist(
    (set, get) => ({
      // Клиент стартует «пустым»: узлы пользователь добавляет сам.
      nodes: [],
      activeId: '',
      connectingId: null,
      adding: false,
      checking: false,
      error: '',

      pick(id, opts) {
        const node = get().nodes.find((n) => n.id === id);
        if (!node) return;
        // Форма добавления уже показала причину (offline-ветка add()) —
        // не затирать её generic-ошибкой «503 · host не отвечает» и не сбрасывать.
        if (opts?.keepError) return set({ activeId: id });
        set({ activeId: id, error: node.status === 'online' ? '' : `503 · ${node.host} не отвечает` });
      },

      async connect(id) {
        const { nodes, activeId, connectingId } = get();
        const node = nodes.find((n) => n.id === id);
        if (!node || connectingId) return false;
        // Уже активный и отвечающий узел не переподключаем. Офлайн-текущий —
        // исключение: без повтора его строка на экране узлов остаётся без действия.
        if (id === activeId && node.status === 'online') return false;
        // Для недоступного узла это «ПОВТОР»: handshake заново.
        set({ connectingId: id, error: '' });
        try {
          const { descriptor, ping } = await nodeApi.probe(node.host);
          set((s) => ({
            connectingId: null,
            activeId: id,
            nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...descriptor, ping, status: 'online' } : n)),
          }));
          return true;
        } catch (e) {
          // Активный узел остаётся прежним.
          set((s) => ({
            connectingId: null,
            error: errorText(e),
            nodes: s.nodes.map((n) => (n.id === id ? { ...n, status: 'offline', ping: null } : n)),
          }));
          return false;
        }
      },

      async add(raw) {
        const addr = raw.trim().replace(/\/+$/, '');
        if (!HOST_RE.test(addr)) {
          set({ error: '400 · адрес вида host:port, например 10.0.0.5:8080 или https://node.example' });
          return null;
        }
        if (get().nodes.some((n) => withoutScheme(n.host) === withoutScheme(addr))) {
          set({ error: 'узел уже в списке' });
          return null;
        }
        set({ adding: true, error: '' });
        const base = { id: `u${Date.now()}`, host: addr };
        // Без схемы узел идёт по http; если там оказался только TLS — сохраняем
        // адрес с явной https-схемой: молчаливо уводить узел в https нельзя,
        // из-за этого активный узел вечно оставался offline.
        try {
          const { descriptor, ping } = await nodeApi.probe(addr);
          const node: NodeInfo = { ...base, ...descriptor, ping, status: 'online' };
          set((s) => ({ nodes: [...s.nodes, node], adding: false }));
          return { id: base.id, online: true };
        } catch (e) {
          if (!/^https?:\/\//.test(addr)) {
            try {
              const httpsHost = `https://${addr}`;
              const { descriptor, ping } = await nodeApi.probe(httpsHost);
              const node: NodeInfo = { ...base, host: httpsHost, ...descriptor, ping, status: 'online' };
              set((s) => ({ nodes: [...s.nodes, node], adding: false }));
              return { id: base.id, online: true };
            } catch {
              // Не ответил ни http, ни https — сохраняем адрес как ввели, причина ниже.
            }
          }
          // Узел всё равно добавляем — он может подняться позже.
          const node: NodeInfo = {
            ...base,
            name: addr.replace(/^https?:\/\//, '').split(':')[0],
            owner: 'добавлен тобой',
            access: 'неизвестно',
            note: 'узел добавлен вручную, метаданные ещё не получены',
            ping: null,
            status: 'offline',
          };
          // Причина — плюс пометка «сохранён», чтобы экран добавления отличил её от ошибки ввода.
          set((s) => ({
            nodes: [...s.nodes, node],
            adding: false,
            error: `${errorText(e)} · адрес сохранён — узел не отвечает`,
          }));
          return { id: base.id, online: false };
        }
      },

      async remove(id) {
        const node = get().nodes.find((n) => n.id === id);
        if (!node) return;
        // Узел текущей сессии: сперва корректный выход — logout на узле и стирание
        // токенов. Токены остальных узлов тоже не храним: ключ от удалённого замка выбрасывается.
        if (useSession.getState().host === node.host) await useSession.getState().signOut();
        await secrets.remove(node.host).catch(() => {});
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== id),
          // Активный узел не автоподменяем другим — выбор за пользователем (экран входа).
          activeId: s.activeId === id ? '' : s.activeId,
          connectingId: s.connectingId === id ? null : s.connectingId,
          error: '',
        }));
      },

      clearError: () => set({ error: '' }),

      initWeb({ url, name }) {
        const node: NodeInfo = { id: 'web', name, host: url, owner: '', access: '', note: '', ping: null, status: 'online' };
        set({ nodes: [node], activeId: node.id });
      },

      async checkActive() {
        const { nodes, activeId, checking } = get();
        const node = nodes.find((n) => n.id === activeId);
        if (!node || checking) return;
        const update = (patch: Partial<NodeInfo>) =>
          set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, ...patch } : n)) }));
        set({ checking: true });
        try {
          const { ping } = await nodeApi.probe(node.host);
          update({ ping, status: 'online' });
          set({ checking: false, error: '' });
        } catch (e) {
          update({ ping: null, status: 'offline' });
          // Молчаливый провал выглядел как сломанная кнопка — показываем причину.
          set({ checking: false, error: `${errorText(e)} · проверь порт и схему адреса узла` });
        }
      },
    }),
    {
      name: 'privy.servers',
      storage: nodesStorage<Persisted>(),
      version: 1,
      partialize: (s) => ({ nodes: s.nodes, activeId: s.activeId }),
      migrate: (persisted, version) => {
        const state = persisted as Persisted;
        if (version < 1) {
          // v0 → v1: убрать демо-узлы, оставить добавленные пользователем.
          const nodes = state.nodes.filter((n) => !LEGACY_DEMO_IDS.has(n.id));
          const activeId = nodes.some((n) => n.id === state.activeId) ? state.activeId : (nodes[0]?.id ?? '');
          return { nodes, activeId };
        }
        return state;
      },
    },
  ),
);

/** Список узлов загружен из хранилища (в приложении — асинхронно, из файла). */
export function whenServersHydrated(): Promise<void> {
  if (useServers.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useServers.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

/** Активный узел; undefined — список узлов пуст (первый запуск). */
export const useActiveNodeOrNull = () =>
  useServers((s): NodeInfo | undefined => s.nodes.find((n) => n.id === s.activeId) ?? s.nodes[0]);

/** Для экранов внутри приложения: туда не попасть без выбранного узла (см. App). */
export const useActiveNode = () => useActiveNodeOrNull()!;

/**
 * Узел, на котором открывать релиз/артиста: ссылки каталога ведут с ?host= узла,
 * где нашлась сущность. Совпадение с узлом списка (схема не учитывается) — его
 * канонический node.host; параметра нет или узел неизвестен — активный.
 */
export function useNodeHost(): string {
  const [params] = useSearchParams();
  const raw = params.get('host');
  const active = useActiveNode();
  const nodes = useServers((s) => s.nodes);
  if (!raw) return active.host;
  return nodes.find((n) => withoutScheme(n.host) === withoutScheme(raw))?.host ?? active.host;
}

export const useOnlineCount = () => useServers((s) => s.nodes.filter((n) => n.status === 'online').length);
