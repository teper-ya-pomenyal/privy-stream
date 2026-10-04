import { expect, test, devices, type Page } from '@playwright/test';

// Шторка «Поделиться» в веб-режиме на мобильном: ссылка на сущность, копирование,
// ссылка трека на альбом с ?t= и приём такой ссылки с подсветкой трека.
// Pixel 7 + chrome — тот же мобильный стенд, что и в player-drag.spec.
test.use({ ...devices['Pixel 7'], channel: 'chrome' });

const loginAndOpenRelease = async (page: Page) => {
  await page.goto('/');
  await page.getByPlaceholder('user_name').fill('listener');
  await page.getByPlaceholder('••••••••••').fill('validpass!');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: 'Поиск по узлу' })).toBeVisible();
  await page.getByRole('link', { name: /Полынный свет/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Полынный свет' })).toBeVisible();
};

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Поделиться' });

test('album share sheet shows the album link and copies it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loginAndOpenRelease(page);

  await page.getByRole('button', { name: 'Поделиться' }).click();
  await expect(sheet(page)).toBeVisible();
  const link = sheet(page).getByRole('textbox');
  await expect(link).toHaveValue(/#\/album\/AR-014$/);

  await sheet(page).getByRole('button', { name: 'Копировать' }).click();
  await expect(sheet(page).getByRole('button', { name: 'Скопировано' })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('#/album/AR-014');
});

test('now playing share opens the track sheet with ?t=', async ({ page }) => {
  await loginAndOpenRelease(page);
  await page.getByRole('button', { name: 'Слушать' }).click();

  // Развернуть полный плеер: тяга мини-плеера вверх (жест плеера).
  const mini = page.getByRole('button', { name: /Полынный свет.*Тихая Комната/ }).first();
  const box = await mini.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y - 300, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText('СЕЙЧАС ИГРАЕТ')).toBeVisible();

  // Кнопка героя «поделиться» — в нижнем регистре; «Поделиться» альбома остаётся
  // за открытым плеером, поэтому exact с учётом регистра.
  await page.getByRole('button', { name: 'поделиться', exact: true }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole('textbox')).toHaveValue(/#\/album\/AR-014\?t=t01$/);
});

test('artist share sheet shows the artist link', async ({ page }) => {
  await loginAndOpenRelease(page);
  await page.getByRole('button', { name: 'Тихая Комната' }).click();
  await expect(page.getByRole('heading', { name: 'Тихая Комната' })).toBeVisible();

  await page.getByRole('button', { name: 'Поделиться' }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole('textbox')).toHaveValue(/#\/artist\/tihaya-komnata$/);
});

test('an opened track link highlights the track in the album', async ({ page }) => {
  await loginAndOpenRelease(page);
  // Паттерн hash-навигации: приём ссылки, которой поделились из шторки.
  await page.evaluate(() => {
    window.location.hash = '#/album/AR-014?t=t01';
  });
  const highlighted = page.locator('[class*="rowTarget"]');
  await expect(highlighted).toHaveCount(1);
  await expect(highlighted.getByRole('button', { name: /Полынный свет/ })).toBeVisible();
});
