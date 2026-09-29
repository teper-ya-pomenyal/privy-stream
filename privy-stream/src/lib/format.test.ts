import { expect, it } from 'vitest';
import { fmtNumber, fmtTime, plural, trackNum } from './format';

it('formats minutes and zero-padded seconds', () => {
  expect(fmtTime(125)).toBe('2:05');
  expect(fmtTime(0)).toBe('0:00');
});

it('chooses Russian plural forms across teens and hundreds', () => {
  const forms: [string, string, string] = ['трек', 'трека', 'треков'];
  expect([1, 2, 5, 11, 14, 21, 24, 111].map((n) => plural(n, forms))).toEqual([
    'трек', 'трека', 'треков', 'треков', 'треков', 'трек', 'трека', 'треков',
  ]);
});

it('formats track numbers and localized counts for display', () => {
  expect(trackNum(0)).toBe('01');
  expect(trackNum(10)).toBe('11');
  expect(fmtNumber(1234).replace(/\s/g, ' ')).toBe('1 234');
});
