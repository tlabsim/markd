import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { FileEntry } from '../types';

/** Recursive tree node renderer */
const TreeNode: React.FC<{
  entry: FileEntry;
  depth: number;
  onToggle: (entry: FileEntry) => void;
  onOpenFile?: (path: string) => void;
}> = ({ entry, depth, onToggle, onOpenFile }) => {
  const currentFilePath = useStore((state) => state.currentFilePath);
  const children = useStore((state) => state.folderChildren[entry.path]);
  const isExpanded = useStore((state) => state.expandedFolderPaths.has(entry.path));
  const setFolderChildren = useStore((state) => state.setFolderChildren);
  const toggleExpandedFolder = useStore((state) => state.toggleExpandedFolder);

  const isDir = entry.isDirectory;
  const isActive = currentFilePath === entry.path;

  const handleClick = useCallback(async () => {
    if (isDir) {
      const wasExpanded = isExpanded;
      toggleExpandedFolder(entry.path);
      if (!wasExpanded) {
        const result = await window.markd?.readDirectory(entry.path);
        if (result?.success && result.files) {
          setFolderChildren(entry.path, result.files);
        }
      }
    } else {
      onOpenFile?.(entry.path);
    }
  }, [entry, isDir, isExpanded, onOpenFile]);

  return (
    <>
      <button
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors text-left group
          ${isActive
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : isDir
              ? 'text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-700/10 dark:hover:bg-gray-200/10'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-700/10 dark:hover:bg-gray-200/10'
          }`}
        style={{ paddingLeft: `${8 + depth * 24}px` }}
        onClick={handleClick}
        title={entry.path}
      >
        {isDir ? (
          <>
            <svg
              className={`w-[18px] h-[18px] flex-shrink-0 text-amber-600 dark:text-amber-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5l7 7-7 7" />
            </svg>
            <svg className="w-[18px] h-[18px] flex-shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M9.51 5.274c-.105-.02-.23-.024-.687-.024H6.2c-.572 0-.957 0-1.253.025c-.287.023-.424.065-.514.111a1.25 1.25 0 0 0-.547.547c-.046.09-.088.227-.111.514c-.024.296-.025.68-.025 1.253v8.6c0 .572 0 .957.025 1.252c.023.288.065.425.111.515c.12.236.311.427.547.547c.09.046.227.088.514.111c.296.024.68.025 1.253.025h11.6c.572 0 .957 0 1.252-.025c.288-.023.425-.065.515-.111a1.25 1.25 0 0 0 .547-.547c.046-.09.088-.227.111-.515c.024-.295.025-.68.025-1.252v-5.6c0-.572 0-.957-.025-1.253c-.023-.287-.065-.424-.111-.514a1.25 1.25 0 0 0-.547-.547c-.09-.046-.227-.088-.515-.111c-.295-.024-.68-.025-1.252-.025h-4.123c-.394 0-.696.003-.98-.053a2.75 2.75 0 0 1-1.631-1.008c-.498-.64-.641-1.731-1.557-1.915M8.886 3.75c.364 0 .648 0 .917.053a2.75 2.75 0 0 1 1.63 1.008c.179.23.31.5.487.854c.244.488.479.942 1.07 1.06c.104.022.228.025.686.025h4.153c.535 0 .98 0 1.345.03c.38.03.736.098 1.073.27a2.75 2.75 0 0 1 1.202 1.202c.172.337.24.693.27 1.073c.03.365.03.81.03 1.345v5.66c0 .535 0 .98-.03 1.345c-.03.38-.098.736-.27 1.073a2.75 2.75 0 0 1-1.201 1.202c-.338.172-.694.24-1.074.27c-.365.03-.81.03-1.344.03H6.17c-.535 0-.98 0-1.345-.03c-.38-.03-.736-.098-1.073-.27a2.75 2.75 0 0 1-1.202-1.2c-.172-.338-.24-.694-.27-1.074c-.03-.365-.03-.81-.03-1.345V7.67c0-.535 0-.98.03-1.345c.03-.38.098-.736.27-1.073A2.75 2.75 0 0 1 3.752 4.05c.337-.172.693-.24 1.073-.27c.365-.03.81-.03 1.345-.03z" clipRule="evenodd" />
            </svg>
          </>
        ) : entry.name.endsWith('.md') || entry.name.endsWith('.markdown') ? (
          <svg className="w-[18px] h-[18px] flex-shrink-0 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5 7.29L7 5h1v6H7V6.71L5 9L3 6.71V11H2V5h1zM11.5 11L9 8h2V5h1v3h2z" />
            <path fillRule="evenodd" d="M12.8 3c1.12 0 1.68 0 2.11.218c.376.192.682.498.874.874c.218.428.218.988.218 2.11v3.6c0 1.12 0 1.68-.218 2.11l-.077.138a2 2 0 0 1-.797.736l-.168.071c-.41.146-.96.146-1.94.146h-9.6L2.46 13c-.542-.008-.906-.039-1.2-.144l-.168-.07a2 2 0 0 1-.797-.737l-.077-.138C0 11.483 0 10.923 0 9.801v-3.6c0-1.12 0-1.68.218-2.11c.192-.376.498-.682.874-.874c.32-.163.716-.205 1.37-.215L3.204 3h9.6zM3.2 4c-.577 0-.949.001-1.23.024c-.272.023-.372.06-.422.085a1 1 0 0 0-.437.437c-.025.05-.063.15-.085.422c-.023.283-.024.656-.024 1.23v3.6c0 .577 0 .95.024 1.23c.022.272.06.372.085.422a1 1 0 0 0 .437.436c.05.026.15.063.422.085c.283.024.656.025 1.23.025h9.6c.577 0 .949-.001 1.23-.025c.272-.022.372-.06.422-.085a1 1 0 0 0 .436-.436c.025-.049.063-.15.085-.422c.023-.283.024-.656.024-1.23v-3.6c0-.577 0-.949-.024-1.23c-.022-.272-.06-.372-.085-.422a1 1 0 0 0-.436-.437c-.05-.025-.15-.062-.422-.085A17 17 0 0 0 12.8 4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-[18px] h-[18px] flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9" />
          </svg>
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {/* Render children if directory is expanded and has children */}
      {isDir && isExpanded && children && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} onToggle={onToggle} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
      {isDir && isExpanded && (!children || children.length === 0) && (
        <div className="text-[10px] py-1 italic" style={{ color: 'var(--pal-muted)', paddingLeft: `${32 + (depth + 1) * 24}px` }}>Empty folder</div>
      )}
    </>
  );
};

