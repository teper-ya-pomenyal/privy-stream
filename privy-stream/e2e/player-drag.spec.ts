import { expect, test, devices, type Page } from '@playwright/test';

// Жесты шторки плеера: тяга мини-плеера вверх открывает его «в руке»,
// тяга верхней панели вниз закрывает. Мышь в мобильной эмуляции шлёт те же
// pointer-события, что и палец, — логика жеста общая.
test.use({ ...devices['Pixel 7'], channel: 'chrome' });

/** П로그 по мини-плееру: зажать, тянуть по шагам, отпустить. */
const drag = async (page: Page, from: { x: number; y: number }, dy: number) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + dy, { steps: 12 });
  await page.mouse.up();
};

const loginAndPlay = async (page: Page) => {
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
  await page.getByRole('button', { name: 'Слушать' }).click();
  await expect(page.getByRole('button', { name: /Полынный свет.*Тихая Комната/ })).toBeVisible();
};

test('mini player opens by drag, full player closes by dragging the top bar down', async ({ page }) => {
  await loginAndPlay(page);

  // Мини-плеер и строка очереди в шторке называют трек одинаково — берём первую
  const miniBar = page.getByRole('button', { name: /Полынный свет.*Тихая Комната/ }).first();
  const from = await miniBar.boundingBox();
  const grab = { x: from!.x + from!.width / 2, y: from!.y + from!.height / 2 };

  // Тяга вверх — шторка едет за пальцем: верхняя панель уже видна на середине пути
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x, grab.y - 120, { steps: 12 });
  await expect(page.getByText('СЕЙЧАС ИГРАЕТ')).toBeVisible();
  await page.mouse.move(grab.x, grab.y - 300, { steps: 12 });
  await page.mouse.up();

  // Отпустили выше четверти экрана — шторка осталась открыта
  const topBar = page.getByText('СЕЙЧАС ИГРАЕТ');
  await expect(topBar).toBeVisible();
  await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible();

  // Даём анимации открытия доиграть: ручка уезжает наверх, целиться в неё
  // нужно, когда шторка встала на место
  await page.waitForTimeout(500);

  // Тяга верхней панели вниз закрывает: мини-плеер вернулся
  const handle = await topBar.boundingBox();
  await drag(page, { x: handle!.x + 60, y: handle!.y + handle!.height / 2 }, 260);
  await expect(page.getByText('СЕЙЧАС ИГРАЕТ')).toBeHidden();
  await expect(miniBar).toBeVisible();
});

test('mini player still opens by tap and full player closes by Свёрнуть', async ({ page }) => {
  await loginAndPlay(page);

  const miniBar = page.getByRole('button', { name: /Полынный свет.*Тихая Комната/ }).first();
  const box = await miniBar.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByText('СЕЙЧАС ИГРАЕТ')).toBeVisible();

  await page.getByRole('button', { name: 'Свернуть' }).click();
  await expect(page.getByText('СЕЙЧАС ИГРАЕТ')).toBeHidden();
  await expect(miniBar).toBeVisible();
});

test('desktop bar still opens the full player by tap and closes it back', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginAndPlay(page);

  await page.getByRole('button', { name: 'Очередь воспроизведения' }).click();
  const topBar = page.getByText('СЕЙЧАС ИГРАЕТ');
  await expect(topBar).toBeVisible();
  await page.getByRole('button', { name: 'Свернуть' }).click();
  await expect(topBar).toBeHidden();
});
