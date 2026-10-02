import React, { useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import type { ViewMode } from '../types';

const StatusBar: React.FC<{ matchPalette?: boolean; paletteBg?: string; paletteBgDark?: string; onViewModeChange: (mode: ViewMode) => void }> = ({ matchPalette, paletteBg, paletteBgDark, onViewModeChange }) => {
  const { fileContent, currentFile, viewMode } = useStore(useShallow((state) => ({
    fileContent: state.fileContent,
    currentFile: state.currentFile,
    viewMode: state.viewMode,
  })));

  const stats = useMemo(() => {
    if (!fileContent) return { lines: 0, words: 0, chars: 0 };
    const lines = fileContent.split('\n').length;
    const words = fileContent.trim() ? fileContent.trim().split(/\s+/).length : 0;
    const chars = fileContent.length;
    return { lines, words, chars };
  }, [fileContent]);

  const encoding = 'UTF-8';
  const fileType = currentFile?.endsWith('.md') ? 'Markdown' : currentFile?.endsWith('.markdown') ? 'Markdown' : 'Text';

  return (
    <div
      className={`flex items-center justify-between px-3 py-0.5 text-[11px] text-gray-500 dark:text-gray-400 ${
        matchPalette
          ? 'border-t border-gray-300/40 dark:border-gray-600/40'
          : 'border-t border-gray-200 dark:border-gray-700/50'
      } bg-gray-100 dark:bg-[#202329]`}
      style={{
        paddingBottom: 6,
        paddingTop: 4,
        ...(matchPalette ? {
          backgroundColor: 'var(--pal-panel-bg)',
          borderColor: 'var(--pal-border)',
        } : {}),
      }}
    >
      <div className="flex items-center gap-3">
        <span>{fileType}</span>
        <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
        <span>{encoding}</span>
        <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
        <span>Ln {stats.lines}</span>
        <span>Words {stats.words}</span>
        <span>Chars {stats.chars}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-5 items-stretch text-[10px] leading-none rounded-md overflow-hidden border border-gray-300/50 dark:border-gray-600/50 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('markd:open-shortcuts'))}
          title="Keyboard Shortcuts (Ctrl+/)"
        >
          <span className="inline-flex items-center px-2 text-gray-500 dark:text-gray-400 bg-gray-200/50 dark:bg-gray-700/30">KB Shortcuts</span>
          <span className="inline-flex items-center px-1.5 text-gray-400 dark:text-gray-500 bg-white/80 dark:bg-gray-800/30 border-l border-gray-300/50 dark:border-gray-600/50">Ctrl+/</span>
        </button>
        <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
        <div className="inline-flex items-center text-[10px] rounded-md overflow-hidden border border-slate-300 dark:border-gray-600">
          <button
            className={`px-2 py-0.5 font-medium transition-colors border-r border-slate-300 dark:border-gray-600 ${
              viewMode === 'view'
                ? 'bg-gray-700/10 dark:bg-white/10'
                : 'hover:bg-gray-700/10 dark:hover:bg-white/5'
            }`}
            style={{
              color: viewMode === 'view'
                ? (matchPalette ? 'var(--pal-text)' : undefined)
                : (matchPalette ? 'var(--pal-muted)' : undefined),
            }}
            onClick={() => onViewModeChange('view')}
            title="Preview mode"
          >
            Preview
          </button>
          <button
            className={`px-2 py-0.5 font-medium transition-colors border-r border-slate-300 dark:border-gray-600 ${
              viewMode === 'edit'
                ? 'bg-gray-700/10 dark:bg-white/10'
                : 'hover:bg-gray-700/10 dark:hover:bg-white/5'
            }`}
            style={{
              color: viewMode === 'edit'
                ? (matchPalette ? 'var(--pal-text)' : undefined)
                : (matchPalette ? 'var(--pal-muted)' : undefined),
            }}
            onClick={() => onViewModeChange('edit')}
            title="Edit mode"
          >
            Edit
          </button>
          <button
            className={`px-2 py-0.5 font-medium transition-colors ${
              viewMode === 'split'
                ? 'bg-gray-700/10 dark:bg-white/10'
                : 'hover:bg-gray-700/10 dark:hover:bg-white/5'
            }`}
            style={{
              color: viewMode === 'split'
                ? (matchPalette ? 'var(--pal-text)' : undefined)
                : (matchPalette ? 'var(--pal-muted)' : undefined),
            }}
            onClick={() => onViewModeChange('split')}
            title="Split mode"
          >
            Split
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
