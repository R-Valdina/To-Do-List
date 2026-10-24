/**
 * Selected geometric formulas adapted from pattern.css 1.0.0 by bansal-io (MIT).
 * Source: https://github.com/bansal-io/pattern.css
 * See THIRD_PARTY_NOTICES.md. Linen and notebook are local adaptations.
 * All backgrounds are CSS gradients: no remote assets or runtime dependencies.
 */
export const TEXTURES = {
  plain: 'Plain', dots: 'Dots', grid: 'Grid', stripes: 'Stripes',
  crossDots: 'Cross dots', gingham: 'Gingham', chevron: 'Chevron',
  triangles: 'Triangles', notebook: 'Notebook', linen: 'Linen',
};

/** Keep image, repeat size and offsets together so all previews match the list. */
export function patternStyle(name, dark = false, accent = '#0B3954') {
  const ink = `color-mix(in srgb, ${accent} ${dark ? '22%' : '20%'}, transparent)`;
  const soft = `color-mix(in srgb, ${accent} 10%, transparent)`;
  const patterns = {
    plain: { image: 'none', size: 'auto', position: '0 0' },
    dots: { image: `radial-gradient(circle, ${ink} 1.6px, transparent 1.7px)`,
      size: '15px 15px', position: '0 0' },
    grid: { image: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
      size: '22px 22px', position: '0 0' },
    stripes: { image: `repeating-linear-gradient(135deg, transparent 0, transparent 10px, ${ink} 10px, ${ink} 13px)`,
      size: 'auto', position: '0 0' },
    crossDots: { image: `radial-gradient(${ink} 1.5px, transparent 1.6px), radial-gradient(${ink} 1.5px, transparent 1.6px)`,
      size: '24px 24px', position: '0 0, 12px 12px' },
    gingham: { image: `repeating-linear-gradient(45deg, ${ink} 25%, transparent 25%, transparent 75%, ${ink} 75%, ${ink}), repeating-linear-gradient(45deg, ${ink} 25%, transparent 25%, transparent 75%, ${ink} 75%, ${ink})`,
      size: '32px 32px', position: '0 0, 16px 16px' },
    chevron: { image: `linear-gradient(135deg, ${ink} 25%, transparent 25%), linear-gradient(225deg, ${ink} 25%, transparent 25%), linear-gradient(315deg, ${ink} 25%, transparent 25%), linear-gradient(45deg, ${ink} 25%, transparent 25%)`,
      size: '32px 32px', position: '-16px 0, -16px 0, 0 0, 0 0' },
    triangles: { image: `linear-gradient(45deg, ${ink} 50%, transparent 50%)`,
      size: '24px 24px', position: '0 0' },
    notebook: { image: `repeating-linear-gradient(0deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent 24px)`,
      size: 'auto', position: '0 0' },
    linen: { image: `repeating-linear-gradient(0deg, ${soft} 0, ${soft} 1px, transparent 1px, transparent 4px), repeating-linear-gradient(90deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent 6px)`,
      size: 'auto', position: '0 0' },
  };
  return patterns[name] ?? patterns.plain;
}
