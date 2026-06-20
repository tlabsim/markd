import React from 'react';
import markdLogo from '../assets/markd.svg';

interface WelcomeScreenProps {
  onOpen: () => void;
  onOpenFolder: () => void;
  onNew: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpen, onOpenFolder, onNew }) => {
  return (
    <div className="flex-1 flex items-center justify-center select-none transition-colors" style={{ backgroundColor: 'var(--pal-viewer-bg)' }}>
      <div className="text-center max-w-md px-8">
        {/* Logo */}
        <div className="mb-6">
          <img src={markdLogo} alt="Markd" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-1 tracking-tight transition-colors" style={{ fontFamily: 'Consolas, system-ui, sans-serif', color: 'var(--pal-text)' }}>
            Markd
          </h1>
          <p className="text-sm transition-colors" style={{ color: 'var(--pal-muted)' }}>
            Markdown Viewer &amp; Editor
          </p>
        </div>

        {/* Quick action cards — VS Code style */}
        <div className="space-y-1">
          <button
            onClick={onNew}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left group"
            style={{ color: 'var(--pal-text)' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--pal-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="flex-1">New File</span>
            <span className="text-[11px]" style={{ color: 'var(--pal-muted)' }}>Ctrl+N</span>
          </button>

          <button
            onClick={onOpen}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left group"
            style={{ color: 'var(--pal-text)' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--pal-muted)' }} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M12 16.5v-9M8.5 11L12 7.5l3.5 3.5"/><path d="M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z"/></g></svg>
            <span className="flex-1">Open File...</span>
            <span className="text-[11px]" style={{ color: 'var(--pal-muted)' }}>Ctrl+O</span>
          </button>

          <button
            onClick={onOpenFolder}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left group"
            style={{ color: 'var(--pal-text)' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--pal-muted)' }} viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.661 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7m8.661 0a2 2 0 0 1-1.322-.5l-2.272-2A2 2 0 0 0 6.745 4H5a2 2 0 0 0-2 2v1m8.661 0H3"/></svg>
            <span className="flex-1">Open Folder...</span>
            <span className="text-[11px]" style={{ color: 'var(--pal-muted)' }}>Ctrl+Shift+O</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-10 text-[11px] transition-colors" style={{ color: 'var(--pal-muted)' }}>
          <p>Open a folder to browse and edit markdown files</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
