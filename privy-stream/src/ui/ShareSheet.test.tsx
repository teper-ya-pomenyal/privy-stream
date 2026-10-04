import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  nodeApi: { coverUrl: vi.fn(async () => null) },
  errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  setAuthExpiredHandler: vi.fn(),
}));

const mobileState = vi.hoisted(() => ({ value: false }));
vi.mock('../lib/useMobile', () => ({ useMobile: () => mobileState.value, MOBILE_QUERY: '(max-width: 720px)' }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ArtistRef, Release, Track } from '../api/types';
import type { ShareTarget } from '../lib/share';
import { useShareSheet } from '../store/shareSheet';
import { useServers } from '../store/servers';
import { ShareSheet } from './ShareSheet';

const track: Track = { id: 't1', title: 'Song', artistId: 'ar1', artist: 'Artist', releaseId: 'rel1', release: 'Album', durationSec: 60 };
const release: Release = { id: 'rel1', title: 'Album', artistId: 'ar1', artist: 'Artist', flagged: false, code: 'PS-1' };
const artist: ArtistRef = { id: 'ar1', name: 'Artist' };

useServers.setState({
  nodes: [{ id: 'n1', name: 'node-1', host: '10.0.0.1:1', owner: '', access: '', note: '', ping: 15, status: 'online' }],
  activeId: 'n1',
});

beforeEach(() => {
  useShareSheet.getState().close();
});

const renderSheet = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShareSheet />
    </QueryClientProvider>,
  );

const openSheet = (target: ShareTarget) =>
  act(() => {
    useShareSheet.getState().open(target);
  });

it('renders the release preview and the album link', () => {
  renderSheet();
  openSheet({ kind: 'release', release });
  expect(screen.getByRole('dialog', { name: 'Поделиться' })).toBeInTheDocument();
  expect(screen.getByText('Album')).toBeInTheDocument();
  // Подзаголовок: имя артиста из данных · тип сущности.
  expect(screen.getByText('Artist · Альбом')).toBeInTheDocument();
  const input = screen.getByRole('textbox') as HTMLInputElement;
  expect(input.value).toContain('#/album/rel1');
  expect(input.readOnly).toBe(true);
});

it('renders the artist type with an avatar and artist link', () => {
  renderSheet();
  openSheet({ kind: 'artist', artist });
  expect(screen.getByText('Artist')).toBeInTheDocument();
  expect(screen.getByText('Артист')).toBeInTheDocument();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('#/artist/ar1');
});

it('renders a track link pointing to the album with ?t=', () => {
  renderSheet();
  openSheet({ kind: 'track', track });
  expect(screen.getByText('Artist · Трек')).toBeInTheDocument();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('#/album/rel1?t=t1');
});

it('copies the link and flashes «Скопировано»', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  renderSheet();
  openSheet({ kind: 'release', release });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Копировать' }));
  });
  expect(writeText).toHaveBeenCalledWith('http://localhost:3000/#/album/rel1');
  expect(screen.getByRole('button', { name: 'Скопировано' })).toBeInTheDocument();
});

it('copies via clipboard without waiting for the system share sheet', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  // На мобильном Chrome navigator.share есть: «Копировать» не должен звать его
  // (в headless системный шер не резолвится — флеш «Скопировано» не наступит).
  Object.defineProperty(navigator, 'share', { value: () => new Promise(() => {}), configurable: true });
  renderSheet();
  openSheet({ kind: 'release', release });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Копировать' }));
  });
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Скопировано' })).toBeInTheDocument();
  // @ts-expect-error тестовая зачистка
  delete navigator.share;
});

it('builds messenger links with url and text', () => {
  renderSheet();
  openSheet({ kind: 'release', release });
  const tg = screen.getByRole('link', { name: /Telegram/ }) as HTMLAnchorElement;
  expect(tg.href).toContain('https://t.me/share/url');
  expect(tg.href).toContain(encodeURIComponent('http://localhost:3000/#/album/rel1'));
  expect(tg.target).toBe('_blank');
  expect(tg.rel).toContain('noopener');
  // В Telegram ссылка идёт отдельным параметром — текст без «Узел/Каталог».
  expect(tg.href).not.toContain(encodeURIComponent('Узел:'));
  const wa = screen.getByRole('link', { name: /WhatsApp/ }) as HTMLAnchorElement;
  expect(wa.href).toContain('https://wa.me/?text=');
  expect(wa.href).toContain(encodeURIComponent('«Album» — Artist · Privy Stream'));
});

it('hides Viber and SMS on desktop, shows them on mobile', () => {
  const first = renderSheet();
  openSheet({ kind: 'release', release });
  expect(screen.queryByRole('button', { name: /Viber/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /SMS/ })).toBeNull();
  first.unmount();
  mobileState.value = true;
  renderSheet();
  openSheet({ kind: 'release', release });
  expect(screen.getByRole('button', { name: /Viber/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /SMS/ })).toBeInTheDocument();
  mobileState.value = false;
});

it('shows «Ещё…» only when navigator.share exists', () => {
  const first = renderSheet();
  openSheet({ kind: 'release', release });
  expect(screen.queryByRole('button', { name: /Ещё/ })).toBeNull();
  first.unmount();
  Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
  renderSheet();
  openSheet({ kind: 'release', release });
  expect(screen.getByRole('button', { name: /Ещё/ })).toBeInTheDocument();
  // @ts-expect-error тестовая зачистка
  delete navigator.share;
});

it('closes on backdrop click and on Escape', () => {
  renderSheet();
  openSheet({ kind: 'release', release });
  fireEvent.click(screen.getByRole('dialog', { name: 'Поделиться' }).parentElement!);
  expect(useShareSheet.getState().target).toBeNull();
  openSheet({ kind: 'release', release });
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useShareSheet.getState().target).toBeNull();
});

it('locks body scroll while open and releases it after close', () => {
  const { unmount } = renderSheet();
  openSheet({ kind: 'release', release });
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('');
});

it('focuses the copy button on open and returns focus to the trigger on close', () => {
  document.body.innerHTML = '<button id="trig">Триггер</button>';
  const trig = document.getElementById('trig')!;
  trig.focus();
  const { unmount } = renderSheet();
  openSheet({ kind: 'release', release });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Копировать' }));
  unmount();
  expect(document.activeElement).toBe(trig);
});
