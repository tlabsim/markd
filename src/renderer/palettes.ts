/**
 * Palette Definitions — single source of truth.
 * To adjust a palette, edit the swatch colors here.
 * CSS styles live in index.css under `[data-palette="..."]` selectors.
 */

export interface PaletteOption {
  label: string;
  value: string;
  /** Preview background (light mode) */
  bg: string;
  /** Preview background (dark mode) */
  bgDark: string;
  /** 3 representative swatch colors (light mode) */
  swatches: [string, string, string];
  /** 3 representative swatch colors (dark mode) */
  swatchesDark: [string, string, string];
}

export const PALETTE_OPTIONS: PaletteOption[] = [
  {
    label: 'Default',
    value: 'default',
    bg: '#ffffff',
    bgDark: '#1a222b',
    swatches: ['#1f2328', '#0969da', '#3d5a6b'],
    swatchesDark: ['#d0d7de', '#58a6ff', '#9cccd8'],
  },
  {
    label: 'Sepia',
    value: 'sepia',
    bg: '#f5f0e8',
    bgDark: '#26211a',
    swatches: ['#f5f0e8', '#4a3f35', '#7a6040'],
    swatchesDark: ['#26211a', '#d4c8b8', '#c4a87c'],
  },
  {
    label: 'High Contrast',
    value: 'contrast',
    bg: '#ffffff',
    bgDark: '#0a0a0a',
    swatches: ['#ffffff', '#030712', '#2563eb'],
    swatchesDark: ['#0a0a0a', '#f9fafb', '#60a5fa'],
  },
  {
    label: 'Cool Blue',
    value: 'cool',
    bg: '#f0f4f8',
    bgDark: '#121a28',
    swatches: ['#f0f4f8', '#334155', '#2563eb'],
    swatchesDark: ['#121a28', '#cbd5e1', '#60a5fa'],
  },
];
