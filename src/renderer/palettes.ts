/**
 * Palette metadata for selectors and panel backgrounds.
 * Palette colors and swatches come from tokens.css.
 */

export interface PaletteOption {
  label: string;
  value: string;
  /** Preview background (light mode) */
  bg: string;
  /** Preview background (dark mode) */
  bgDark: string;
}

export const PALETTE_OPTIONS: PaletteOption[] = [
  {
    label: 'Default',
    value: 'default',
    bg: '#ffffff',
    bgDark: '#22252b',
  },
  {
    label: 'Graphite',
    value: 'graphite',
    bg: '#f1f1f0',
    bgDark: '#18191a',
  },
  {
    label: 'Sepia',
    value: 'sepia',
    bg: '#f5f0e8',
    bgDark: '#292522',
  },
  {
    label: 'High Contrast',
    value: 'contrast',
    bg: '#ffffff',
    bgDark: '#0a0a0a',
  },
  {
    label: 'Cool Blue',
    value: 'cool',
    bg: '#f0f4f8',
    bgDark: '#121a28',
  },
];
