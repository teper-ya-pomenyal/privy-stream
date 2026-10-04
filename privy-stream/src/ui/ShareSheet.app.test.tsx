import { expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { coverUrl: vi.fn(async () => null) },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  setAuthExpiredHandler: vi.fn(),
}));

// App-режим фиксируется на весь файл: mode-мок вычисляется один раз.
vi.mock('../platform/mode', () => ({ CLIENT_MODE: 'app', IS_WEB: false, isTauri: () => true }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Release } from '../api/types';
import { useShareSheet } from '../store/shareSheet';
import { useServers } from '../store/servers';
import { ShareSheet } from './ShareSheet';

const release: Release = { id: 'rel1', title: 'Album', artistId: 'ar1', artist: 'Artist', flagged: false, code: 'PS-1' };

useServers.setState({
  nodes: [{ id: 'n1', name: 'node-1', host: '10.0.0.1:1', owner: '', access: '', note: '', ping: 15, status: 'online' }],
  activeId: 'n1',
});

const renderSheet = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShareSheet />
    </QueryClientProvider>,
  );

it('in app mode offers the description copy instead of a link and messengers', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  renderSheet();
  act(() => {
    useShareSheet.getState().open({ kind: 'release', release });
  });
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('link', { name: /Telegram/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Скопировать описание' })).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать описание' }));
  });
  const text = writeText.mock.calls[0][0] as string;
  expect(text).toContain('«Album» — Artist · Privy Stream');
  expect(text).toContain('Узел: 10.0.0.1:1');
  expect(text).toContain('Каталог: PS-1');
});
