import React, { useEffect, useRef, useState } from 'react';
import { FONT_OPTIONS } from '../store';
import { PALETTE_OPTIONS } from '../palettes';

interface SelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseOther: () => void;
  matchToolbarPalette: boolean;
  menuRef: React.RefObject<HTMLDivElement>;
}

function useSelectorPanel(open: boolean) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const positionPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPanelStyle({ top: rect.bottom + 4, left: rect.left });
  };

  const onAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !open) setMounted(false);
  };

  return { buttonRef, mounted, panelStyle, positionPanel, onAnimationEnd };
}

export const FontSelector: React.FC<SelectorProps & {
  fontFamily: string;
  onFontChange: (font: string) => void;
}> = ({ open, onOpenChange, onCloseOther, matchToolbarPalette, menuRef, fontFamily, onFontChange }) => {
  const { buttonRef, mounted, panelStyle, positionPanel, onAnimationEnd } = useSelectorPanel(open);
  const currentLabel = FONT_OPTIONS.find(option => option.value === fontFamily)?.label || 'System Default';

  const toggle = () => {
    if (!open) {
      positionPanel();
      onCloseOther();
    }
    onOpenChange(!open);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button ref={buttonRef} className="btn-icon text-xs gap-2 flex items-center" onClick={toggle} title="Change font family" aria-expanded={open}>
        <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16.5 16">
          <path d="M6.71 10H2.332l-.874 2.498a.75.75 0 0 1-1.415-.496l3.39-9.688a1.217 1.217 0 0 1 2.302.018l3.227 9.681a.75.75 0 0 1-1.423.474Zm3.13-4.358C10.53 4.374 11.87 4 13 4c1.5 0 3 .939 3 2.601v5.649a.75.75 0 0 1-1.448.275C13.995 12.82 13.3 13 12.5 13c-.77 0-1.514-.231-2.078-.709c-.577-.488-.922-1.199-.922-2.041c0-.694.265-1.411.887-1.944C11 7.78 11.88 7.5 13 7.5h1.5v-.899c0-.54-.5-1.101-1.5-1.101c-.869 0-1.528.282-1.84.858a.75.75 0 1 1-1.32-.716M6.21 8.5L4.574 3.594L2.857 8.5Zm8.29.5H13c-.881 0-1.375.22-1.637.444c-.253.217-.363.5-.363.806c0 .408.155.697.39.896c.249.21.63.354 1.11.354c.732 0 1.26-.209 1.588-.449c.35-.257.412-.495.412-.551Z" />
        </svg>
        <span className="text-[12px] font-medium">Font</span>
      </button>
      {mounted && (
        <div
          className={`toolbar-selector-menu w-52 bg-white/85 dark:bg-[#222c36]/85 backdrop-blur-md border border-gray-200/40 dark:border-gray-700/40 rounded-md shadow-2xl max-h-72 overflow-y-auto ${open ? 'toolbar-selector-menu--enter' : 'toolbar-selector-menu--exit'}`}
          style={{ position: 'fixed', zIndex: 9999, ...panelStyle, ...(matchToolbarPalette ? { backgroundColor: 'color-mix(in srgb, var(--pal-panel-bg) 85%, transparent)', borderColor: 'var(--pal-border-soft)' } : {}) }}
          aria-hidden={!open}
          onAnimationEnd={onAnimationEnd}
        >
          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{currentLabel}</div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          {FONT_OPTIONS.map((option) => {
            const selected = fontFamily === option.value;
            return (
              <button
                key={option.value}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${selected ? 'text-blue-500 bg-blue-500/10' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                onClick={() => { onFontChange(option.value); onOpenChange(false); }}
                style={{ fontFamily: option.value === 'system' ? undefined : option.value }}
              >
                <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">
                  {selected ? (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="m9.55 15.15l8.475-8.475q.3-.3.7-.3t.7.3t.3.713t-.3.712l-9.175 9.2q-.3.3-.7.3t-.7-.3L4.55 13q-.3-.3-.288-.712t.313-.713t.713-.3t.712.3z"/></svg>
                  ) : (
                    <svg className="w-[14px] h-[14px] text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 15 15"><path d="M12.499 2a.5.5 0 0 1 .001 1H8.692l-.287.854c-.216.643-.51 1.518-.824 2.444L7.344 7H8.5a.5.5 0 0 1 0 1H7.004c-.437 1.285-.84 2.462-1.046 3.04c-.322.899-.751 1.446-1.291 1.738c-.504.273-1.025.272-1.383.272H3.25a.55.55 0 1 1 0-1.1c.392 0 .653-.01.894-.14c.22-.119.511-.396.778-1.142c.185-.517.531-1.527.92-2.668H4.5a.5.5 0 0 1 0-1h1.682l.357-1.055c.313-.925.607-1.799.823-2.441L7.532 3H5c-.849 0-1.5.651-1.5 1.5a.5.5 0 0 1-1 0C2.5 3.099 3.599 2 5 2z"/></svg>
                  )}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PaletteSelector: React.FC<SelectorProps & {
  previewPalette: string;
  onPaletteChange: (palette: string) => void;
}> = ({ open, onOpenChange, onCloseOther, matchToolbarPalette, menuRef, previewPalette, onPaletteChange }) => {
  const { buttonRef, mounted, panelStyle, positionPanel, onAnimationEnd } = useSelectorPanel(open);
  const currentLabel = PALETTE_OPTIONS.find(option => option.value === previewPalette)?.label || 'Default';

  const toggle = () => {
    if (!open) {
      positionPanel();
      onCloseOther();
    }
    onOpenChange(!open);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button ref={buttonRef} className="btn-icon text-xs gap-1.5 flex items-center" onClick={toggle} title="Change preview color palette" aria-expanded={open}>
        <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 17 16">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8"/>
          <path d="M8 1a7 7 0 0 0 0 14V1z" opacity=".3"/>
        </svg>
        <span className="text-[12px] font-medium">Palette</span>
      </button>
      {mounted && (
        <div
          className={`toolbar-selector-menu w-44 bg-white/85 dark:bg-[#222c36]/85 backdrop-blur-md border border-gray-200/40 dark:border-gray-700/40 rounded-md shadow-2xl overflow-y-auto ${open ? 'toolbar-selector-menu--enter' : 'toolbar-selector-menu--exit'}`}
          style={{ position: 'fixed', zIndex: 9999, ...panelStyle, ...(matchToolbarPalette ? { backgroundColor: 'color-mix(in srgb, var(--pal-panel-bg) 85%, transparent)', borderColor: 'var(--pal-border-soft)' } : {}) }}
          aria-hidden={!open}
          onAnimationEnd={onAnimationEnd}
        >
          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{currentLabel}</div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          {PALETTE_OPTIONS.map((option) => {
            const selected = previewPalette === option.value;
            return (
              <button
                key={option.value}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${selected ? 'text-blue-500 bg-blue-500/10' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                onClick={() => { onPaletteChange(option.value); onOpenChange(false); }}
              >
                <span className="flex gap-0.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full inline dark:hidden ring-1 ring-black/10" style={{ backgroundColor: option.swatches[0] }} />
                  <span className="w-2.5 h-2.5 rounded-full inline dark:hidden" style={{ backgroundColor: option.swatches[1] }} />
                  <span className="w-2.5 h-2.5 rounded-full inline dark:hidden" style={{ backgroundColor: option.swatches[2] }} />
                  <span className="w-2.5 h-2.5 rounded-full hidden dark:inline ring-1 ring-white/10" style={{ backgroundColor: option.swatchesDark[0] }} />
                  <span className="w-2.5 h-2.5 rounded-full hidden dark:inline" style={{ backgroundColor: option.swatchesDark[1] }} />
                  <span className="w-2.5 h-2.5 rounded-full hidden dark:inline" style={{ backgroundColor: option.swatchesDark[2] }} />
                </span>
                <span className="flex-1">{option.label}</span>
                {selected && <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="m9.55 15.15l8.475-8.475q.3-.3.7-.3t.7.3t.3.713t-.3.712l-9.175 9.2q-.3.3-.7.3t-.7-.3L4.55 13q-.3-.3-.288-.712t.313-.713t.713-.3t.712.3z"/></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
