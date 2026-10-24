import { patternStyle, TEXTURES } from './patterns.js';
export { TEXTURES } from './patterns.js';

/** Color samples approximate the user-approved palettes. No external assets. */
export const COLORS = {
  white: { name: 'White', base: '#FFFFFF', light: '#FFFFFF', dark: '#FFFFFF' },
  napery: { name: 'Napery', base: '#ECD9B5', light: '#80602D', dark: '#F3E4C8' },
  easyGreen: { name: 'Easy Green', base: '#ABC0A5', light: '#3E6548', dark: '#CADDC2' },
  softerTan: { name: 'Softer Tan', base: '#BDAD91', light: '#6F583C', dark: '#E1CEB3' },
  agateGreen: { name: 'Agate Green', base: '#8FA486', light: '#3C6044', dark: '#B8D2AF' },
  boscPear: { name: 'Bosc Pear', base: '#B08B50', light: '#78521E', dark: '#E3BF7F' },
  grounded: { name: 'Grounded', base: '#705B49', light: '#684932', dark: '#D2B49A' },
  smokyBlue: { name: 'Smoky Blue', base: '#5D737B', light: '#385C6B', dark: '#B0CED8' },
  dressBlues: { name: 'Dress Blues', base: '#2D4562', light: '#2D4562', dark: '#B4CBED' },
  teal: { name: 'Teal', base: '#087E8B', light: '#075C65', dark: '#81D5DE' },
  cyan: { name: 'Cyan', base: '#00B2CA', light: '#006878', dark: '#7CE5F3' },
  mint: { name: 'Mint', base: '#B7E4C7', light: '#2C6844', dark: '#D1EEDB' },
  sand: { name: 'Sandstone', base: '#D9C7AA', light: '#77582F', dark: '#ECDBC1', family: 'Earth & autumn' },
  clay: { name: 'Clay', base: '#C58C74', light: '#864B35', dark: '#E9BBA8', family: 'Earth & autumn' },
  terracotta: { name: 'Terracotta', base: '#C16C50', light: '#8F412C', dark: '#EFA98C', family: 'Earth & autumn' },
  rust: { name: 'Rust', base: '#A64F35', light: '#893B28', dark: '#E7A087', family: 'Earth & autumn' },
  pumpkin: { name: 'Pumpkin', base: '#D78B3D', light: '#8B521A', dark: '#F1BD7D', family: 'Earth & autumn' },
  ochre: { name: 'Golden Ochre', base: '#C7A044', light: '#7D5D12', dark: '#E9CD7A', family: 'Earth & autumn' },
  olive: { name: 'Olive', base: '#95945C', light: '#5B5D2D', dark: '#CBCE98', family: 'Earth & autumn' },
  moss: { name: 'Moss', base: '#708566', light: '#435E37', dark: '#ACC69F', family: 'Earth & autumn' },
  evergreen: { name: 'Evergreen', base: '#426D5B', light: '#285642', dark: '#97C4AE', family: 'Earth & autumn' },
  cocoa: { name: 'Cocoa', base: '#836552', light: '#67452E', dark: '#D6B69B', family: 'Earth & autumn' },
  burgundy: { name: 'Burgundy', base: '#925568', light: '#76394D', dark: '#DEA8BC', family: 'Earth & autumn' },
  plum: { name: 'Autumn Plum', base: '#80617F', light: '#634362', dark: '#CFB1D1', family: 'Earth & autumn' },
};

const legacyColors = { creamy: 'white', violet: 'dressBlues', blue: 'smokyBlue',
  green: 'agateGreen', amber: 'boscPear', rose: 'softerTan', slate: 'grounded' };

export function normalizeAppearance(value) {
  const color = legacyColors[value?.color] ?? value?.color;
  return {
    color: Object.hasOwn(COLORS, color) ? color : 'white',
    texture: Object.hasOwn(TEXTURES, value?.texture) ? value.texture : 'plain',
  };
}

export function applyAppearance(target, value, dark = false) {
  const appearance = normalizeAppearance(value);
  const color = COLORS[appearance.color];
  const white = appearance.color === 'white';
  const accent = dark ? color.dark : color.light;
  const pattern = patternStyle(appearance.texture, dark && !white, white ? '#737373' : accent);
  target.classList.toggle('white-list', white);
  const properties = {
    '--list-accent': white ? '#FFFFFF' : accent,
    '--list-border': white ? '#FFFFFF' : `color-mix(in srgb, ${color.base} 65%, var(--line))`,
    '--list-tint': white ? '#FFFFFF' : `color-mix(in srgb, ${color.base} ${dark ? '30%' : '35%'}, var(--panel))`,
    '--list-ink': white ? '#343434' : accent,
    '--list-progress': white ? '#A6A6A6' : accent,
    '--list-check': white ? '#737373' : accent,
    '--list-selection': white ? '#A6A6A6' : accent,
    '--list-texture': pattern.image,
  };
  Object.entries(properties).forEach(([name, value]) => target.style.setProperty(name, value));
  target.style.backgroundSize = pattern.size;
  target.style.backgroundPosition = pattern.position;
}