const Sidebar: React.FC<{
  onOpenFile?: () => void;
  onOpenPath?: (path: string) => void;
  matchPalette?: boolean;
  paletteBg?: string;
  paletteBgDark?: string;
}> = ({ onOpenFile, onOpenPath, matchPalette, paletteBg, paletteBgDark }) => {
  const paletteStyle = matchPalette ? { backgroundColor: 'var(--pal-panel-bg)' } : undefined;
  const paletteStyle85 = matchPalette ? { backgroundColor: 'color-mix(in srgb, var(--pal-panel-bg) 85%, transparent)' } : undefined;
  const {
    currentFolderPath,
    folderChildren,
    setCurrentFolderPath,
    setFolderChildren,
    clearFolderChildren,
    toggleSidebar,
    recentFiles,
  } = useStore(useShallow((state) => ({
    currentFolderPath: state.currentFolderPath,
    folderChildren: state.folderChildren,
    setCurrentFolderPath: state.setCurrentFolderPath,
    setFolderChildren: state.setFolderChildren,
    clearFolderChildren: state.clearFolderChildren,
    toggleSidebar: state.toggleSidebar,
    recentFiles: state.recentFiles,
  })));

  const [loading, setLoading] = useState(false);
  const rootChildren = currentFolderPath ? (folderChildren[currentFolderPath] || []) : [];

  // ---- Dead recent-file detection with animated removal ----
  const removeRecentFile = useStore((state) => state.removeRecentFile);
  const [deadFiles, setDeadFiles] = useState<Record<string, 'striking' | 'removing'>>({});
  const [recentMenu, setRecentMenu] = useState<{ filePath: string; x: number; y: number } | null>(null);
  const recentMenuRef = useRef<HTMLDivElement>(null);
  const deadTimers = useRef<Record<string, number>>({});

  const markDead = useCallback((fp: string) => {
    if (deadFiles[fp]) return;
    setDeadFiles(d => ({ ...d, [fp]: 'striking' }));
    deadTimers.current[fp] = window.setTimeout(() => {
      setDeadFiles(d => ({ ...d, [fp]: 'removing' }));
      deadTimers.current[fp + '_rm'] = window.setTimeout(() => {
        removeRecentFile(fp);
      }, 300);
    }, 600);
  }, [deadFiles, removeRecentFile]);

  const handleRecentClick = useCallback(async (filePath: string) => {
    const r = await window.markd?.getFileContent(filePath);
    if (r?.success) {
      onOpenPath?.(filePath);
    } else {
      markDead(filePath);
    }
  }, [onOpenPath, markDead]);

  const ensureRecentFileExists = useCallback(async (filePath: string) => {
    const r = await window.markd?.getFileContent(filePath);
    if (r?.success) return true;
    markDead(filePath);
    return false;
  }, [markDead]);

  const handleRecentContextMenu = useCallback(async (event: React.MouseEvent, filePath: string) => {
    event.preventDefault();
    event.stopPropagation();
    setRecentMenu(null);
    const exists = await ensureRecentFileExists(filePath);
    if (!exists) return;

    const menuWidth = 176;
    const menuHeight = 104;
    const margin = 8;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - margin);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - margin);
    setRecentMenu({
      filePath,
      x: Math.max(margin, x),
      y: Math.max(margin, y),
    });
  }, [ensureRecentFileExists]);

  const openRecentFromMenu = useCallback(async () => {
    const filePath = recentMenu?.filePath;
    setRecentMenu(null);
    if (!filePath) return;
    if (await ensureRecentFileExists(filePath)) onOpenPath?.(filePath);
  }, [ensureRecentFileExists, onOpenPath, recentMenu]);

  const locateRecentFromMenu = useCallback(async () => {
    const filePath = recentMenu?.filePath;
    setRecentMenu(null);
    if (!filePath) return;
    if (!(await ensureRecentFileExists(filePath))) return;
    const locateOnDisk = window.markd?.locateOnDisk;
    if (typeof locateOnDisk !== 'function') {
      console.warn('Locate on Disk is unavailable until the Electron app is restarted.');
      return;
    }
    const result = await locateOnDisk(filePath);
    if (!result?.success) markDead(filePath);
  }, [ensureRecentFileExists, markDead, recentMenu]);

  const removeRecentFromMenu = useCallback(() => {
    const filePath = recentMenu?.filePath;
    setRecentMenu(null);
    if (!filePath) return;
    removeRecentFile(filePath);
  }, [recentMenu, removeRecentFile]);

  useEffect(() => {
    if (!recentMenu) return;
    const close = (event: MouseEvent) => {
      if (recentMenuRef.current?.contains(event.target as Node)) return;
      setRecentMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRecentMenu(null);
    };
    const closeOnScroll = () => setRecentMenu(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('contextmenu', close);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnScroll);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('contextmenu', close);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnScroll);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [recentMenu]);

  useEffect(() => {
    if (recentFiles.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const fp of recentFiles) {
        if (cancelled) return;
        if (deadFiles[fp]) continue;
        try {
          const r = await window.markd?.getFileContent(fp);
          if (!r?.success) markDead(fp);
        } catch {
          markDead(fp);
        }
      }
    })();
    return () => {
      cancelled = true;
      // Cancel all pending dead-file timers and reset state for any
      // files still in the list (they may have been restored/re-opened)
      for (const key of Object.keys(deadTimers.current)) {
        clearTimeout(deadTimers.current[key]);
        delete deadTimers.current[key];
      }
      setDeadFiles(prev => {
        const next: Record<string, 'striking' | 'removing'> = {};
        for (const [fp, state] of Object.entries(prev)) {
          if (!recentFiles.includes(fp)) next[fp] = state;
        }
        return next;
      });
    };
  }, [recentFiles]); // eslint-disable-line

  const openFolderAtPath = useCallback(async (dirPath: string) => {
    setLoading(true);
    setCurrentFolderPath(dirPath);
    const result = await window.markd?.readDirectory(dirPath);
    if (result?.success && result.files) {
      setFolderChildren(dirPath, result.files);
    }
    setLoading(false);
  }, []);

  const handleOpenFolder = useCallback(async () => {
    setLoading(true);
    const result = await window.markd?.openFolder();
    if (result?.success && result.path) {
      clearFolderChildren();
      await openFolderAtPath(result.path);
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div
        className="flex items-center justify-between pl-3 pr-1.5 h-10 border-b border-gray-200/60 dark:border-gray-700/50 bg-gray-50/85 dark:bg-[#222c36]/85 backdrop-blur-md"
        style={paletteStyle85}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            className="opacity-70 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700/10 dark:hover:bg-gray-200/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            onClick={onOpenFile}
            title="Open file"
          >
            {/* <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.478 3H7.25A2.25 2.25 0 0 0 5 5.25v13.5A2.25 2.25 0 0 0 7.25 21h9a2.25 2.25 0 0 0 2.25-2.25V12M9.478 3c1.243 0 2.272 1.007 2.272 2.25V7.5A2.25 2.25 0 0 0 14 9.75h2.25A2.25 2.25 0 0 1 18.5 12M9.478 3c3.69 0 9.022 5.36 9.022 9M9 16.5h6m-6-3h4"/></svg> */}
            <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M12 16.5v-9M8.5 11L12 7.5l3.5 3.5"/><path d="M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z"/></g></svg>
          </button>
          <button
            className="opacity-70 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700/10 dark:hover:bg-gray-200/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            onClick={handleOpenFolder}
            title="Open folder"
          >
            {/* <svg className="w-[20px] h-[20px] shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M9.51 5.274c-.105-.02-.23-.024-.687-.024H6.2c-.572 0-.957 0-1.253.025c-.287.023-.424.065-.514.111a1.25 1.25 0 0 0-.547.547c-.046.09-.088.227-.111.514c-.024.296-.025.68-.025 1.253v8.6c0 .572 0 .957.025 1.252c.023.288.065.425.111.515c.12.236.311.427.547.547c.09.046.227.088.514.111c.296.024.68.025 1.253.025h11.6c.572 0 .957 0 1.252-.025c.288-.023.425-.065.515-.111a1.25 1.25 0 0 0 .547-.547c.046-.09.088-.227.111-.515c.024-.295.025-.68.025-1.252v-5.6c0-.572 0-.957-.025-1.253c-.023-.287-.065-.424-.111-.514a1.25 1.25 0 0 0-.547-.547c-.09-.046-.227-.088-.515-.111c-.295-.024-.68-.025-1.252-.025h-4.123c-.394 0-.696.003-.98-.053a2.75 2.75 0 0 1-1.631-1.008c-.498-.64-.641-1.731-1.557-1.915M8.886 3.75c.364 0 .648 0 .917.053a2.75 2.75 0 0 1 1.63 1.008c.179.23.31.5.487.854c.244.488.479.942 1.07 1.06c.104.022.228.025.686.025h4.153c.535 0 .98 0 1.345.03c.38.03.736.098 1.073.27a2.75 2.75 0 0 1 1.202 1.202c.172.337.24.693.27 1.073c.03.365.03.81.03 1.345v5.66c0 .535 0 .98-.03 1.345c-.03.38-.098.736-.27 1.073a2.75 2.75 0 0 1-1.201 1.202c-.338.172-.694.24-1.074.27c-.365.03-.81.03-1.344.03H6.17c-.535 0-.98 0-1.345-.03c-.38-.03-.736-.098-1.073-.27a2.75 2.75 0 0 1-1.202-1.2c-.172-.338-.24-.694-.27-1.074c-.03-.365-.03-.81-.03-1.345V7.67c0-.535 0-.98.03-1.345c.03-.38.098-.736.27-1.073A2.75 2.75 0 0 1 3.752 4.05c.337-.172.693-.24 1.073-.27c.365-.03.81-.03 1.345-.03z" clipRule="evenodd" />
            </svg> */}
            {/* <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7h-7.34a2 2 0 0 1-1.322-.5l-2.272-2M19 7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1.745a2 2 0 0 1 1.322.5M19 7a2.5 2.5 0 0 0-2.5-2.5H8.066"/></svg> */}
            <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.661 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7m8.661 0a2 2 0 0 1-1.322-.5l-2.272-2A2 2 0 0 0 6.745 4H5a2 2 0 0 0-2 2v1m8.661 0H3"/></svg>
          </button>
          <button
            className="opacity-70 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700/10 dark:hover:bg-gray-200/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            onClick={toggleSidebar}
            title="Collapse sidebar"
          >
            <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M9 3.5v17m7-5.5l-3-3l3-3"/><path d="M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z"/></g></svg>
          </button>
        </div>
      </div>

      {/* Folder path */}
      {currentFolderPath && (
        <div
          className="px-3 py-1 border-b border-gray-200/60 dark:border-gray-700/50 bg-gray-50/85 dark:bg-[#222c36]/85 backdrop-blur-md"
          style={paletteStyle85}
        >
          <p className="text-[10px] text-gray-500 truncate" title={currentFolderPath}>
            {currentFolderPath.split(/[/\\]/).pop()}
          </p>
        </div>
      )}

      {/* File tree */}
      <div
        className="flex-1 overflow-y-auto py-1 bg-gray-50 dark:bg-[#222c36]"
        style={paletteStyle}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-transparent rounded-full animate-spin" style={{ borderTopColor: '#3b82f6' }} />
          </div>
        ) : rootChildren.length === 0 ? (
          <div className="text-center py-6 px-4">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" style={{ color: 'var(--pal-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44" />
            </svg>
            <p className="text-xs mb-3" style={{ color: 'var(--pal-muted)' }}>No folder open</p>
            <button className="text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 mb-4" onClick={handleOpenFolder}>
              Open a folder
            </button>

            {/* Recent files — always visible */}
            <div className="text-left border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-1">
                Recent
              </p>
              {recentFiles.length === 0 ? (
                <p className="text-[11px] italic px-1" style={{ color: 'var(--pal-muted)' }}>No recent files</p>
              ) : (
                <div className="space-y-px">
                  {recentFiles.slice(0, 10).map((filePath) => {
                    const name = filePath.split(/[/\\]/).pop() || filePath;
                    const df = deadFiles[filePath];
                    if (df === 'removing') return null;
                    const isDead = df === 'striking';
                    return (
                      <button
                        key={filePath}
                        className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-700/10 dark:hover:bg-white/10 transition-colors ${isDead ? 'pointer-events-none opacity-50' : ''}`}
                        onClick={() => handleRecentClick(filePath)}
                        onContextMenu={(event) => handleRecentContextMenu(event, filePath)}
                        title={isDead ? `${filePath} (file missing)` : filePath}
                      >
                        <svg className={`w-[16px] h-[16px] flex-shrink-0 ${isDead ? 'text-red-400 dark:text-red-500' : 'text-blue-500 dark:text-blue-400'}`} fill="currentColor" viewBox="0 0 16 16">
                          <path d="M5 7.29L7 5h1v6H7V6.71L5 9L3 6.71V11H2V5h1zM11.5 11L9 8h2V5h1v3h2z" />
                          <path fillRule="evenodd" d="M12.8 3c1.12 0 1.68 0 2.11.218c.376.192.682.498.874.874c.218.428.218.988.218 2.11v3.6c0 1.12 0 1.68-.218 2.11l-.077.138a2 2 0 0 1-.797.736l-.168.071c-.41.146-.96.146-1.94.146h-9.6L2.46 13c-.542-.008-.906-.039-1.2-.144l-.168-.07a2 2 0 0 1-.797-.737l-.077-.138C0 11.483 0 10.923 0 9.801v-3.6c0-1.12 0-1.68.218-2.11c.192-.376.498-.682.874-.874c.32-.163.716-.205 1.37-.215L3.204 3h9.6zM3.2 4c-.577 0-.949.001-1.23.024c-.272.023-.372.06-.422.085a1 1 0 0 0-.437.437c-.025.05-.063.15-.085.422c-.023.283-.024.656-.024 1.23v3.6c0 .577 0 .95.024 1.23c.022.272.06.372.085.422a1 1 0 0 0 .437.436c.05.026.15.063.422.085c.283.024.656.025 1.23.025h9.6c.577 0 .949-.001 1.23-.025c.272-.022.372-.06.422-.085a1 1 0 0 0 .436-.436c.025-.049.063-.15.085-.422c.023-.283.024-.656.024-1.23v-3.6c0-.577 0-.949-.024-1.23c-.022-.272-.06-.372-.085-.422a1 1 0 0 0-.436-.437c-.05-.025-.15-.062-.422-.085A17 17 0 0 0 12.8 4z" clipRule="evenodd" />
                        </svg>
                        <span className={`truncate ${isDead ? 'animate-strikethrough' : ''}`}>{name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-px pr-1">
            {rootChildren.map((entry) => (
              <TreeNode key={entry.path} entry={entry} depth={0} onToggle={() => {}} onOpenFile={onOpenPath} />
            ))}
          </div>
        )}
      </div>
      {recentMenu && (
        <div
          ref={recentMenuRef}
          className="fixed z-[100] min-w-44 overflow-hidden rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-[#1c2733]/95 shadow-xl backdrop-blur-md py-1"
          style={{
            left: recentMenu.x,
            top: recentMenu.y,
            ...(matchPalette ? {
              backgroundColor: 'color-mix(in srgb, var(--pal-panel-bg) 94%, transparent)',
              borderColor: 'var(--pal-border-soft)',
              color: 'var(--pal-text)',
            } : {}),
          }}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-700/10 dark:hover:bg-white/10"
            onClick={openRecentFromMenu}
          >
            Open
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-700/10 dark:hover:bg-white/10"
            onClick={locateRecentFromMenu}
          >
            Locate on Disk
          </button>
          <div className="my-1 border-t border-gray-200/70 dark:border-gray-700/70" />
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
            onClick={removeRecentFromMenu}
          >
            Remove from Recent
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
