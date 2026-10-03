import { expect, it } from 'vitest';
import { shouldClose } from './sheetClose';

const info = (offsetY: number, velocityY: number) => ({
  offset: { x: 0, y: offsetY },
  velocity: { x: 0, y: velocityY },
  point: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
});

it('closes when dragged past a quarter of the viewport', () => {
  expect(shouldClose(info(201, 0), 800)).toBe(true);
  expect(shouldClose(info(199, 0), 800)).toBe(false);
});

it('closes on a fast fling even over a short distance', () => {
  expect(shouldClose(info(50, 501), 800)).toBe(true);
  expect(shouldClose(info(50, 499), 800)).toBe(false);
});

it('ignores upward drags and leftward velocity', () => {
  expect(shouldClose(info(-300, -800), 800)).toBe(false);
});
