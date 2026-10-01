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
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    legacyCopy(text);
  }
  return 'copied';
}
