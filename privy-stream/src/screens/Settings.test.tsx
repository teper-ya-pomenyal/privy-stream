import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Settings } from './Settings';

it('lists what stays local and what goes to the node', () => {
  render(<Settings />);
  expect(screen.getByText('Что хранится на устройстве')).toBeInTheDocument();
  expect(screen.getByText(/ключ входа, фонотека, список узлов/)).toBeInTheDocument();
  expect(screen.getByText('Что получает узел')).toBeInTheDocument();
  expect(screen.getByText(/логин и пароль при входе, поисковые запросы/)).toBeInTheDocument();
  expect(screen.queryByText('Клиент хранит всё на устройстве')).toBeNull();
});
