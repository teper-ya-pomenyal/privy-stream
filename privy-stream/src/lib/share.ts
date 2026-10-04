import type { ArtistRef, Release, Track } from '../api/types';

/** Сущность, которой делятся: трек из очереди/плеера, релиз или артист. */
export type ShareTarget =
  | { kind: 'track'; track: Track }
  | { kind: 'release'; release: Release }
  | { kind: 'artist'; artist: ArtistRef };

/**
 * Публичная ссылка на страницу сущности. Веб-клиент — сайт одного узла,
 * поэтому база — текущий origin; app-режим (не-http протокол Tauri) публичного
 * адреса не имеет — null, и шторка остаётся с копированием описания.
 */
export function buildShareUrl(target: ShareTarget, loc: Location = location): string | null {
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') return null;
  const base = loc.origin + loc.pathname;
  switch (target.kind) {
    case 'release':
      return `${base}#/album/${encodeURIComponent(target.release.id)}`;
    case 'artist':
      return `${base}#/artist/${encodeURIComponent(target.artist.id)}`;
    case 'track':
      // Страницы трека в API v1 нет — ведём на альбом, подсвечивая трек параметром ?t=.
      // Без releaseId (узел не отдал альбом) ссылки нет — деградация до текста.
      if (!target.track.releaseId) return null;
      return `${base}#/album/${encodeURIComponent(target.track.releaseId)}?t=${encodeURIComponent(target.track.id)}`;
  }
}

/** Заголовок текста шаринга: «Название» — Артист · Privy Stream. */
export function shareHead(target: ShareTarget): string {
  switch (target.kind) {
    case 'track':
      return `«${target.track.title}» — ${target.track.artist} · Privy Stream`;
    case 'release':
      return `«${target.release.title}» — ${target.release.artist} · Privy Stream`;
    case 'artist':
      return `«${target.artist.name}» — артист · Privy Stream`;
  }
}

/**
 * Текст для мессенджеров и буфера обмена: со ссылкой — заголовок и ссылка
 * строкой ниже; без ссылки (app-режим) — то, что поможет найти сущность на
 * узле: адрес узла и каталожный код.
 */
export function buildShareText(target: ShareTarget, url: string | null, host: string): string {
  const head = shareHead(target);
  if (url) return `${head}\n${url}`;
  return [head, `Узел: ${host}`, target.kind === 'release' && target.release.code && `Каталог: ${target.release.code}`]
    .filter(Boolean)
    .join('\n');
}

/**
 * sms:-ссылка с телом сообщения: iOS требует «&» перед body=, Android — «?».
 * Нераспознанная платформа получает Android-разделитель (встречается чаще).
 */
export function smsHref(body: string, ua: string = navigator.userAgent): string {
  const sep = /iPhone|iPad|iPod/i.test(ua) ? '&' : '?';
  return `sms:${sep}body=${encodeURIComponent(body)}`;
}

/** Fallback для не-secure контекстов (web-сборка по plain http в локальной сети). */
function legacyCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/** 'shared' — системный шер (или отмена пользователем), 'copied' — текст в буфере обмена. */
export type ShareResult = 'shared' | 'copied';

/**
 * Тихое копирование в буфер: без системного шера (кнопка «Копировать» шторки
 * должна срабатывать сразу, где бы ни был доступен navigator.share) и с
 * фолбэком для не-secure контекстов.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    legacyCopy(text);
  }
}

/**
 * Поделиться текстом: системный шер, если есть, иначе — буфер обмена.
 * Отмена шера пользователем — не ошибка и не копия; сбой шера — повод
 * попробовать буфер обмена.
 */
export async function shareOrCopy(text: string, title?: string, url?: string): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: url || undefined });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
    }
  }
  await copyText(text);
  return 'copied';
}
