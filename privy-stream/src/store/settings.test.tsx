import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { App } from '../App';
import { useServers } from './servers';
import { useSession } from './session';
import { useSettings } from './settings';

beforeEach(() => {
  useServers.setState({ nodes: [], activeId: '' });
  useSession.setState({ host: null, restoring: false });
  useSettings.setState({ theme: 'dark', dense: false });
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined });
});

it('updates data-theme immediately through the fallback when ViewTransition is unavailable', async () => {
  render(<App />);
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
  act(() => useSettings.getState().setTheme('light'));
  expect(useSettings.getState().theme).toBe('light');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});
