import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useStore, FONT_OPTIONS } from './store';
import { PALETTE_OPTIONS } from './palettes';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import MarkdownViewer from './components/MarkdownViewer';
import MarkdownEditor from './components/MarkdownEditor';
import SearchBar from './components/SearchBar';
import WelcomeScreen from './components/WelcomeScreen';
import StatusBar from './components/StatusBar';

const App: React.FC = () => {
  const {
    currentFile,
    currentFilePath,
    fileContent,
    viewMode,
    isSidebarOpen,
    isSearchOpen,
    theme,
    isMaximized,
    setMaximized,
    setCurrentFile,
    setCurrentFilePath,
    setOriginalContent,
    setViewMode,
    setTheme,
    toggleSidebar,
    setSearchOpen,
    setSearchQuery,
    fontFamily,
    setFontFamily,
    zoomLevel,
    zoomIn,
    zoomOut,
    setZoomLevel,
    previewPalette,
    setPreviewPalette,
    recentFiles,
  } = useStore();

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // percentage
  const [distractionFree, setDistractionFree] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const paletteMenuRef = useRef<HTMLDivElement>(null);
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragRatio = useRef(50); // ref for instant drag updates

  // Split view drag handlers — use ref for performance, commit on mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      const pct = Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100));
      dragRatio.current = pct;
      // Direct DOM update for instant visual feedback, no React re-render
      const editorPanel = contentRef.current.querySelector('[data-panel="editor"]') as HTMLElement | null;
      if (editorPanel) editorPanel.style.width = `${pct}%`;
      const viewerPanel = contentRef.current.querySelector('[data-panel="viewer"]') as HTMLElement | null;
      if (viewerPanel) viewerPanel.style.flex = '1';
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSplitRatio(dragRatio.current); // commit final value to React state
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = () => {
    isDragging.current = true;
    dragRatio.current = splitRatio;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Close font menu on click outside
  useEffect(() => {
    if (!showFontMenu) return;
    const handler = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setShowFontMenu(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFontMenu]);

  // ---------- HANDLERS (defined first, before effects that reference them) ----------

  const handleOpen = useCallback(async () => {
    const result = await window.markd?.openFile();
    if (result?.success && result.content !== undefined) {
      setCurrentFile(result.filePath ? result.filePath.split(/[/\\]/).pop() || null : null);
      setCurrentFilePath(result.filePath || null);
      setOriginalContent(result.content);
      if (result.filePath) useStore.getState().addRecentFile(result.filePath);
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const result = await window.markd?.openFolder();
    if (result?.success && result.path) {
      useStore.getState().setCurrentFolderPath(result.path);
      const dirResult = await window.markd?.readDirectory(result.path);
      if (dirResult?.success && dirResult.files) {
        useStore.getState().setFolderChildren(result.path, dirResult.files);
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    const result = await window.markd?.saveFile(fileContent);
    if (result?.success) {
      setOriginalContent(fileContent);
      if (result.filePath && !currentFilePath) {
        setCurrentFilePath(result.filePath);
        setCurrentFile(result.filePath.split(/[/\\]/).pop() || null);
      }
    }
  }, [fileContent, currentFilePath]);

  const handleSaveAs = useCallback(async () => {
    const result = await window.markd?.saveFileAs(fileContent);
    if (result?.success) {
      setCurrentFile(result.filePath ? result.filePath.split(/[/\\]/).pop() || null : null);
      setCurrentFilePath(result.filePath || null);
      setOriginalContent(fileContent);
    }
  }, [fileContent]);

  const handleNewFile = useCallback(() => {
    setCurrentFile('Untitled.md');
    setCurrentFilePath(null);
    setOriginalContent('');
    setSearchQuery('');
    setViewMode('split');
  }, []);

  const handleOpenRecentFile = useCallback(async (filePath: string) => {
    const result = await window.markd?.getFileContent(filePath);
    if (result?.success && result.content !== undefined) {
      setCurrentFile(filePath.split(/[/\\]/).pop() || null);
      setCurrentFilePath(filePath);
      setOriginalContent(result.content);
      useStore.getState().addRecentFile(filePath);
    }
  }, []);

  // Use refs so effects always get the latest handler without stale closures
  const handlersRef = useRef({ handleOpen, handleOpenFolder, handleSave, handleSaveAs, handleNewFile });
  handlersRef.current = { handleOpen, handleOpenFolder, handleSave, handleSaveAs, handleNewFile };

  // ---------- EFFECTS ----------

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [theme]);

  // Listen for menu actions from Electron main process
  useEffect(() => {
    const cleanup = window.markd?.onMenuAction((action: string) => {
      const h = handlersRef.current;
      switch (action) {
        case 'new':
          h.handleNewFile();
          break;
        case 'find':
          setSearchOpen(true);
          break;
        case 'toggle-theme':
          setTheme(theme === 'dark' ? 'light' : 'dark');
          break;
        case 'toggle-sidebar':
          toggleSidebar();
          break;
      }
    });
    return () => cleanup?.();
  }, [theme]);

  // Listen for window state changes
  useEffect(() => {
    const cleanup = window.markd?.onWindowStateChanged((state: string) => {
      const maximized = state === 'maximized';
      setMaximized(maximized);
      if (maximized) setDistractionFree(false);
    });
    return () => cleanup?.();
  }, []);

  // Check initial window state
  useEffect(() => {
    window.markd?.isMaximized().then(setMaximized);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            h.handleSave();
            break;
          case 'o':
            e.preventDefault();
            h.handleOpen();
            break;
          case 'n':
            e.preventDefault();
            h.handleNewFile();
            break;
          case 'f':
            e.preventDefault();
            setSearchOpen(true);
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
          case '=':
            e.preventDefault();
            zoomIn();
            break;
          case '0':
            e.preventDefault();
            setZoomLevel(100);
            break;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            h.handleSaveAs();
            break;
          case 'o':
            e.preventDefault();
            h.handleOpenFolder();
            break;
          case 'd':
            e.preventDefault();
            setTheme(theme === 'dark' ? 'light' : 'dark');
            break;
          case 'f':
            if (!isMaximized) {
              e.preventDefault();
              setDistractionFree(v => !v);
            }
            break;
        }
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileContent, currentFile, theme]);

  // Close font menu on click outside
  useEffect(() => {
    if (!showFontMenu) return;
    const handler = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setShowFontMenu(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFontMenu]);

  // Close palette menu on click outside
  useEffect(() => {
    if (!showPaletteMenu) return;
    const handler = (e: MouseEvent) => {
      if (paletteMenuRef.current && !paletteMenuRef.current.contains(e.target as Node)) {
        setShowPaletteMenu(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPaletteMenu]);

  const FontSelector = () => {
    const currentLabel = FONT_OPTIONS.find(o => o.value === fontFamily)?.label || 'System Default';
    const btnRef = useRef<HTMLButtonElement>(null);
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

    const openMenu = () => {
      if (!showFontMenu && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPanelStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left });
      }
      setShowFontMenu(!showFontMenu);
    };

    return (
    <div className="relative" ref={fontMenuRef}>
      <button
        ref={btnRef}
        className="btn-icon text-xs gap-2 flex items-center"
        onClick={openMenu}
        title="Change font family"
      >
        <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16.5 16">
          <path d="M6.71 10H2.332l-.874 2.498a.75.75 0 0 1-1.415-.496l3.39-9.688a1.217 1.217 0 0 1 2.302.018l3.227 9.681a.75.75 0 0 1-1.423.474Zm3.13-4.358C10.53 4.374 11.87 4 13 4c1.5 0 3 .939 3 2.601v5.649a.75.75 0 0 1-1.448.275C13.995 12.82 13.3 13 12.5 13c-.77 0-1.514-.231-2.078-.709c-.577-.488-.922-1.199-.922-2.041c0-.694.265-1.411.887-1.944C11 7.78 11.88 7.5 13 7.5h1.5v-.899c0-.54-.5-1.101-1.5-1.101c-.869 0-1.528.282-1.84.858a.75.75 0 1 1-1.32-.716M6.21 8.5L4.574 3.594L2.857 8.5Zm8.29.5H13c-.881 0-1.375.22-1.637.444c-.253.217-.363.5-.363.806c0 .408.155.697.39.896c.249.21.63.354 1.11.354c.732 0 1.26-.209 1.588-.449c.35-.257.412-.495.412-.551Z" />
        </svg>
        <span className="text-[12px] font-medium">Font</span>
      </button>
      {showFontMenu && (
        <div className="w-52 bg-white/85 dark:bg-[#222c36]/85 backdrop-blur-md border border-gray-200/40 dark:border-gray-700/40 rounded-md shadow-2xl max-h-72 overflow-y-auto" style={{ position: 'fixed', zIndex: 9999, ...panelStyle }}>
          {/* Current font header */}
          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {currentLabel}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          {FONT_OPTIONS.map((opt) => {
            const isSelected = fontFamily === opt.value;
            return (
              <button
                key={opt.value}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                  isSelected
                    ? 'text-blue-500 bg-blue-500/10'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
                onClick={() => { setFontFamily(opt.value); setShowFontMenu(false); }}
                style={{ fontFamily: opt.value === 'system' ? undefined : opt.value }}
              >
                <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">
                  {isSelected ? (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="m9.55 15.15l8.475-8.475q.3-.3.7-.3t.7.3t.3.713t-.3.712l-9.175 9.2q-.3.3-.7.3t-.7-.3L4.55 13q-.3-.3-.288-.712t.313-.713t.713-.3t.712.3z"/></svg>
                  ) : (
                    <svg className="w-[14px] h-[14px] text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 15 15"><path d="M12.499 2a.5.5 0 0 1 .001 1H8.692l-.287.854c-.216.643-.51 1.518-.824 2.444L7.344 7H8.5a.5.5 0 0 1 0 1H7.004c-.437 1.285-.84 2.462-1.046 3.04c-.322.899-.751 1.446-1.291 1.738c-.504.273-1.025.272-1.383.272H3.25a.55.55 0 1 1 0-1.1c.392 0 .653-.01.894-.14c.22-.119.511-.396.778-1.142c.185-.517.531-1.527.92-2.668H4.5a.5.5 0 0 1 0-1h1.682l.357-1.055c.313-.925.607-1.799.823-2.441L7.532 3H5c-.849 0-1.5.651-1.5 1.5a.5.5 0 0 1-1 0C2.5 3.099 3.599 2 5 2z"/></svg>
                  )}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  };

  const PaletteSelector = () => {
    const currentLabel = PALETTE_OPTIONS.find(o => o.value === previewPalette)?.label || 'Default';
    const btnRef = useRef<HTMLButtonElement>(null);
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

    const openMenu = () => {
      if (!showPaletteMenu && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPanelStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left });
      }
      setShowPaletteMenu(!showPaletteMenu);
    };

    return (
    <div className="relative" ref={paletteMenuRef}>
      <button
        ref={btnRef}
        className="btn-icon text-xs gap-2 flex items-center"
        onClick={openMenu}
        title="Change preview color palette"
      >
        <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8"/>
          <path d="M8 1a7 7 0 0 0 0 14V1z" opacity=".3"/>
        </svg>
        <span className="text-[12px] font-medium">Palette</span>
      </button>
      {showPaletteMenu && (
        <div className="w-44 bg-white/85 dark:bg-[#222c36]/85 backdrop-blur-md border border-gray-200/40 dark:border-gray-700/40 rounded-md shadow-2xl overflow-y-auto" style={{ position: 'fixed', zIndex: 9999, ...panelStyle }}>
          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {currentLabel}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          {PALETTE_OPTIONS.map((opt) => {
            const isSelected = previewPalette === opt.value;
            return (
              <button
                key={opt.value}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                  isSelected
                    ? 'text-blue-500 bg-blue-500/10'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
                onClick={() => { setPreviewPalette(opt.value); setShowPaletteMenu(false); }}
              >
                {/* Color swatches */}
                <span className="flex gap-0.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full inline dark:hidden ring-1 ring-black/10" style={{ backgroundColor: opt.swatches[0] }} />
                  <span className="w-2.5 h-2.5 rounded-full inline dark:hidden" style={{ backgroundColor: opt.swatches[1] }} />
                  <span className="w-2.5 h-2.5 rounded-full inline dark:hidden" style={{ backgroundColor: opt.swatches[2] }} />
                  <span className="w-2.5 h-2.5 rounded-full hidden dark:inline ring-1 ring-white/10" style={{ backgroundColor: opt.swatchesDark[0] }} />
                  <span className="w-2.5 h-2.5 rounded-full hidden dark:inline" style={{ backgroundColor: opt.swatchesDark[1] }} />
                  <span className="w-2.5 h-2.5 rounded-full hidden dark:inline" style={{ backgroundColor: opt.swatchesDark[2] }} />
                </span>
                <span className="flex-1">{opt.label}</span>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="m9.55 15.15l8.475-8.475q.3-.3.7-.3t.7.3t.3.713t-.3.712l-9.175 9.2q-.3.3-.7.3t-.7-.3L4.55 13q-.3-.3-.288-.712t.313-.713t.713-.3t.712.3z"/></svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${distractionFree ? 'relative' : ''}`}>
      <TitleBar
        onMinimize={() => window.markd?.minimizeWindow()}
        onMaximize={() => window.markd?.maximizeWindow()}
        onClose={() => window.markd?.closeWindow()}
        isMaximized={isMaximized}
        onOpenFile={handleOpen}
        onOpenFolder={handleOpenFolder}
        onNewFile={handleNewFile}
        onSaveFile={handleSave}
        onSaveFileAs={handleSaveAs}
        onOpenRecentFile={handleOpenRecentFile}
        recentFiles={recentFiles}
        distractionFree={distractionFree}
        onToggleDistractionFree={() => setDistractionFree(v => !v)}
        paletteBg={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bg || '#ffffff'}
        paletteBgDark={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bgDark || '#1a222b'}
      />

      <div className={`flex flex-1 overflow-hidden ${distractionFree ? '' : ''}`}>
        {/* Sidebar */}
        <div
          className={`${
            isSidebarOpen && !distractionFree ? 'w-64' : 'w-0'
          } flex-shrink-0 border-r border-md-border dark:border-md-border-dark bg-md-surface dark:bg-md-surface-dark overflow-hidden flex flex-col transition-all duration-200`}
        >
          {isSidebarOpen && <Sidebar />}
        </div>

        {/* Floating sidebar toggle when collapsed */}
        {!isSidebarOpen && !distractionFree && (
          <button
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-6 h-12 flex items-center justify-center bg-white/70 dark:bg-[#222c36]/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-r-md shadow-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            onClick={toggleSidebar}
            title="Open sidebar (Ctrl+B)"
          >
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Search Bar */}
          {isSearchOpen && <SearchBar />}

          {/* Toolbar */}
          {currentFile && !distractionFree && (
            <div className="flex items-center gap-0.5 px-3 h-10 border-b border-gray-200/60 dark:border-gray-700/60 bg-white/85 dark:bg-[#222c36]/85 relative z-10">
              {/* Left spacer — pushes tools to center on lg+ */}
              <div className="flex-1 hidden lg:block" />
              {/* ---- View mode toggle group ---- */}
              <div className="flex rounded-md border border-slate-300 dark:border-gray-600 overflow-hidden mr-1 shrink-0">
                <button
                  className={`px-2.5 py-1 text-xs font-medium transition-colors border-r border-slate-300 dark:border-gray-600 ${viewMode === 'view' ? 'bg-slate-200 dark:bg-[#3a4552] text-slate-800 dark:text-gray-100' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                  onClick={() => setViewMode('view')}
                  title="Preview mode"
                >
                  <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13c3.6-8 14.4-8 18 0" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a3 3 0 1 1 0-6a3 3 0 0 1 0 6" />
                  </svg>
                </button>
                <button
                  className={`px-2.5 py-1 text-xs font-medium transition-colors border-r border-slate-300 dark:border-gray-600 ${viewMode === 'edit' ? 'bg-slate-200 dark:bg-[#3a4552] text-slate-800 dark:text-gray-100' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                  onClick={() => setViewMode('edit')}
                  title="Edit mode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M16.443 7.328a.75.75 0 0 1 1.059-.056l1.737 1.564c.737.663 1.347 1.212 1.767 1.71c.44.525.754 1.088.754 1.784c0 .695-.313 1.258-.754 1.782c-.42.499-1.03 1.049-1.767 1.711l-1.737 1.564a.75.75 0 1 1-1.004-1.115l1.697-1.527c.788-.709 1.319-1.19 1.663-1.598c.33-.393.402-.622.402-.817c0-.196-.072-.425-.402-.818c-.344-.409-.875-.889-1.663-1.598l-1.697-1.527a.75.75 0 0 1-.056-1.06m-8.94 1.06a.75.75 0 0 0-1.004-1.115L4.761 8.836c-.737.663-1.347 1.212-1.767 1.71c-.44.525-.754 1.088-.754 1.784c0 .695.313 1.258.754 1.782c.42.499 1.03 1.049 1.767 1.711l1.737 1.564a.75.75 0 1 0 1.004-1.115l-1.697-1.527c-.788-.709-1.319-1.19-1.663-1.598c-.33-.393-.402-.622-.402-.817c0-.196.072-.425.402-.818c.344-.409.875-.889 1.663-1.598z"/><path fill="currentColor" d="M14.182 4.276a.75.75 0 0 1 .53.918l-3.974 14.83a.75.75 0 1 1-1.449-.389l3.974-14.83a.75.75 0 0 1 .919-.53" opacity=".5"/></svg>
                </button>
                <button
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === 'split' ? 'bg-slate-200 dark:bg-[#3a4552] text-slate-800 dark:text-gray-100' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                  onClick={() => setViewMode('split')}
                  title="Split mode"
                >
                  <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm8.5-1v12H14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm-1 0H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5.5z" />
                  </svg>
                </button>
              </div>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
              {/* Save button */}
              <button className="btn-icon shrink-0" onClick={handleSave} title="Save (Ctrl+S)">
                <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
              {/* Font selector */}
              <FontSelector />
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />
              {/* Palette selector */}
              <PaletteSelector />
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />
              {/* Zoom controls */}
              <button className="btn-icon" onClick={zoomOut} title="Zoom out">
                <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m17 17l4 4M3 11a8 8 0 1 0 16 0a8 8 0 0 0-16 0m5 0h6" />
                </svg>
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-center tabular-nums font-medium">{zoomLevel}%</span>
              <button className="btn-icon" onClick={zoomIn} title="Zoom in">
                <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h3m3 0h-3m0 0V8m0 3v3m6 3l4 4M3 11a8 8 0 1 0 16 0a8 8 0 0 0-16 0" />
                </svg>
              </button>
              <div className="flex-1" />
              {/* TOC button — only in view and split modes, always at right */}
              {viewMode !== 'edit' && (
              <button
                className="btn-icon"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setShowToc(v => !v); }}
                title="Table of Contents"
              >
                <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M1 1v14h14V1zM0 0h16v16H0zm9 1v14h1V1zM3 3.5h4v-1H3zm0 3h4v-1H3zm0 3h4v-1H3z"/></svg>
              </button>
              )}
            </div>
          )}

          {/* Content Area */}
          <div ref={contentRef} className="flex-1 overflow-hidden flex">
            {!currentFile ? (
              <WelcomeScreen onOpen={handleOpen} onOpenFolder={handleOpenFolder} onNew={handleNewFile} />
            ) : (
              <>
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div
                    data-panel="editor"
                    className="flex flex-col min-w-0"
                    style={viewMode === 'split' ? { width: `${splitRatio}%` } : { flex: 1 }}
                  >
                    <MarkdownEditor />
                  </div>
                )}
                {viewMode === 'split' && (
                  <div
                    className="w-1.5 flex-shrink-0 bg-[#e5e7eb] dark:bg-[#222c36] hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors active:bg-blue-500 border-l border-r border-gray-200 dark:border-gray-700/20"
                    onMouseDown={startDrag}
                  >
                    <div className="w-full h-full" />
                  </div>
                )}
                {(viewMode === 'view' || viewMode === 'split') && (
                  <div
                    data-panel="viewer"
                    className="overflow-hidden"
                    style={viewMode === 'split' ? { flex: 1 } : { flex: 1 }}
                  >
                    <MarkdownViewer showToc={showToc} onToggleToc={() => setShowToc(false)} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Status Bar */}
          {currentFile && !distractionFree && <StatusBar />}
        </div>
      </div>
    </div>
  );
};

export default App;
