import type { PanInfo } from 'motion/react';

/** Тяга ниже четверти экрана или рывок быстрее 500 px/s закрывают шторку. */
export const CLOSE_DISTANCE_FRACTION = 0.25;
export const CLOSE_FLING_V_PXS = 500;

/**
 * Общий порог закрытия для нижних шторок (полный плеер, окно «Поделиться»):
 * далеко тянут вниз или резко дёрнули — закрываем, иначе Motion возвращает
 * шторку пружиной к открытому состоянию.
 */
export function shouldClose(info: PanInfo, viewportHeight: number): boolean {
  return info.offset.y > viewportHeight * CLOSE_DISTANCE_FRACTION || info.velocity.y > CLOSE_FLING_V_PXS;
}
