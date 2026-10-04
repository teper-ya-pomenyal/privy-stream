import { expect, test } from '@playwright/test';

test('login on a mock node, play an album, navigate tracks, and save a favorite', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('privy.servers', JSON.stringify({
      state: {
        nodes: [{
          id: 'eu3',
          name: 'open.eu3',
          host: 'eu3.privy.stream:8443',
          owner: 'alt_arkhiv',
          access: 'открытый',
          note: 'публичный узел',
          ping: 12,
          status: 'online',
        }],
        activeId: 'eu3',
      },
      version: 1,
    }));
  });

  await page.goto('/');
  await page.getByPlaceholder('user_name').fill('listener');
  await page.getByPlaceholder('••••••••••').fill('validpass!');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: 'Поиск по узлу' })).toBeVisible();

  await page.getByRole('link', { name: /Полынный свет/ }).click();
  await expect(page.getByRole('heading', { name: 'Полынный свет' })).toBeVisible();
  await page.getByRole('button', { name: 'Слушать' }).click();
  await expect(page.getByRole('button', { name: /Полынный свет.*Тихая Комната/ })).toBeVisible();

  await page.getByRole('button', { name: 'Следующий' }).click();
  await expect(page.getByRole('button', { name: /Ток по проводам.*Тихая Комната/ })).toBeVisible();
  await page.getByRole('button', { name: 'Предыдущий' }).click();
  await expect(page.getByRole('button', { name: /Полынный свет.*Тихая Комната/ })).toBeVisible();

  await page.getByRole('button', { name: 'Добавить в фонотеку' }).first().click();
  await page.getByRole('link', { name: 'Фонотека' }).click();
  // Текст «Полынный свет» остаётся в DOM уходящего альбома и мини-плеера —
  // ждём переход и проверяем трек именно в списке фонотеки (кнопка строки
  // называется «Играть/Пауза „…"» — играющий трек сейчас на паузе-видe «Пауза»).
  await expect(page).toHaveURL(/library/);
  await expect(page.getByRole('button', { name: /«Полынный свет»/ })).toBeVisible();
});
