import React, { useMemo } from 'react';
import { useStore } from '../store';

const StatusBar: React.FC = () => {
  const { fileContent, currentFile, viewMode, setViewMode } = useStore();

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
    <div className="flex items-center justify-between px-3 py-0.5 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1c2733] border-t border-gray-200 dark:border-gray-700/50" style={{ paddingBottom: 6, paddingTop: 4 }}>
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
          className="inline-flex items-center text-[10px] rounded-md overflow-hidden border border-gray-300/50 dark:border-gray-600/50 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('markd:open-shortcuts'))}
          title="Keyboard Shortcuts (Ctrl+/)"
        >
          <span className="px-2 py-0.5 text-gray-500 dark:text-gray-400 bg-gray-200/50 dark:bg-gray-700/30">KB Shortcuts</span>
          <span className="px-1.5 py-0.5 text-gray-400 dark:text-gray-500 bg-white dark:bg-[#1c2733] border-l border-gray-300/50 dark:border-gray-600/50">Ctrl+/</span>
        </button>
        <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
        <div className="inline-flex items-center text-[10px] rounded-md overflow-hidden border border-gray-300/50 dark:border-gray-600/50">
          <button
            className={`px-2 py-0.5 transition-colors border-r border-gray-300/50 dark:border-gray-600/50 ${
              viewMode === 'view'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/30'
            }`}
            onClick={() => setViewMode('view')}
          >
            Preview
          </button>
          <button
            className={`px-2 py-0.5 transition-colors border-r border-gray-300/50 dark:border-gray-600/50 ${
              viewMode === 'edit'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/30'
            }`}
            onClick={() => setViewMode('edit')}
          >
            Edit
          </button>
          <button
            className={`px-2 py-0.5 transition-colors ${
              viewMode === 'split'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/30'
            }`}
            onClick={() => setViewMode('split')}
          >
            Split
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
