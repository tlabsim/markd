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
  onCloseFile?: () => void;
  onOpenRecentFile?: (filePath: string) => void;
  recentFiles?: string[];
  paletteBg?: string;
  paletteBgDark?: string;
  distractionFree?: boolean;
  onToggleDistractionFree?: () => void;
  onEditDocument?: () => void;
  onSettings?: () => void;
  saveState?: 'idle' | 'saving' | 'saved';
  matchToolbarPalette?: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({ onMinimize, onMaximize, onClose, isMaximized, onOpenFile, onOpenFolder, onNewFile, onSaveFile, onSaveFileAs, onCloseFile, onOpenRecentFile, recentFiles, paletteBg, paletteBgDark, distractionFree, onToggleDistractionFree, onEditDocument, onSettings, saveState, matchToolbarPalette }) => {
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
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left !text-black dark:!text-gray-100 hover:bg-blue-600 hover:!text-white rounded-sm transition-colors group"
      onClick={() => { action(); closeMenu(); }}
    >
      <span>{label}</span>
      {shortcut && <span className="ml-8 text-gray-500 dark:text-gray-500 group-hover:!text-white/70 text-[10px]">{shortcut}</span>}
    </button>
  );

  return (
    <div className={`titlebar flex items-center justify-between px-3 transition-colors duration-300 select-none relative
      ${distractionFree
        ? 'absolute top-0 left-0 right-0 z-50'
        : `z-20 bg-white dark:bg-[#222c36] border-b ${matchToolbarPalette ? 'border-gray-300/40 dark:border-gray-600/40' : 'border-gray-200 dark:border-gray-700/50'}`
      }`}
      style={{
        height: 40,
        ...(distractionFree ? {
          backgroundColor: 'var(--pal-viewer-bg)',
        } : matchToolbarPalette ? {
          backgroundColor: 'var(--pal-panel-bg)',
          borderColor: 'var(--pal-border)',
        } : {}),
      }}
    >
      {/* Left: Brand + Menu */}
      <div className="flex items-center gap-2 relative z-10" ref={menuRef}>
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
          <div
            className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-[#28323e] border border-gray-200 dark:border-gray-600 rounded-md shadow-2xl z-[60] py-1"
            style={{
              ...(matchToolbarPalette ? { backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)' } : {}),
              filter: 'brightness(1.04) saturate(1.08)',
            }}
          >
            <div className="px-2 pb-1 mb-1 border-b border-gray-200 dark:border-gray-600">
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">File</span>
            </div>
            {menuItem('New File', 'Ctrl+N', onNewFile)}
            {menuItem('Open File...', 'Ctrl+O', onOpenFile)}
            {menuItem('Open Folder...', 'Ctrl+Shift+O', onOpenFolder)}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            {distractionFree ? (
              onEditDocument && menuItem('Edit Document', null, onEditDocument)
            ) : (
              <>
                {menuItem('Save', 'Ctrl+S', onSaveFile)}
                {menuItem('Save As...', 'Ctrl+Shift+S', onSaveFileAs)}
              </>
            )}
            {currentFile && onCloseFile && menuItem('Close File', 'Ctrl+W', onCloseFile)}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            {/* Recent Files — CSS-driven submenu */}
            <div className="relative group">
              <button
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left group-hover:bg-blue-600 group-hover:text-white rounded-sm transition-colors"
              >
                <span>Recent Files</span>
                <svg className="w-3 h-3 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 5l7 7-7 7" />
                </svg>
              </button>
              {/* Submenu flyout — CSS hover, no gap */}
              <div
                className="absolute left-full top-0 w-52 bg-white dark:bg-[#28323e] border border-gray-200 dark:border-gray-600 rounded-md shadow-2xl py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-75 -translate-y-2"
                style={matchToolbarPalette ? { backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)' } : undefined}
              >
                {recentFiles && recentFiles.length > 0 ? (
                  recentFiles.slice(0, 10).map((filePath) => {
                      const name = filePath.split(/[/\\]/).pop() || filePath;
                      const dir = filePath.split(/[/\\]/).slice(0, -1).join('\\') || filePath;
                      return (
                        <button
                          key={filePath}
                          className="w-full flex flex-col items-start px-3 py-1 text-xs text-left hover:bg-blue-600 rounded-sm transition-colors group/file"
                          onClick={() => { onOpenRecentFile?.(filePath); closeMenu(); }}
                          title={filePath}
                        >
                          <span className="truncate w-full group-hover/file:!text-white" style={matchToolbarPalette ? { color: 'var(--pal-text)' } : undefined}>{name}</span>
                          <span className="text-[10px] truncate w-full group-hover/file:!text-white/70" style={{ color: matchToolbarPalette ? 'var(--pal-muted)' : undefined }}>{dir}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-1 text-[11px] text-gray-400 dark:text-gray-600 italic">No recent files</p>
                  )}
                </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            <div className="px-2 pb-1 mb-1 border-b border-gray-200 dark:border-gray-600">
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">View</span>
            </div>
            {!distractionFree && menuItem('Toggle Sidebar', 'Ctrl+B', () => toggleSidebar())}
            {menuItem(
              theme === 'dark' ? 'Light Theme' : 'Dark Theme',
              'Ctrl+Shift+D',
              () => setTheme(theme === 'dark' ? 'light' : 'dark')
            )}
            {onToggleDistractionFree && !isMaximized && currentFile && menuItem(
              distractionFree ? 'Exit Distraction-Free' : 'Distraction-Free Mode',
              'Ctrl+Shift+F',
              onToggleDistractionFree
            )}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            {onSettings && menuItem('Settings…', 'Ctrl+,', onSettings)}
          </div>
        )}
      </div>

      {/* Center: File title + save state — absolutely centered */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
        {saveState === 'saving' && (
          <span className="text-[12px] px-2 py-0.5 rounded bg-slate-700/10 dark:bg-white/10 text-slate-500 dark:text-gray-300 pointer-events-auto">Saving…</span>
        )}
        {saveState === 'saved' && (
          <span className="text-[12px] flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/90 dark:bg-emerald-500/90 text-white pointer-events-auto">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[37vw] inline-block">
          {title}
        </span>
      </div>

      {/* Right: Window controls */}
      <div className="flex items-center gap-1 z-10">
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme (Ctrl+Shift+D)"
        >
          {theme === 'dark' ? (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0a3.75 3.75 0 0 1 7.5 0"/></svg>
          ) : (
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M19.9 2.307a.483.483 0 0 0-.9 0l-.43 1.095a.48.48 0 0 1-.272.274l-1.091.432a.486.486 0 0 0 0 .903l1.091.432a.48.48 0 0 1 .272.273L19 6.81c.162.41.74.41.9 0l.43-1.095a.48.48 0 0 1 .273-.273l1.091-.432a.486.486 0 0 0 0-.903l-1.091-.432a.48.48 0 0 1-.273-.274zM16.033 8.13a.483.483 0 0 0-.9 0l-.157.399a.48.48 0 0 1-.272.273l-.398.158a.486.486 0 0 0 0 .903l.398.157c.125.05.223.148.272.274l.157.399c.161.41.739.41.9 0l.157-.4a.48.48 0 0 1 .272-.273l.398-.157a.486.486 0 0 0 0-.903l-.398-.158a.48.48 0 0 1-.272-.273z"/><path d="M12 22c5.523 0 10-4.477 10-10c0-.463-.694-.54-.933-.143a6.5 6.5 0 1 1-8.924-8.924C12.54 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10"/></svg>
          )}
        </button>

        {onToggleDistractionFree && !isMaximized && currentFile && (
          <>
            <button
              className={`titlebar-button w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-gray-700/10 dark:hover:bg-white/10 ${
                distractionFree
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              onClick={onToggleDistractionFree}
              title={distractionFree ? 'Exit Distraction-Free (Ctrl+Shift+F)' : 'Distraction-Free Mode (Ctrl+Shift+F)'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 28 28"><path fill="currentColor" d="M3 6a3 3 0 0 1 3-3h3.5a1 1 0 1 1 0 2H6a1 1 0 0 0-1 1v3.5a1 1 0 1 1-2 0zm14.5-2a1 1 0 0 1 1-1H22a3 3 0 0 1 3 3v3.5a1 1 0 1 1-2 0V6a1 1 0 0 0-1-1h-3.5a1 1 0 0 1-1-1M4 17.5a1 1 0 0 1 1 1V22a1 1 0 0 0 1 1h3.5a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3v-3.5a1 1 0 0 1 1-1m20 0a1 1 0 0 1 1 1V22a3 3 0 0 1-3 3h-3.5a1 1 0 1 1 0-2H22a1 1 0 0 0 1-1v-3.5a1 1 0 0 1 1-1"/></svg>
            </button>
          </>
        )}

        {distractionFree && onEditDocument && !isMaximized && (
          <button
            className="titlebar-button w-auto px-3 h-[18px] flex items-center justify-center rounded text-[12px] font-semibold bg-slate-700/10 hover:bg-blue-700 hover:text-white dark:bg-white/10  dark:hover:bg-blue-400 text-slate-500 dark:text-gray-300 dark:hover:text-white transition-colors duration-150"
            onClick={onEditDocument}
            title="Edit document — exit distraction-free and open in split view"
          >
            Edit
          </button>
        )}

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={onMinimize}
          title="Minimize"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M5 19h14" />
          </svg>
        </button>
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={onMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {/* <svg className={`w-[18px] h-[18px] transition-transform ${isMaximized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 3h-6m6 0l-9 9m9-9v6" />
            <path strokeLinecap="round" d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
          </svg> */}
          {isMaximized ? (
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
                <path d="M3 17a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm1-5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
                <path d="M15 13h-4V9m0 4l5-5"/>
              </g>
            </svg>
          ) : (
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
                <path d="M3 17a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm1-5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
                <path d="M12 8h4v4m0-4l-5 5"/>
              </g>
            </svg>
          )}
        </button>
        <button
          className="titlebar-button w-8 h-8 flex items-center justify-center rounded hover:bg-red-600 text-gray-500 dark:text-gray-400 hover:!text-white dark:hover:!text-white transition-colors ml-0.5"
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
