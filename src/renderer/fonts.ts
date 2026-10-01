type FontLoader = () => Promise<unknown>;

const fontLoaders: Array<{ family: string; load: FontLoader }> = [
  { family: 'IBM Plex Mono', load: () => Promise.all([
    import('@fontsource/ibm-plex-mono/latin-400.css'), import('@fontsource/ibm-plex-mono/latin-400-italic.css'),
    import('@fontsource/ibm-plex-mono/latin-700.css'), import('@fontsource/ibm-plex-mono/latin-700-italic.css'),
  ]) },
  { family: 'Geist Mono', load: () => Promise.all([
    import('@fontsource/geist-mono/latin-400.css'), import('@fontsource/geist-mono/latin-400-italic.css'),
    import('@fontsource/geist-mono/latin-700.css'), import('@fontsource/geist-mono/latin-700-italic.css'),
  ]) },
  { family: 'Source Code Pro', load: () => Promise.all([
    import('@fontsource/source-code-pro/latin-400.css'), import('@fontsource/source-code-pro/latin-400-italic.css'),
    import('@fontsource/source-code-pro/latin-700.css'), import('@fontsource/source-code-pro/latin-700-italic.css'),
  ]) },
  { family: 'Inter', load: () => Promise.all([
    import('@fontsource/inter/latin-400.css'), import('@fontsource/inter/latin-400-italic.css'),
    import('@fontsource/inter/latin-700.css'), import('@fontsource/inter/latin-700-italic.css'),
  ]) },
  { family: 'Source Sans 3', load: () => Promise.all([
    import('@fontsource/source-sans-3/latin-400.css'), import('@fontsource/source-sans-3/latin-400-italic.css'),
    import('@fontsource/source-sans-3/latin-700.css'), import('@fontsource/source-sans-3/latin-700-italic.css'),
  ]) },
  { family: 'Atkinson Hyperlegible Next', load: () => Promise.all([
    import('@fontsource/atkinson-hyperlegible-next/latin-400.css'), import('@fontsource/atkinson-hyperlegible-next/latin-400-italic.css'),
    import('@fontsource/atkinson-hyperlegible-next/latin-700.css'), import('@fontsource/atkinson-hyperlegible-next/latin-700-italic.css'),
  ]) },
  { family: 'Merriweather', load: () => Promise.all([
    import('@fontsource/merriweather/latin-400.css'), import('@fontsource/merriweather/latin-400-italic.css'),
    import('@fontsource/merriweather/latin-700.css'), import('@fontsource/merriweather/latin-700-italic.css'),
  ]) },
  { family: 'Source Serif 4', load: () => Promise.all([
    import('@fontsource/source-serif-4/latin-400.css'), import('@fontsource/source-serif-4/latin-400-italic.css'),
    import('@fontsource/source-serif-4/latin-700.css'), import('@fontsource/source-serif-4/latin-700-italic.css'),
  ]) },
  { family: 'Crimson Pro', load: () => Promise.all([
    import('@fontsource/crimson-pro/latin-400.css'), import('@fontsource/crimson-pro/latin-400-italic.css'),
    import('@fontsource/crimson-pro/latin-700.css'), import('@fontsource/crimson-pro/latin-700-italic.css'),
  ]) },
  { family: 'Lora', load: () => Promise.all([
    import('@fontsource/lora/latin-400.css'), import('@fontsource/lora/latin-400-italic.css'),
    import('@fontsource/lora/latin-700.css'), import('@fontsource/lora/latin-700-italic.css'),
  ]) },
  { family: 'Literata', load: () => Promise.all([
    import('@fontsource/literata/latin-400.css'), import('@fontsource/literata/latin-400-italic.css'),
    import('@fontsource/literata/latin-700.css'), import('@fontsource/literata/latin-700-italic.css'),
  ]) },
];

const loadedFonts = new Map<string, Promise<unknown>>();

function load(loader: { family: string; load: FontLoader }): Promise<unknown> {
  const existing = loadedFonts.get(loader.family);
  if (existing) return existing;
  const pending = loader.load();
  loadedFonts.set(loader.family, pending);
  return pending;
}

export function loadFontFamily(fontFamily: string): Promise<unknown> {
  const loader = fontLoaders.find(option => fontFamily.includes(option.family));
  return loader ? load(loader) : Promise.resolve();
}

export function preloadAllFonts(): Promise<unknown[]> {
  return Promise.all(fontLoaders.map(load));
}
