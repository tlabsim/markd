import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import markdLogo from '../assets/markd.svg';

interface TitleBarProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  isMaximized: boolean;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onNewFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onOpenRecentFile?: (filePath: string) => void;
  recentFiles?: string[];
  distractionFree?: boolean;
  onToggleDistractionFree?: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ onMinimize, onMaximize, onClose, isMaximized, onOpenFile, onOpenFolder, onNewFile, onSaveFile, onSaveFileAs, onOpenRecentFile, recentFiles, distractionFree, onToggleDistractionFree }) => {
  const { currentFile, isModified, theme, setTheme, toggleSidebar } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title = currentFile
    ? `${isModified ? '● ' : ''}${currentFile} — Markd`
    : 'Markd';

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const menuItem = (label: string, shortcut: string | null, action: () => void) => (
    <button
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-blue-600 hover:text-white rounded-sm transition-colors"
      onClick={() => { action(); closeMenu(); }}
    >
      <span>{label}</span>
      {shortcut && <span className="ml-8 text-gray-500 hover:text-gray-300 text-[10px]">{shortcut}</span>}
    </button>
  );

  return (
    <div className={`titlebar flex items-center justify-between px-3 border-b transition-colors duration-300 select-none
      ${distractionFree
        ? 'absolute top-0 left-0 right-0 z-50 bg-white/85 dark:bg-[#1a222b]/85 backdrop-blur-xl border-transparent'
        : 'bg-white dark:bg-[#222c36] border-gray-200 dark:border-gray-700/50'
      }`}
      style={{ height: 40 }}
    >
      {/* Left: Brand + Menu */}
      <div className="flex items-center gap-2 relative" ref={menuRef}>
        <button
          className="titlebar-button w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          title="Menu"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="text-[14px] font-semibold tracking-tight text-gray-700 dark:text-gray-200 flex items-center gap-1.5" style={{ fontFamily: 'Consolas, system-ui, sans-serif' }}>
          <img src={markdLogo} alt="Markd" className="w-[16px] h-[16px] shrink-0 mr-1" />
          Markd
        </span>

        {/* Context Menu */}
        {menuOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-[#222c36] border border-gray-200 dark:border-gray-600 rounded-md shadow-2xl z-50 py-1">
            <div className="px-2 pb-1 mb-1 border-b border-gray-200 dark:border-gray-600">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</span>
            </div>
            {menuItem('New File', 'Ctrl+N', onNewFile)}
            {menuItem('Open File...', 'Ctrl+O', onOpenFile)}
            {menuItem('Open Folder...', 'Ctrl+Shift+O', onOpenFolder)}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            {menuItem('Save', 'Ctrl+S', onSaveFile)}
            {menuItem('Save As...', 'Ctrl+Shift+S', onSaveFileAs)}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            <div className="px-2 pb-1 mb-1 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent</span>
            </div>
            {recentFiles && recentFiles.length > 0 ? (
              recentFiles.slice(0, 8).map((filePath) => {
                const name = filePath.split(/[/\\]/).pop() || filePath;
                const dir = filePath.split(/[/\\]/).slice(0, -1).join('\\') || filePath;
                return (
                  <button
                    key={filePath}
                    className="w-full flex flex-col items-start px-3 py-1 text-xs text-left hover:bg-blue-600 hover:text-white rounded-sm transition-colors"
                    onClick={() => { onOpenRecentFile?.(filePath); closeMenu(); }}
                    title={filePath}
                  >
                    <span className="truncate w-full">{name}</span>
                    <span className="text-[10px] text-gray-400 truncate w-full">{dir}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-1 text-[11px] text-gray-400 dark:text-gray-600 italic">No recent files</p>
            )}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            <div className="px-2 pb-1 mb-1 border-b border-gray-200 dark:border-gray-600">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">View</span>
            </div>
            {!distractionFree && menuItem('Toggle Sidebar', 'Ctrl+B', () => toggleSidebar())}
            {menuItem(
              theme === 'dark' ? 'Light Theme' : 'Dark Theme',
              'Ctrl+Shift+D',
              () => setTheme(theme === 'dark' ? 'light' : 'dark')
            )}
            {onToggleDistractionFree && !isMaximized && menuItem(
              distractionFree ? 'Exit Distraction-Free' : 'Distraction-Free Mode',
              'Ctrl+Shift+F',
              onToggleDistractionFree
            )}
          </div>
        )}
      </div>

      {/* Center: File title */}
      <div className="flex-1 text-center">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md inline-block">
          {title}
        </span>
      </div>

      {/* Right: Window controls */}
      <div className="flex items-center gap-1">
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme (Ctrl+Shift+D)"
        >
          {theme === 'dark' ? (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0a3.75 3.75 0 0 1 7.5 0"/></svg>
          ) : (
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M19.9 2.307a.483.483 0 0 0-.9 0l-.43 1.095a.48.48 0 0 1-.272.274l-1.091.432a.486.486 0 0 0 0 .903l1.091.432a.48.48 0 0 1 .272.273L19 6.81c.162.41.74.41.9 0l.43-1.095a.48.48 0 0 1 .273-.273l1.091-.432a.486.486 0 0 0 0-.903l-1.091-.432a.48.48 0 0 1-.273-.274zM16.033 8.13a.483.483 0 0 0-.9 0l-.157.399a.48.48 0 0 1-.272.273l-.398.158a.486.486 0 0 0 0 .903l.398.157c.125.05.223.148.272.274l.157.399c.161.41.739.41.9 0l.157-.4a.48.48 0 0 1 .272-.273l.398-.157a.486.486 0 0 0 0-.903l-.398-.158a.48.48 0 0 1-.272-.273z"/><path d="M12 22c5.523 0 10-4.477 10-10c0-.463-.694-.54-.933-.143a6.5 6.5 0 1 1-8.924-8.924C12.54 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10"/></svg>
          )}
        </button>

        {onToggleDistractionFree && !isMaximized && (
          <>
            <button
              className={`titlebar-button w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-gray-100 dark:hover:bg-white/10 ${
                distractionFree
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              onClick={onToggleDistractionFree}
              title={distractionFree ? 'Exit Distraction-Free (Ctrl+Shift+F)' : 'Distraction-Free Mode (Ctrl+Shift+F)'}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={0.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20v-4.423h1V19h3.423v1zm11.596 0v-1h3.423v-3.423h1V20zM4 8.423V4h4.423v1H5v3.423zm15.02 0V5h-3.424V4h4.423v4.423z"/></svg>
            </button>
          </>
        )}

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={onMinimize}
          title="Minimize"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M5 19h14" />
          </svg>
        </button>
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={onMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <svg className={`w-[18px] h-[18px] transition-transform ${isMaximized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 3h-6m6 0l-9 9m9-9v6" />
            <path strokeLinecap="round" d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
          </svg>
        </button>
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/80 text-gray-500 dark:text-gray-400 hover:text-white transition-colors ml-0.5"
          onClick={onClose}
          title="Close"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
