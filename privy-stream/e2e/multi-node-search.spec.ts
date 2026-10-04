import { expect, test, type Page } from '@playwright/test';

// Мультипоиск на двух мок-узлах: выдача склеивается, узел без сессии честно статусится.
// Узлы и каталоги — из src/api/mock-data.ts: мок обслуживает их в браузере, сети нет,
// поэтому состояние сеем в localStorage до загрузки страницы (как в listening.spec).

const EU3 = {
  id: 'eu3',
  name: 'open.eu3',
  host: 'eu3.privy.stream:8443',
  owner: 'alt_arkhiv',
  access: 'открытый',
  ping: 12,
  status: 'online',
  note: 'публичный узел, регистрация свободная',
};

const RU_IND = {
  id: 'ru-ind',
  name: 'independent',
  host: 'ind.local:9000',
  owner: 'k_volkov',
  access: 'по инвайту',
  ping: 34,
  status: 'online',
  note: 'самиздат-лейблы, ключ по приглашению',
};

type Tokens = Record<string, { access: string; refresh: string }>;

/** Узлы, настройки (мультипоиск включён) и токены по узлам — до первого скрипта страницы. */
async function seed(page: Page, tokens: Tokens) {
  await page.addInitScript(({ nodes, tokens }) => {
    localStorage.setItem('privy.servers', JSON.stringify({ state: { nodes, activeId: 'eu3' }, version: 1 }));
    localStorage.setItem(
      'privy.settings',
      JSON.stringify({ state: { dense: false, theme: 'dark', multiNodeSearch: true }, version: 0 }),
    );
    for (const [host, value] of Object.entries(tokens)) {
      localStorage.setItem(`privy.tokens:${host}`, JSON.stringify(value));
    }
  }, { nodes: [EU3, RU_IND], tokens });
}

test('мульти-поиск собирает выдачу двух узлов', async ({ page }) => {
  await seed(page, {
    [EU3.host]: { access: 'e2e-access.eu3', refresh: 'e2e-refresh.eu3' },
    [RU_IND.host]: { access: 'e2e-access.ind', refresh: 'e2e-refresh.ind' },
  });

  await page.goto('/#/catalog');
  // Запрос «а» находит треки на обоих узлах: мок ищет по названию, артисту и релизу.
  await page.getByLabel('Поиск по узлу').fill('а');

  await expect(page.getByRole('heading', { name: 'Поиск по узлам' })).toBeVisible();

  // Трек каждого узла в секции «Треки» — с бейджем узла-источника:
  // «Ток по проводам» есть только у eu3, «Свободная частота» — только у independent.
  const eu3Row = page.getByRole('button', { name: 'Играть «Ток по проводам»' });
  await expect(eu3Row).toBeVisible();
  await expect(eu3Row.getByText('open.eu3')).toBeVisible();

  const indRow = page.getByRole('button', { name: 'Играть «Свободная частота»' });
  await expect(indRow).toBeVisible();
  await expect(indRow.getByText('independent')).toBeVisible();
});

test('узел без входа честно статусится', async ({ page }) => {
  // Сессия только на eu3; independent просит вход.
  await seed(page, { [EU3.host]: { access: 'e2e-access.eu3', refresh: 'e2e-refresh.eu3' } });

  await page.goto('/#/catalog');
  await page.getByLabel('Поиск по узлу').fill('а');

  // Выдача узла с сессией показана как обычно…
  await expect(page.getByRole('button', { name: 'Играть «Ток по проводам»' })).toBeVisible();
  // …а independent назван в строке статуса, без падения поиска.
  await expect(page.getByText('independent: нужен вход')).toBeVisible();
  // Экран не уехал на вход: маршрут на месте, формы логина нет.
  await expect(page).toHaveURL(/#\/catalog/);
  await expect(page.getByPlaceholder('user_name')).toHaveCount(0);
  // Трека чужого узла в выдаче нет — его поиск не отвечал.
  await expect(page.getByRole('button', { name: 'Играть «Свободная частота»' })).toHaveCount(0);
});
