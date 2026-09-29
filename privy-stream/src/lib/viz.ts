// Детерминированные высоты для индикатора уровня — как в макете.
// Заменить на реальный анализ уровня (от узла или через Web Audio).

export function meterHeights(tick: number, playing: boolean, count = 14): number[] {
  return Array.from({ length: count }, (_, i) => (playing ? 18 + Math.abs(Math.sin((tick + i) * 0.9)) * 82 : 8));
}
