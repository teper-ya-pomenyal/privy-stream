import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./multiSearch', () => ({ fanOutSearch: vi.fn() }));

import { fanOutSearch, type NodeSearchOutcome } from './multiSearch';
import { useMultiSearch } from './queries';

const fanOut = vi.mocked(fanOutSearch);

// Свежий клиент на тест: retry выключен, чтобы упавший запрос не ждал повторов.
const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

beforeEach(() => fanOut.mockReset());

it('исходы fanOutSearch попадают в data как есть', async () => {
  const outcomes: NodeSearchOutcome[] = [
    { host: 'h1', status: 'ok', result: { artists: [], tracks: [] } },
    { host: 'h2', status: 'no-session' },
  ];
  fanOut.mockResolvedValue(outcomes);

  const { result } = renderHook(() => useMultiSearch(['h1', 'h2'], 'abc'), { wrapper: createWrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(outcomes);
  expect(fanOut).toHaveBeenCalledWith([{ host: 'h1' }, { host: 'h2' }], 'abc');
});

it('пустой запрос — запрос выключен и не фетчится', () => {
  const { result } = renderHook(() => useMultiSearch(['h1'], ''), { wrapper: createWrapper() });

  expect(result.current.isEnabled).toBe(false);
  expect(result.current.fetchStatus).toBe('idle');
  expect(fanOut).not.toHaveBeenCalled();
});

it('пустой список узлов — запрос выключен', () => {
  const { result } = renderHook(() => useMultiSearch([], 'abc'), { wrapper: createWrapper() });

  expect(result.current.isEnabled).toBe(false);
  expect(result.current.fetchStatus).toBe('idle');
});
