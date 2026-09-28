import type { NodeInfo, Release, Track } from './types';

// Мок-данные из макета. Живут только за слоем API (mock.ts); UI их не импортирует.

export const MOCK_NODES: NodeInfo[] = [
  { id: 'eu3', name: 'open.eu3', host: 'eu3.privy.stream:8443', owner: 'alt_arkhiv', access: 'открытый', ping: 12, status: 'online', note: 'публичный узел, регистрация свободная' },
  { id: 'ru-ind', name: 'independent', host: 'ind.local:9000', owner: 'k_volkov', access: 'по инвайту', ping: 34, status: 'online', note: 'самиздат-лейблы, ключ по приглашению' },
  { id: 'nl-vault', name: 'vault-nl', host: '89.211.4.77:8443', owner: 'vault_op', access: 'открытый', ping: 78, status: 'online', note: 'архив редких изданий, отдаёт FLAC 24/96' },
  { id: 'home', name: 'мой домашний', host: '192.168.1.14:8443', owner: 'ты', access: 'приватный', ping: 2, status: 'offline', note: 'узел на твоём железе, виден только тебе' },
];

export const MOCK_ARTISTS: Record<string, { name: string; activeYears: string; listeners: number; countries: number; inLibraries: number }> = {
  'tihaya-komnata': { name: 'Тихая Комната', activeYears: '2019—2025', listeners: 48210, countries: 182, inLibraries: 9340 },
  'severny-shum': { name: 'Северный Шум', activeYears: '2020—2023', listeners: 21480, countries: 176, inLibraries: 4120 },
  malva: { name: 'Мальва', activeYears: '2021—2025', listeners: 35902, countries: 182, inLibraries: 7715 },
  'otdelny-kanal': { name: 'Отдельный Канал', activeYears: '2018—2022', listeners: 12066, countries: 168, inLibraries: 2380 },
  kama: { name: 'Кама', activeYears: '2022—2024', listeners: 18340, countries: 181, inLibraries: 3905 },
  gost: { name: 'Гость', activeYears: '2024—2025', listeners: 9120, countries: 179, inLibraries: 1650 },
};

const R = (code: string, title: string, artistId: string, year: number, genre: string, flagged: boolean, node: string) => ({
  release: { id: code, code, title, artistId, artist: MOCK_ARTISTS[artistId].name, year, genre, flagged, format: 'FLAC 24/96' } satisfies Release,
  node,
});

export const MOCK_RELEASES = [
  R('AR-014', 'Полынный свет', 'tihaya-komnata', 2024, 'эксперимент', false, 'eu3'),
  R('AR-021', 'Запрещённые письма', 'severny-shum', 2023, 'пост-панк', true, 'ru-ind'),
  R('AR-033', 'Ночной эфир', 'malva', 2025, 'эмбиент', false, 'eu3'),
  R('AR-047', 'Красная линия', 'otdelny-kanal', 2022, 'нойз', true, 'nl-vault'),
  R('AR-052', 'Молчание не входит', 'kama', 2024, 'фолк', false, 'eu3'),
  R('AR-060', 'Свободная частота', 'tihaya-komnata', 2021, 'краут', false, 'ru-ind'),
  R('AR-066', 'Без подписи', 'gost', 2025, 'драм-н-бэйс', true, 'nl-vault'),
  R('AR-071', 'Территория', 'malva', 2023, 'минимал', false, 'eu3'),
];

const releaseById = (id: string) => MOCK_RELEASES.find((r) => r.release.id === id)!.release;

const T = (id: string, title: string, releaseId: string, durationSec: number, format: string): Track => {
  const r = releaseById(releaseId);
  return { id, title, artistId: r.artistId, artist: r.artist, releaseId, release: r.title, durationSec, format };
};

/** Все треки на узлах. Первые девять — они же лежат в локальной фонотеке. */
export const MOCK_TRACKS: Track[] = [
  T('t01', 'Полынный свет', 'AR-014', 252, 'FLAC'),
  T('t02', 'Ток по проводам', 'AR-014', 218, 'FLAC'),
  T('t03', 'Радиомолчание', 'AR-021', 304, 'FLAC'),
  T('t04', 'Письмо без адреса', 'AR-021', 176, 'ALAC'),
  T('t05', 'Ночной эфир', 'AR-033', 381, 'FLAC'),
  T('t06', 'Красная линия', 'AR-047', 191, 'FLAC'),
  T('t07', 'Молчание не входит', 'AR-052', 285, 'MP3 320'),
  T('t08', 'Свободная частота', 'AR-060', 422, 'FLAC'),
  T('t09', 'Без подписи', 'AR-066', 209, 'FLAC'),
  T('t10', 'Территория', 'AR-071', 318, 'FLAC'),
  T('t11', 'Граница сна', 'AR-071', 242, 'FLAC'),
];

