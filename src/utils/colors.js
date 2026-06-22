/**
 * BudgetWing — Color Palette
 * Curated neon colors for budget categories
 */

export const PALETTE = [
  '#4f9eff', // electric blue
  '#a259ff', // vivid purple
  '#00d4ff', // cyan
  '#ff6bce', // pink
  '#3dffa0', // mint green
  '#ffb545', // amber
  '#ff6b6b', // coral red
  '#ffd93d', // golden yellow
  '#6bceff', // sky blue
  '#c45cff', // violet
  '#00e5a0', // emerald
  '#ff9a3d', // orange
  '#b5f542', // lime
  '#ff4fa0', // hot pink
  '#42c9ff', // ice blue
  '#ff7b5c', // salmon
];

/**
 * Returns a color from the palette by index (wraps around)
 */
export function getPaletteColor(index) {
  return PALETTE[index % PALETTE.length];
}

/**
 * Given a hex color, compute a lighter tint (for backgrounds)
 */
export function hexToRgba(hex, alpha = 0.15) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
