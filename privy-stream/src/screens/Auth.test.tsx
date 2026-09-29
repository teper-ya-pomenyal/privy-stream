import { beforeEach, expect, it, vi } from 'vitest';

// Форма добавления узла есть только в режиме приложения (Tauri).
// isTauri() в @tauri-apps/api 2.11 читает globalThis.isTauri — включаем
// режим приложения до загрузки модулей.
vi.hoisted(() => {
  (globalThis as { isTauri?: boolean }).isTauri = true;
});

vi.mock('../api', () => ({
  nodeApi: { probe: vi.fn() },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // session.ts вызывает её на верхнем уровне — мок должен отдавать экспорт.
  setAuthExpiredHandler: vi.fn(),
}));

// В режиме приложения стор узлов пишет в JSON-файл через Tauri IPC:
// в jsdom его нет, подменяем файловое хранилище пустым.
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => ({
    get: async () => undefined,
    set: async () => {},
    save: async () => {},
    delete: async () => {},
  })),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nodeApi } from '../api';
import { useServers } from '../store/servers';
import { Auth } from './Auth';

const node = (id: string, host: string, status: 'online' | 'offline') => ({
  id, name: '195.209.213.79', host, owner: '', access: '', note: '',
  ping: status === 'online' ? 15 : null, status,
});

beforeEach(() => {
  vi.mocked(nodeApi.probe).mockReset();
  useServers.setState({ nodes: [], activeId: '', connectingId: null, adding: false, error: '' });
});

it('distinguishes two nodes with the same name by showing the address in the chip', () => {
  useServers.setState({ nodes: [node('n1', '195.209.213.79:8443', 'offline'), node('n2', '195.209.213.79:9001', 'online')], activeId: 'n2' });
  render(<Auth />);
  expect(screen.getByRole('button', { name: /195\.209\.213\.79:8443/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /195\.209\.213\.79:9001/ })).toBeInTheDocument();
});

it('shows unavailability and a recheck action before the form is submitted', async () => {
  useServers.setState({ nodes: [node('n1', '195.209.213.79:8443', 'offline')], activeId: 'n1' });
  render(<Auth />);
  expect(screen.getByRole('button', { name: 'Узел не отвечает' })).toBeDisabled();
  expect(screen.getByText('узел не отвечает — вход сейчас невозможен')).toBeInTheDocument();
  vi.mocked(nodeApi.probe).mockResolvedValue({ descriptor: { name: 'x', owner: '', access: '', note: '' }, ping: 10 });
  fireEvent.click(screen.getByRole('button', { name: 'Проверить снова' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled());
});

it('keeps the address and offers a retry when the added node does not answer', async () => {
  vi.mocked(nodeApi.probe).mockRejectedValue(new Error('503 · таймаут'));
  render(<Auth />); // узлов нет — форма добавления открыта сразу
  const input = screen.getByPlaceholderText('10.0.0.5:8443');
  await userEvent.type(input, '10.0.0.5:8443');
  await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
  expect(input).toHaveValue('10.0.0.5:8443');
  expect(screen.getByText(/адрес сохранён/)).toBeInTheDocument();
  vi.mocked(nodeApi.probe).mockResolvedValue({ descriptor: { name: 'n', owner: '', access: '', note: '' }, ping: 9 });
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument());
  expect(useServers.getState().nodes[0]).toMatchObject({ status: 'online' });
});

it('labels the registration submit in plain language', async () => {
  render(<Auth />);
  await userEvent.click(screen.getByRole('tab', { name: 'Регистрация' }));
  expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
});
