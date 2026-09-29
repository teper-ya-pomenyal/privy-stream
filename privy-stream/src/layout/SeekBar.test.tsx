import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SeekBar } from './PlayerBar';

const seek = vi.fn();
beforeEach(() => seek.mockClear());
const renderBar = (position = 30, duration = 60, disabled = false) =>
  render(<SeekBar position={position} duration={duration} onSeek={seek} disabled={disabled} />);

it('seeks with arrow keys in 10 second steps', () => {
  renderBar(30, 60);
  const slider = screen.getByRole('slider');
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  expect(seek).toHaveBeenLastCalledWith(40 / 60);
  fireEvent.keyDown(slider, { key: 'ArrowLeft' });
  expect(seek).toHaveBeenLastCalledWith(20 / 60);
});

it('jumps to the ends with Home and End', () => {
  renderBar(30, 60);
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' });
  expect(seek).toHaveBeenLastCalledWith(0);
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
  expect(seek).toHaveBeenLastCalledWith(1);
});

it('announces position and total time', () => {
  renderBar(30, 60);
  const slider = screen.getByRole('slider');
  expect(slider).toHaveAttribute('aria-valuenow', '30');
  expect(slider).toHaveAttribute('aria-valuetext', '0:30 из 1:00');
});

it('seeks where the pointer lands', () => {
  renderBar(0, 60);
  const slider = screen.getByRole('slider');
  slider.getBoundingClientRect = () =>
    ({ left: 0, width: 100, top: 0, height: 10, right: 100, bottom: 10, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  fireEvent.pointerDown(slider, { clientX: 50, buttons: 1, pointerId: 1 });
  expect(seek).toHaveBeenLastCalledWith(0.5);
});

it('ignores input while duration is unknown', () => {
  renderBar(0, 0, true);
  const slider = screen.getByRole('slider');
  expect(slider).toHaveAttribute('aria-disabled', 'true');
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  expect(seek).not.toHaveBeenCalled();
});
