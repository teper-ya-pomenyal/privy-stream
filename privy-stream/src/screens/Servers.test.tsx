import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { probe: vi.fn() },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  // session.ts вызывает её на верхнем уровне — мок должен отдавать экспорт.
  setAuthExpiredHandler: vi.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { nodeApi } from '../api';
import { useServers } from '../store/servers';
import { Servers } from './Servers';

const node = (id: string, host: string, status: 'online' | 'offline') => ({
  id, name: `node-${id}`, host, owner: '', access: '', note: '',
  ping: status === 'online' ? 15 : null, status,
});

beforeEach(() => {
  vi.mocked(nodeApi.probe).mockReset();
  useServers.setState({ nodes: [], activeId: '', connectingId: null, adding: false, error: '' });
});

const renderScreen = () => render(<MemoryRouter><Servers /></MemoryRouter>);

it('renders the active node as a status, not a button', () => {
  useServers.setState({ nodes: [node('n1', '10.0.0.1:1', 'offline'), node('n2', '10.0.0.2:2', 'online')], activeId: 'n1' });
  renderScreen();
  expect(screen.queryByRole('button', { name: 'Текущий' })).toBeNull();
  expect(screen.getByText('Текущий')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Подключиться' })).toBeInTheDocument();
});

it('clicking the row body does not trigger a connection', () => {
  useServers.setState({ nodes: [node('n2', '10.0.0.2:2', 'online')], activeId: '' });
  renderScreen();
  fireEvent.click(screen.getByText('node-n2'));
  expect(nodeApi.probe).not.toHaveBeenCalled();
});

it('connects only through the explicit button', async () => {
  useServers.setState({ nodes: [node('n2', '10.0.0.2:2', 'online')], activeId: '' });
  vi.mocked(nodeApi.probe).mockRejectedValue(new Error('503 · нет ответа'));
  renderScreen();
  fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }));
  await vi.waitFor(() => expect(nodeApi.probe).toHaveBeenCalledTimes(1));
});

it('offers retry for the current node when it is offline', async () => {
  useServers.setState({ nodes: [node('n1', '10.0.0.1:1', 'offline')], activeId: 'n1' });
  vi.mocked(nodeApi.probe).mockRejectedValue(new Error('503 · нет ответа'));
  renderScreen();
  expect(screen.getByText('Текущий')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await vi.waitFor(() => expect(nodeApi.probe).toHaveBeenCalledTimes(1));
});

it('labels the online count as a share of added nodes', () => {
  useServers.setState({ nodes: [node('n2', '10.0.0.2:2', 'online')], activeId: 'n2' });
  renderScreen();
  expect(screen.getByText(/Доступны из добавленных узлов: 1 из 1/)).toBeInTheDocument();
});

it('removes a node only after an explicit confirmation', async () => {
  useServers.setState({ nodes: [node('n1', '10.0.0.1:1', 'offline'), node('n2', '10.0.0.2:2', 'online')], activeId: '' });
  renderScreen();
  fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]);
  // Подтверждение не дано — список не тронут.
  expect(useServers.getState().nodes).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Точно?' }));
  await vi.waitFor(() => expect(useServers.getState().nodes.map((n) => n.id)).toEqual(['n2']));
});
