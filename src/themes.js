/** Color samples approximate the user-approved palettes. No external assets. */
export const COLORS = {
  white: { name: 'White', base: '#FFFFFF', light: '#FFFFFF', dark: '#FFFFFF' },
  napery: { name: 'Napery', base: '#ECD9B5', light: '#80602D', dark: '#EAD0A0' },
  easyGreen: { name: 'Easy Green', base: '#ABC0A5', light: '#3E6548', dark: '#BED5B5' },
  softerTan: { name: 'Softer Tan', base: '#BDAD91', light: '#6F583C', dark: '#DCC6A7' },
  agateGreen: { name: 'Agate Green', base: '#8FA486', light: '#3C6044', dark: '#AFCCA5' },
  boscPear: { name: 'Bosc Pear', base: '#B08B50', light: '#78521E', dark: '#E3BF7F' },
  grounded: { name: 'Grounded', base: '#705B49', light: '#684932', dark: '#D2B49A' },
  smokyBlue: { name: 'Smoky Blue', base: '#5D737B', light: '#385C6B', dark: '#B0CED8' },
  dressBlues: { name: 'Dress Blues', base: '#2D4562', light: '#2D4562', dark: '#B4CBED' },
  teal: { name: 'Teal', base: '#087E8B', light: '#07636D', dark: '#81D5DE' },
  cyan: { name: 'Cyan', base: '#00B2CA', light: '#006878', dark: '#7CE5F3' },
  mint: { name: 'Mint', base: '#B7E4C7', light: '#2C6844', dark: '#B7E4C7' },
};
export const TEXTURES = { plain: 'Plain', dots: 'Dots', grid: 'Grid', stripes: 'Stripes' };

const legacyColors = { creamy: 'white', violet: 'dressBlues', blue: 'smokyBlue',
  green: 'agateGreen', amber: 'boscPear', rose: 'softerTan', slate: 'grounded' };

export function normalizeAppearance(value) {
  const color = legacyColors[value?.color] ?? value?.color;
  return {
    color: Object.hasOwn(COLORS, color) ? color : 'white',
    texture: Object.hasOwn(TEXTURES, value?.texture) ? value.texture : 'plain',
  };
}

export function textureImage(name, dark = false) {
  const ink = dark ? '#FFFFFF1C' : '#0B395422';
  if (name === 'dots') return `radial-gradient(circle, ${ink} 1.6px, transparent 1.7px)`;
  if (name === 'grid') return `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`;
  if (name === 'stripes') return `repeating-linear-gradient(135deg, transparent 0, transparent 10px, ${ink} 10px, ${ink} 13px)`;
  return 'none';
}

export function applyAppearance(target, value, dark = false) {
  const appearance = normalizeAppearance(value);
  const color = COLORS[appearance.color];
  const white = appearance.color === 'white';
  const accent = dark ? color.dark : color.light;
  target.classList.toggle('white-list', white);
  const properties = {
    '--list-accent': white ? '#FFFFFF' : accent,
    '--list-border': white ? '#FFFFFF' : `color-mix(in srgb, ${color.base} 65%, var(--line))`,
    '--list-tint': white ? '#FFFFFF' : `color-mix(in srgb, ${color.base} ${dark ? '30%' : '35%'}, var(--panel))`,
    '--list-ink': white ? '#343434' : accent,
    '--list-progress': white ? '#A6A6A6' : accent,
    '--list-check': white ? '#737373' : accent,
    '--list-selection': white ? '#A6A6A6' : accent,
    '--list-texture': textureImage(appearance.texture, dark && !white),
  };
  Object.entries(properties).forEach(([name, value]) => target.style.setProperty(name, value));
  target.style.backgroundSize = appearance.texture === 'dots' ? '15px 15px' :
    appearance.texture === 'grid' ? '22px 22px' : 'auto';
}
