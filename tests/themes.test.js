import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, TEXTURES, normalizeAppearance } from '../src/themes.js';
import { patternStyle } from '../src/patterns.js';
import { emptyState, validateState } from '../src/model.js';

function rgb(hex) {
  return hex.slice(1).match(/../g).map(value => parseInt(value, 16));
}
function luminance(values) {
  const linear = values.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('all list colors keep readable heading contrast on their light and dark tints', () => {
  for (const [key, color] of Object.entries(COLORS)) {
    for (const dark of [false, true]) {
      const white = key === 'white';
      const panel = rgb(dark ? '#0B3954' : '#FFFFFF');
      const base = rgb(color.base);
      const amount = dark ? 0.3 : 0.35;
      const background = white ? rgb('#FFFFFF') : base.map((channel, index) => channel * amount + panel[index] * (1 - amount));
      const ink = rgb(white ? '#343434' : dark ? color.dark : color.light);
      assert.ok(contrast(ink, background) >= 4.5, `${key} ${dark ? 'dark' : 'light'}: ${contrast(ink, background)}`);
    }
  }
});

test('autumn colors and every pattern roundtrip through backup validation', () => {
  const autumn = Object.entries(COLORS).filter(([, color]) => color.family === 'Earth & autumn');
  assert.equal(autumn.length, 12);
  for (const [color] of autumn) {
    for (const texture of Object.keys(TEXTURES)) {
      const state = { ...emptyState(), lists: [{ id: 'l', name: 'Autumn', due: '', tasks: [], appearance: { color, texture } }] };
      assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))).lists[0].appearance, { color, texture });
    }
  }
});

test('pattern metadata covers every choice and never requests remote assets', () => {
  assert.equal(Object.keys(TEXTURES).length, 10);
  for (const key of Object.keys(TEXTURES)) {
    const pattern = patternStyle(key, false, '#96442E');
    assert.equal(typeof pattern.image, 'string');
    assert.equal(typeof pattern.size, 'string');
    assert.equal(typeof pattern.position, 'string');
    assert.doesNotMatch(pattern.image, /url\(|https?:/);
    if (key !== 'plain') assert.match(pattern.image, /gradient/);
  }
  assert.equal(patternStyle('plain').image, 'none');
  assert.deepEqual(patternStyle('unknown'), patternStyle('plain'));
});

test('legacy patterns remain supported and layered offsets are preserved', () => {
  for (const texture of ['plain', 'dots', 'grid', 'stripes']) {
    assert.equal(normalizeAppearance({ color: 'creamy', texture }).texture, texture);
  }
  assert.equal(patternStyle('crossDots').position, '0 0, 12px 12px');
  assert.equal(patternStyle('gingham').position, '0 0, 16px 16px');
  assert.notEqual(patternStyle('linen', false).image, patternStyle('linen', true).image);
});
