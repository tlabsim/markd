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
    <div className="flex items-center justify-between px-3 py-0.5 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1c2733] border-t border-gray-200 dark:border-gray-700/50" style={{ paddingBottom: 4, paddingTop: 2 }}>
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
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            viewMode === 'view'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          onClick={() => setViewMode('view')}
        >
          Preview
        </button>
        <button
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            viewMode === 'edit'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          onClick={() => setViewMode('edit')}
        >
          Edit
        </button>
        <button
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            viewMode === 'split'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          onClick={() => setViewMode('split')}
        >
          Split
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
