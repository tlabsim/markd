import React, { useEffect, useMemo, useState } from 'react';

interface SvgBackgroundImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string;
  alt: string;
}

function hasTextWithoutBackground(src: string): boolean {
  const comma = src.indexOf(',');
  if (comma < 0 || !/^data:image\/svg\+xml(?:;[^,]*)?$/i.test(src.slice(0, comma))) return false;

  try {
    const payload = src.slice(comma + 1);
    const markup = /;base64/i.test(src.slice(0, comma))
      ? new TextDecoder().decode(Uint8Array.from(atob(payload), (char) => char.charCodeAt(0)))
      : decodeURIComponent(payload);
    const svg = new DOMParser().parseFromString(markup, 'image/svg+xml');
    if (svg.querySelector('parsererror') || svg.documentElement.localName !== 'svg') return false;

    const hasText = Array.from(svg.querySelectorAll('text, tspan')).some((node) => node.textContent?.trim()) ||
      Array.from(svg.querySelectorAll('foreignObject *')).some((element) =>
        element.localName !== 'style' && element.localName !== 'script' &&
        Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      );
    if (!hasText) return false;

    const root = svg.documentElement;
    if (/(?:^|;)\s*background(?:-color)?\s*:\s*(?!none\b|transparent\b)[^;]+/i.test(root.getAttribute('style') || '')) return false;

    const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    const width = viewBox?.length === 4 ? viewBox[2] : Number.parseFloat(root.getAttribute('width') || '');
    const height = viewBox?.length === 4 ? viewBox[3] : Number.parseFloat(root.getAttribute('height') || '');
    const fillsCanvas = (value: string | null, size: number) => value === '100%' || (Number.isFinite(size) && Number(value) >= size);
    const hasFullBackground = Array.from(root.children).some((element) => {
      if (element.localName !== 'rect') return false;
      if (Number(element.getAttribute('x') || 0) > 0 || Number(element.getAttribute('y') || 0) > 0) return false;
      if (!fillsCanvas(element.getAttribute('width'), width) || !fillsCanvas(element.getAttribute('height'), height)) return false;
      const fill = element.getAttribute('fill') || element.getAttribute('style')?.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)?.[1];
      return fill !== 'none' && fill !== 'transparent' && element.getAttribute('fill-opacity') !== '0' && element.getAttribute('opacity') !== '0';
    });
    return !hasFullBackground;
  } catch {
    return false;
  }
}

const SvgBackgroundImage: React.FC<SvgBackgroundImageProps> = ({ src, alt, className, loading, onError, style, ...imageProps }) => {
  const eligible = useMemo(() => hasTextWithoutBackground(src), [src]);
  const [whiteBackground, setWhiteBackground] = useState(false);

  useEffect(() => {
    setWhiteBackground(false);
  }, [src]);

  const buttonLabel = whiteBackground ? 'Remove white SVG background' : 'Show white SVG background';

  return (
    <span className="relative inline-block max-w-full align-middle group/svg">
      <img
        {...imageProps}
        src={src}
        alt={alt}
        loading={loading || 'lazy'}
        className={`${className || ''} block !my-0`}
        style={whiteBackground ? { ...style, backgroundColor: '#fff' } : style}
        onError={onError}
      />
      {eligible && (
        <button
          type="button"
          title={buttonLabel}
          aria-label={buttonLabel}
          aria-pressed={whiteBackground}
          onClick={() => setWhiteBackground((current) => !current)}
          className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md border border-white/30 bg-slate-800/85 shadow-sm opacity-0 pointer-events-none transition-opacity group-hover/svg:opacity-100 group-hover/svg:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <span className="h-3 w-3 rounded-[2px] border border-white/80" style={{ background: 'linear-gradient(90deg, #1e293b 50%, #fff 50%)' }} />
        </button>
      )}
    </span>
  );
};

export default SvgBackgroundImage;
