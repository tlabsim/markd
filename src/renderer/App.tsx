import React, { useEffect, useCallback, useRef, useState, useLayoutEffect } from 'react';
import { useStore, FONT_OPTIONS } from './store';
import { useShallow } from 'zustand/react/shallow';
import { PALETTE_OPTIONS } from './palettes';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import MarkdownViewer from './components/MarkdownViewer';
import MarkdownEditor, { type MarkdownEditorSearchApi } from './components/MarkdownEditor';
import ConfirmModal from './components/ConfirmModal';
import SearchBar from './components/SearchBar';
import WelcomeScreen from './components/WelcomeScreen';
import StatusBar from './components/StatusBar';
import SettingsModal from './components/SettingsModal';
import { FontSelector, PaletteSelector } from './components/ToolbarSelectors';
import { ListTree } from 'lucide-react';

const PALETTE_KEYS = [
  '--pal-viewer-bg', '--pal-editor-bg', '--pal-editor-toolbar-bg', '--pal-panel-bg', '--pal-border-soft',
  '--pal-bg', '--pal-text', '--pal-link', '--pal-border', '--pal-muted',
  '--pal-blockquote-border', '--pal-blockquote-text', '--pal-code-bg', '--pal-code-text',
  '--pal-pre-bg', '--pal-pre-border', '--pal-th-bg', '--pal-th-border', '--pal-td-border',
  '--pal-tr-even-bg', '--pal-hr', '--pal-h6-text', '--pal-selection',
  '--pal-heading-border', '--pal-cb-bg', '--pal-cb-border',
  '--pal-cb-lang-bg', '--pal-cb-lang-text', '--pal-cb-btn-bg', '--pal-cb-btn-hover', '--pal-cb-btn-text',
];

const App: React.FC = () => {
  const {
    currentFile,
    currentFilePath,
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
    wordWrap,
    setWordWrap,
    matchToolbarPalette,
  } = useStore(useShallow((state) => ({
    currentFile: state.currentFile,
    currentFilePath: state.currentFilePath,
    viewMode: state.viewMode,
    isSidebarOpen: state.isSidebarOpen,
    isSearchOpen: state.isSearchOpen,
    theme: state.theme,
    isMaximized: state.isMaximized,
    setMaximized: state.setMaximized,
    setCurrentFile: state.setCurrentFile,
    setCurrentFilePath: state.setCurrentFilePath,
    setOriginalContent: state.setOriginalContent,
    setViewMode: state.setViewMode,
    setTheme: state.setTheme,
    toggleSidebar: state.toggleSidebar,
    setSearchOpen: state.setSearchOpen,
    setSearchQuery: state.setSearchQuery,
    fontFamily: state.fontFamily,
    setFontFamily: state.setFontFamily,
    zoomLevel: state.zoomLevel,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    setZoomLevel: state.setZoomLevel,
    previewPalette: state.previewPalette,
    setPreviewPalette: state.setPreviewPalette,
    recentFiles: state.recentFiles,
    wordWrap: state.wordWrap,
    setWordWrap: state.setWordWrap,
    matchToolbarPalette: state.matchToolbarPalette,
  })));

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const flushEditorRef = useRef<(() => void) | null>(null);
  const documentContentRef = useRef<HTMLDivElement>(null);
  const [documentRevealVersion, setDocumentRevealVersion] = useState(0);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // percentage
  const [distractionFree, setDistractionFree] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDropPath, setPendingDropPath] = useState<string | null>(null);
  const [dirtyModalOpen, setDirtyModalOpen] = useState(false);
  const [reloadModalOpen, setReloadModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'settings' | 'shortcuts' | 'about'>('settings');
  const [welcomeBackFile, setWelcomeBackFile] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [searchShowReplace, setSearchShowReplace] = useState(false);
  const pendingOpenAction = useRef<(() => void) | null>(null);
  const pendingFilePath = useRef<string | null>(null);
  const [syncScroll, setSyncScroll] = useState<'off' | 'position' | 'content'>('off');
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const paletteMenuRef = useRef<HTMLDivElement>(null);
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isSyncing = useRef(false); // prevent scroll feedback loop
  const editorScrollRef = useRef<HTMLElement | null>(null);
  const editorSearchApiRef = useRef<MarkdownEditorSearchApi | null>(null);
  const viewerScrollRef = useRef<HTMLElement | null>(null);
  const dragRatio = useRef(50); // ref for instant drag updates

  useLayoutEffect(() => {
    if (!documentRevealVersion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = documentContentRef.current?.animate(
      [{ opacity: 0.9 }, { opacity: 1 }],
      { duration: 320, easing: 'ease-out' },
    );
    return () => animation?.cancel();
  }, [documentRevealVersion]);

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

  // Helper: load file content into both store and editor (textarea/contentEditable)
  const loadFileIntoEditor = useCallback((name: string | null, filePath: string | null, content: string) => {
    const state = useStore.getState();
    const isNewDocument = state.currentFilePath !== filePath || state.currentFile !== name;
    // Save current scroll position before switching files
    if (state.currentFilePath && state.rememberScrollPosition && viewerScrollRef.current) {
      state.setScrollPosition(state.currentFilePath, viewerScrollRef.current.scrollTop);
    }
    setCurrentFile(name);
    setCurrentFilePath(filePath);
    setOriginalContent(content);
    // Restore scroll position if available (any file re-open)
    if (filePath && state.rememberScrollPosition) {
      const saved = state.scrollPositions[filePath];
      if (saved && saved > 800) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (viewerScrollRef.current) {
              viewerScrollRef.current.scrollTop = saved;
              setTimeout(() => setWelcomeBackFile(name), 500);
              setTimeout(() => setWelcomeBackFile(null), 5500);
            }
          });
        });
      }
    }
    // Force-sync the editor (uncontrolled textarea needs explicit update)
    if (editorScrollRef.current instanceof HTMLTextAreaElement) {
      editorScrollRef.current.value = content;
    } else if (editorScrollRef.current instanceof HTMLDivElement) {
      editorScrollRef.current.textContent = content;
    }
    if (isNewDocument) setDocumentRevealVersion(version => version + 1);
  }, []);
  const openWithDirtyCheck = useCallback((action: () => void) => {
    // Flush any pending debounced text to the store before checking
    flushEditorRef.current?.();
    const content = useStore.getState().fileContent;
    const original = useStore.getState().originalContent;
    const current = useStore.getState().currentFile;
    if (current && content !== original) {
      pendingOpenAction.current = action;
      setDirtyModalOpen(true);
    } else {
      action();
    }
  }, []);

  const handleOpen = useCallback(async () => {
    openWithDirtyCheck(async () => {
      const result = await window.markd?.openFile();
      if (result?.success && result.content !== undefined) {
        const name = result.filePath ? result.filePath.split(/[/\\]/).pop() || null : null;
        loadFileIntoEditor(name, result.filePath || null, result.content);
        if (result.filePath) useStore.getState().addRecentFile(result.filePath);
      }
    });
  }, [openWithDirtyCheck, loadFileIntoEditor]);

  const handleOpenFolder = useCallback(async () => {
    // Opening a folder doesn't close the current file, no dirty check needed
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
    flushEditorRef.current?.();
    const content = useStore.getState().fileContent;
    setSaveState('saving');
    const result = await window.markd?.saveFile(content, currentFilePath || undefined);
    if (result?.success) {
      setOriginalContent(content);
      if (result.filePath) {
        useStore.getState().addRecentFile(result.filePath);
        if (!currentFilePath) {
          setCurrentFilePath(result.filePath);
          setCurrentFile(result.filePath.split(/[/\\]/).pop() || null);
        }
      }
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } else {
      setSaveState('idle');
    }
  }, [currentFilePath]);

  const handleSaveAs = useCallback(async () => {
    flushEditorRef.current?.();
    const content = useStore.getState().fileContent;
    const result = await window.markd?.saveFileAs(content, currentFilePath || undefined);
    if (result?.success) {
      setCurrentFile(result.filePath ? result.filePath.split(/[/\\]/).pop() || null : null);
      setCurrentFilePath(result.filePath || null);
      setOriginalContent(content);
      if (result.filePath) useStore.getState().addRecentFile(result.filePath);
    }
  }, [currentFilePath]);

  const handleNewFile = useCallback(() => {
    openWithDirtyCheck(() => {
      loadFileIntoEditor('Untitled.md', null, '');
      setSearchQuery('');
      setViewMode('split');
    });
  }, [openWithDirtyCheck, loadFileIntoEditor]);

  const reloadFileFromDisk = useCallback(async (filePath: string) => {
    const result = await window.markd?.getFileContent(filePath);
    if (result?.success && result.content !== undefined) {
      loadFileIntoEditor(filePath.split(/[/\\]/).pop() || null, filePath, result.content);
      useStore.getState().refreshLinkedAssets();
    }
  }, [loadFileIntoEditor]);

  const handleCloseFile = useCallback(() => {
    openWithDirtyCheck(() => {
      // Save scroll position before clearing
      const state = useStore.getState();
      if (state.currentFilePath && state.rememberScrollPosition && viewerScrollRef.current) {
        state.setScrollPosition(state.currentFilePath, viewerScrollRef.current.scrollTop);
      }
      setCurrentFile(null);
      setCurrentFilePath(null);
      setOriginalContent('');
      useStore.setState({ fileContent: '' });
    });
  }, [openWithDirtyCheck]);

  const handleEditDocument = useCallback(() => {
    setDistractionFree(false);
    setViewMode('split');
  }, []);

  const handleToggleDF = useCallback(() => {
    if (!useStore.getState().currentFile) return;
    setDistractionFree(v => {
      if (!v && viewMode === 'split') {
        // Enabling DF from split → switch to preview first
        setViewMode('view');
      }
      return !v;
    });
  }, [viewMode]);

  const handleOpenRecentFile = useCallback((filePath: string) => {
      if (filePath === currentFilePath) {
        // Same file — show reload confirmation instead
        flushEditorRef.current?.();
        const content = useStore.getState().fileContent;
        const original = useStore.getState().originalContent;
        if (content !== original) {
          pendingFilePath.current = filePath;
          setReloadModalOpen(true);
        } else {
          reloadFileFromDisk(filePath);
        }
        return;
      }
    openWithDirtyCheck(async () => {
      const result = await window.markd?.getFileContent(filePath);
      if (result?.success && result.content !== undefined) {
        const name = filePath.split(/[/\\]/).pop() || null;
        loadFileIntoEditor(name, filePath, result.content);
        useStore.getState().addRecentFile(filePath);
      }
    });
  }, [openWithDirtyCheck, loadFileIntoEditor, currentFilePath, reloadFileFromDisk]);

  // Shared slugify — must match the one in MarkdownViewer
  const syncSlugify = (text: string) =>
    text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

  // Sync scroll handlers
  const handleEditorScroll = useCallback(() => {
    if (syncScroll === 'off' || isSyncing.current || !editorScrollRef.current || !viewerScrollRef.current) return;
    isSyncing.current = true;
    const editor = editorScrollRef.current;
    const viewer = viewerScrollRef.current;

    if (syncScroll === 'position') {
      const pct = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
      viewer.scrollTop = pct * (viewer.scrollHeight - viewer.clientHeight);
    } else if (syncScroll === 'content') {
      // Use actual line height from computed style
      const cs = getComputedStyle(editor);
      const lineHeight = parseInt(cs.lineHeight) || 24;
      const padTop = parseInt(cs.paddingTop) || 0;
      const effectiveScroll = Math.max(0, editor.scrollTop - padTop);
      const topLine = Math.floor(effectiveScroll / lineHeight);
      const content = useStore.getState().fileContent;
      const lines = content.split('\n');

      // Find the nearest heading above or at topLine
      let headingId: string | null = null;
      for (let i = Math.min(topLine, lines.length - 1); i >= 0; i--) {
        const match = lines[i].match(/^(#{1,6})\s+(.+)/);
        if (match) {
          headingId = syncSlugify(match[2]);
          break;
        }
      }

      if (headingId) {
        const el = viewer.querySelector(`[id="${headingId}"]`);
        if (el) {
          el.scrollIntoView({ block: 'start', behavior: 'auto' });
        } else {
          // Fallback: position-based if heading not found in preview
          const pct = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
          viewer.scrollTop = pct * (viewer.scrollHeight - viewer.clientHeight);
        }
      }
    }

    requestAnimationFrame(() => { isSyncing.current = false; });
  }, [syncScroll]);

  const handleViewerScroll = useCallback(() => {
    if (syncScroll === 'off' || isSyncing.current || !editorScrollRef.current || !viewerScrollRef.current) return;
    isSyncing.current = true;
    const editor = editorScrollRef.current;
    const viewer = viewerScrollRef.current;

    if (syncScroll === 'position') {
      const pct = viewer.scrollTop / (viewer.scrollHeight - viewer.clientHeight);
      editor.scrollTop = pct * (editor.scrollHeight - editor.clientHeight);
    } else if (syncScroll === 'content') {
      // Find the nearest heading above the viewport
      const headings = viewer.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]');
      let matchedId: string | null = null;
      const viewTop = viewer.scrollTop + 40;
      for (const h of headings) {
        if (h.offsetTop <= viewTop) {
          matchedId = h.id;
        } else {
          break;
        }
      }

      if (matchedId) {
        const content = useStore.getState().fileContent;
        const contentLines = content.split('\n');
        let found = false;
        for (let i = 0; i < contentLines.length; i++) {
          const match = contentLines[i].match(/^(#{1,6})\s+(.+)/);
          if (match && syncSlugify(match[2]) === matchedId) {
            const cs = getComputedStyle(editor);
            const lineHeight = parseInt(cs.lineHeight) || 24;
            const padTop = parseInt(cs.paddingTop) || 0;
            editor.scrollTop = Math.max(0, i * lineHeight - padTop);
            found = true;
            break;
          }
        }
        if (!found) {
          // Fallback to position-based
          const pct = viewer.scrollTop / (viewer.scrollHeight - viewer.clientHeight);
          editor.scrollTop = pct * (editor.scrollHeight - editor.clientHeight);
        }
      }
    }

    requestAnimationFrame(() => { isSyncing.current = false; });
  }, [syncScroll]);

  // Use refs so effects always get the latest handler without stale closures
  const handlersRef = useRef({ handleOpen, handleOpenFolder, handleSave, handleSaveAs, handleNewFile, handleCloseFile });
  handlersRef.current = { handleOpen, handleOpenFolder, handleSave, handleSaveAs, handleNewFile, handleCloseFile };

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

  // Startup: load file from query params (double-click open)
  // useLayoutEffect runs before paint — no sidebar flash in distraction-free mode
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    const df = params.get('distractionFree') === '1';

    if (df) {
      setDistractionFree(true);
      useStore.setState({ isSidebarOpen: false });
    }

    if (filePath) {
      // Set file name instantly so the UI reflects it immediately
      const name = filePath.split(/[/\\]/).pop() || null;
      setCurrentFile(name);
      setCurrentFilePath(filePath);
      setViewMode('view');
      // Load content asynchronously
      (async () => {
        const result = await window.markd?.getFileContent(filePath);
        if (result?.success && result.content !== undefined) {
          loadFileIntoEditor(name, filePath, result.content);
          useStore.getState().addRecentFile(filePath);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (!currentFile && distractionFree) setDistractionFree(false);
  }, [currentFile, distractionFree]);

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
          case 'w':
            e.preventDefault();
            h.handleCloseFile();
            break;
          case 'f':
            e.preventDefault();
            setSearchShowReplace(false);
            setSearchOpen(true);
            break;
          case 'h':
            e.preventDefault();
            setSearchShowReplace(true);
            setSearchOpen(true);
            break;
          case 't':
            e.preventDefault();
            setShowToc(v => !v);
            break;
          case ',':
            e.preventDefault();
            if (settingsOpen && settingsTab === 'settings') {
              setSettingsOpen(false);
            } else {
              setSettingsTab('settings');
              setSettingsOpen(true);
            }
            break;
          case '/':
            e.preventDefault();
            if (settingsOpen && settingsTab === 'shortcuts') {
              setSettingsOpen(false);
            } else {
              setSettingsTab('shortcuts');
              setSettingsOpen(true);
            }
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
              handleToggleDF();
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
  }, [theme, isMaximized, settingsOpen, settingsTab]);

  // Keep selector-to-selector clicks intact; close both only outside the toolbar menus.
  useEffect(() => {
    if (!showFontMenu && !showPaletteMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fontMenuRef.current?.contains(target) || paletteMenuRef.current?.contains(target)) return;
      setShowFontMenu(false);
      setShowPaletteMenu(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFontMenu(false);
        setShowPaletteMenu(false);
      }
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', handler), 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showFontMenu, showPaletteMenu]);

  // Drag-and-drop support
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    // In Electron, dropped files have a .path property
    const filePath = (file as any).path;
    if (!filePath) return;

    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext !== 'md' && ext !== 'markdown') return;

    // If a file is already loaded, check if it's the same file
    if (currentFile && currentFilePath) {
      if (filePath === currentFilePath) {
        // Same file — show reload confirmation if dirty
        flushEditorRef.current?.();
        const content = useStore.getState().fileContent;
        const original = useStore.getState().originalContent;
        if (content !== original) {
          pendingFilePath.current = filePath;
          setReloadModalOpen(true);
        } else {
          reloadFileFromDisk(filePath);
        }
        return;
      }
      setPendingDropPath(filePath);
      setConfirmOpen(true);
      return;
    }

    await loadDroppedFile(filePath);
  }, [currentFile, currentFilePath, reloadFileFromDisk]);

  const loadDroppedFile = useCallback(async (filePath: string) => {
    const result = await window.markd?.getFileContent(filePath);
    if (result?.success && result.content !== undefined) {
      const name = filePath.split(/[/\\]/).pop() || null;
      loadFileIntoEditor(name, filePath, result.content);
      useStore.getState().addRecentFile(filePath);
    }
  }, [loadFileIntoEditor]);

  const handleConfirmReplace = useCallback(async () => {
    setConfirmOpen(false);
    if (pendingDropPath) {
      await loadDroppedFile(pendingDropPath);
      setPendingDropPath(null);
    }
  }, [pendingDropPath, loadDroppedFile]);

  const handleCancelReplace = useCallback(() => {
    setConfirmOpen(false);
    setPendingDropPath(null);
  }, []);

  // Dirty-check modal handlers
  const handleDirtySave = useCallback(async () => {
    setDirtyModalOpen(false);
    flushEditorRef.current?.();
    const content = useStore.getState().fileContent;
    setSaveState('saving');
    const result = await window.markd?.saveFile(content, currentFilePath || undefined);
    if (result?.success) {
      setOriginalContent(content);
      if (result.filePath) useStore.getState().addRecentFile(result.filePath);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } else {
      setSaveState('idle');
    }
    pendingOpenAction.current?.();
    pendingOpenAction.current = null;
  }, []);

  const handleDirtyDiscard = useCallback(() => {
    setDirtyModalOpen(false);
    pendingOpenAction.current?.();
    pendingOpenAction.current = null;
  }, []);

  const handleDirtyCancel = useCallback(() => {
    setDirtyModalOpen(false);
    pendingOpenAction.current = null;
  }, []);

  const handleReloadConfirm = useCallback(async () => {
    setReloadModalOpen(false);
    const filePath = pendingFilePath.current;
    pendingFilePath.current = null;
    if (filePath) {
      await reloadFileFromDisk(filePath);
    }
  }, [reloadFileFromDisk]);

  // Set data-palette + dark class on <html> (tokens.css is the single source for --pal-*)
  useEffect(() => {
    const html = document.documentElement;

    // Dark class for Tailwind
    html.classList.toggle('dark', theme === 'dark');

    // data-palette attribute
    if (previewPalette !== 'default') {
      html.setAttribute('data-palette', previewPalette);
    } else {
      html.removeAttribute('data-palette');
    }

    // Clear any stale --pal-* inline styles so CSS cascade wins cleanly
    for (const key of PALETTE_KEYS) {
      html.style.removeProperty(key);
    }
  }, [theme, previewPalette]);

  // Sync match-palette attribute for CSS-driven border overrides
  useEffect(() => {
    if (matchToolbarPalette) {
      document.documentElement.setAttribute('data-match-palette', '');
    } else {
      document.documentElement.removeAttribute('data-match-palette');
    }
  }, [matchToolbarPalette]);

  // Listen for custom event from StatusBar to open shortcuts
  useEffect(() => {
    const handler = () => {
      setSettingsTab('shortcuts');
      setSettingsOpen(true);
    };
    window.addEventListener('markd:open-shortcuts', handler);
    return () => window.removeEventListener('markd:open-shortcuts', handler);
  }, []);

  // Save scroll position when app or tab closes
  useEffect(() => {
    const save = () => {
      const s = useStore.getState();
      if (s.currentFilePath && s.rememberScrollPosition && viewerScrollRef.current) {
        s.setScrollPosition(s.currentFilePath, viewerScrollRef.current.scrollTop);
      }
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, []);

  const activeDistractionFree = distractionFree && Boolean(currentFile);

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden ${activeDistractionFree ? 'relative' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
        onCloseFile={handleCloseFile}
        onReloadFile={() => { flushEditorRef.current?.(); const content = useStore.getState().fileContent; const original = useStore.getState().originalContent; if (content !== original) { pendingFilePath.current = currentFilePath; setReloadModalOpen(true); } else { pendingFilePath.current = currentFilePath; handleReloadConfirm(); } }}
        onOpenRecentFile={handleOpenRecentFile}
        recentFiles={recentFiles}
        distractionFree={activeDistractionFree}
        onToggleDistractionFree={handleToggleDF}
        onEditDocument={handleEditDocument}
        paletteBg={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bg || '#ffffff'}
        paletteBgDark={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bgDark || '#1a222b'}
        onSettings={() => { setSettingsTab('settings'); setSettingsOpen(true); }}
        saveState={saveState}
        matchToolbarPalette={matchToolbarPalette}
      />

      <div className={`flex flex-1 overflow-hidden ${activeDistractionFree ? '' : ''}`}>
        {/* Sidebar */}
        <div
          className={`${
            isSidebarOpen && !activeDistractionFree ? 'w-64' : 'w-0 -ml-px'
          } flex-shrink-0 border-r border-md-border dark:border-md-border-dark bg-md-surface dark:bg-md-surface-dark overflow-hidden flex flex-col transition-all duration-200`}
          style={matchToolbarPalette ? {
            backgroundColor: 'var(--pal-panel-bg)',
            borderColor: 'var(--pal-border)',
          } : undefined}
        >
          {isSidebarOpen && <Sidebar
            onOpenFile={handleOpen}
            onOpenPath={(path) => {
            if (path === currentFilePath) {
              flushEditorRef.current?.();
              const content = useStore.getState().fileContent;
              const original = useStore.getState().originalContent;
              if (content !== original) {
                pendingFilePath.current = path;
                setReloadModalOpen(true);
              } else {
                reloadFileFromDisk(path);
              }
              return;
            }
            openWithDirtyCheck(async () => {
              const result = await window.markd?.getFileContent(path);
              if (result?.success && result.content !== undefined) {
                const name = path.split(/[/\\]/).pop() || null;
                loadFileIntoEditor(name, path, result.content);
                useStore.getState().addRecentFile(path);
              }
            });
          }}
            matchPalette={matchToolbarPalette}
            paletteBg={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bg}
            paletteBgDark={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bgDark}
          />}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Toolbar */}
          {currentFile && !activeDistractionFree && (
            <div
              className={`flex items-center gap-0.5 px-2 h-10 border-b relative z-100 ${
                matchToolbarPalette
                  ? 'border-gray-300/40 dark:border-gray-600/40'
                  : 'border-gray-200/60 dark:border-gray-700/60'
              } bg-white/85 dark:bg-[#222c36]/85`}
              style={matchToolbarPalette ? {
                backgroundColor: 'var(--pal-panel-bg)',
                borderColor: 'var(--pal-border)',
              } : undefined}
            >
              {/* Sidebar toggle — always left-aligned */}
              {!isSidebarOpen && (
                <button className="btn-icon shrink-0" onClick={toggleSidebar} title="Open sidebar (Ctrl+B)">
                  <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M9 3.5v17M14 9l3 3l-3 3"/><path d="M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z"/></g></svg>
                </button>
              )}
              {/* Left spacer — pushes tools to center on lg+ */}
              <div className="flex-1 hidden lg:block" />
              {/* ---- View mode toggle group ---- */}
              <div className="flex rounded-md border border-slate-300 dark:border-gray-600 overflow-hidden mr-1 shrink-0">
                <button
                  className={`px-2.5 py-1 text-xs font-medium transition-colors border-r border-slate-300 dark:border-gray-600 ${viewMode === 'view' ? 'bg-slate-600/10 dark:bg-white/10 text-slate-800 dark:text-gray-100' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-500/10 dark:hover:bg-slate-100/10'}`}
                  onClick={() => setViewMode('view')}
                  title="Preview mode"
                >
                  {/* <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13c3.6-8 14.4-8 18 0" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a3 3 0 1 1 0-6a3 3 0 0 1 0 6" />
                  </svg> */}
                  {/* <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 1024 1024"><path fill="currentColor" d="m512 863.36l384-54.848v-638.72L525.568 222.72a96 96 0 0 1-27.136 0L128 169.792v638.72zM137.024 106.432l370.432 52.928a32 32 0 0 0 9.088 0l370.432-52.928A64 64 0 0 1 960 169.792v638.72a64 64 0 0 1-54.976 63.36l-388.48 55.488a32 32 0 0 1-9.088 0l-388.48-55.488A64 64 0 0 1 64 808.512v-638.72a64 64 0 0 1 73.024-63.36"/><path fill="currentColor" d="M480 192h64v704h-64z"/></svg> */}
                  {/* <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.75 7.21a2 2 0 0 1 2-2H8.5a3.5 3.5 0 0 1 3.5 3.5v10.885l-1.015-.721a4 4 0 0 0-2.318-.74H4.75a2 2 0 0 1-2-2zm18.5 0a2 2 0 0 0-2-2H15.5a3.5 3.5 0 0 0-3.5 3.5v10.885l1.015-.721a4 4 0 0 1 2.317-.74h3.918a2 2 0 0 0 2-2z"/></svg> */}
                  <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5.333 3c2.46-.003 4.836.887 6.667 2.5V21a10.07 10.07 0 0 0-6.667-2.5c-1.562 0-2.343 0-2.688-.22a1.16 1.16 0 0 1-.424-.425C2 17.51 2 16.895 2 15.663v-9.26c0-1.428 0-2.141.549-2.72c.548-.579 1.11-.609 2.234-.668Q5.056 3 5.333 3m13.334 0A10.07 10.07 0 0 0 12 5.5V21a10.07 10.07 0 0 1 6.667-2.5c1.562 0 2.343 0 2.688-.22c.207-.133.291-.218.424-.425c.221-.345.221-.96.221-2.192v-9.26c0-1.428 0-2.141-.549-2.72s-1.11-.609-2.234-.668Q18.944 3 18.667 3"/></svg>
                </button>
                <button
                  className={`px-2.5 py-1 text-xs font-medium transition-colors border-r border-slate-300 dark:border-gray-600 ${viewMode === 'edit' ? 'bg-slate-600/10 dark:bg-white/10 text-slate-800 dark:text-gray-100' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-500/10 dark:hover:bg-slate-100/10'}`}
                  onClick={() => setViewMode('edit')}
                  title="Edit mode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M16.443 7.328a.75.75 0 0 1 1.059-.056l1.737 1.564c.737.663 1.347 1.212 1.767 1.71c.44.525.754 1.088.754 1.784c0 .695-.313 1.258-.754 1.782c-.42.499-1.03 1.049-1.767 1.711l-1.737 1.564a.75.75 0 1 1-1.004-1.115l1.697-1.527c.788-.709 1.319-1.19 1.663-1.598c.33-.393.402-.622.402-.817c0-.196-.072-.425-.402-.818c-.344-.409-.875-.889-1.663-1.598l-1.697-1.527a.75.75 0 0 1-.056-1.06m-8.94 1.06a.75.75 0 0 0-1.004-1.115L4.761 8.836c-.737.663-1.347 1.212-1.767 1.71c-.44.525-.754 1.088-.754 1.784c0 .695.313 1.258.754 1.782c.42.499 1.03 1.049 1.767 1.711l1.737 1.564a.75.75 0 1 0 1.004-1.115l-1.697-1.527c-.788-.709-1.319-1.19-1.663-1.598c-.33-.393-.402-.622-.402-.817c0-.196.072-.425.402-.818c.344-.409.875-.889 1.663-1.598z"/><path fill="currentColor" d="M14.182 4.276a.75.75 0 0 1 .53.918l-3.974 14.83a.75.75 0 1 1-1.449-.389l3.974-14.83a.75.75 0 0 1 .919-.53" opacity=".5"/></svg>
                </button>
                <button
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === 'split' ? 'bg-slate-600/10 dark:bg-white/10 text-slate-800 dark:text-gray-100' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-500/10 dark:hover:bg-slate-100/10'}`}
                  onClick={() => setViewMode('split')}
                  title="Split mode"
                >
                  <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 18 18">
                    <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm8.5-1v12H14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm-1 0H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5.5z" />
                  </svg>
                </button>
              </div>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
              {/* Font selector */}
              <FontSelector
                open={showFontMenu}
                onOpenChange={setShowFontMenu}
                onCloseOther={() => setShowPaletteMenu(false)}
                matchToolbarPalette={matchToolbarPalette}
                menuRef={fontMenuRef}
                fontFamily={fontFamily}
                onFontChange={setFontFamily}
              />
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />
              {/* Palette selector */}
              <PaletteSelector
                open={showPaletteMenu}
                onOpenChange={setShowPaletteMenu}
                onCloseOther={() => setShowFontMenu(false)}
                matchToolbarPalette={matchToolbarPalette}
                menuRef={paletteMenuRef}
                previewPalette={previewPalette}
                onPaletteChange={setPreviewPalette}
              />
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
              {/* TOC button — invisible in edit mode to prevent layout shift */}
              <button
                className={`btn-icon ${viewMode === 'edit' ? 'opacity-0 pointer-events-none' : ''}`}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setShowToc(v => !v); }}
                title="Table of Contents (Ctrl+T)"
              >
                {/* <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M1 1v14h14V1zM0 0h16v16H0zm9 1v14h1V1zM3 3.5h4v-1H3zm0 3h4v-1H3zm0 3h4v-1H3z"/></svg> */}
                {/* Previous TOC icon:
                <svg className="w-[20px] h-[20px] shrink-0" fill="currentColor" viewBox="0 0 16 16">
                  <path  fill="currentColor" d="M 0,3 C 0,1.8954305 0.8954305,1 2,1 h 12 c 1.104569,0 2,0.8954305 2,2 v 10 c 0,1.104569 -0.895431,2 -2,2 H 2 C 0.8954305,15 0,14.104569 0,13 Z M 9.5,2 V 14 H 14 c 0.552285,0 1,-0.447715 1,-1 V 3 C 15,2.4477153 14.552285,2 14,2 Z m -1,0 H 2 C 1.4477153,2 1,2.4477153 1,3 v 10 c 0,0.552285 0.4477153,1 1,1 h 6.5 z"/>
                  <path className="opacity-70" d="M 3.1376953 4.0068359 C 2.8606956 4.0068359 2.6376953 4.2298362 2.6376953 4.5068359 C 2.6376953 4.7838357 2.8606956 5.0068359 3.1376953 5.0068359 L 6.6376953 5.0068359 C 6.914695 5.0068359 7.1376953 4.7838357 7.1376953 4.5068359 C 7.1376953 4.2298362 6.914695 4.0068359 6.6376953 4.0068359 L 3.1376953 4.0068359 z M 3.1376953 6.3574219 C 2.8606956 6.3574219 2.6376953 6.5804222 2.6376953 6.8574219 C 2.6376953 7.1344216 2.8606956 7.3574219 3.1376953 7.3574219 L 6.6376953 7.3574219 C 6.914695 7.3574219 7.1376953 7.1344216 7.1376953 6.8574219 C 7.1376953 6.5804222 6.914695 6.3574219 6.6376953 6.3574219 L 3.1376953 6.3574219 z M 3.1376953 8.7080078 C 2.8606956 8.7080078 2.6376953 8.9310081 2.6376953 9.2080078 C 2.6376953 9.4850075 2.8606956 9.7080078 3.1376953 9.7080078 L 6.6376953 9.7080078 C 6.914695 9.7080078 7.1376953 9.4850075 7.1376953 9.2080078 C 7.1376953 8.9310081 6.914695 8.7080078 6.6376953 8.7080078 L 3.1376953 8.7080078 z M 3.1376953 11.057617 C 2.8606956 11.057617 2.6376953 11.280617 2.6376953 11.557617 C 2.6376953 11.834617 2.8606956 12.057617 3.1376953 12.057617 L 6.6376953 12.057617 C 6.914695 12.057617 7.1376953 11.834617 7.1376953 11.557617 C 7.1376953 11.280617 6.914695 11.057617 6.6376953 11.057617 L 3.1376953 11.057617 z " />
                  </svg>
                */}
                <ListTree className="w-[20px] h-[20px] shrink-0" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* Content Area */}
          <div ref={contentRef} className="flex-1 overflow-hidden flex flex-col relative">
            {/* Search bar — contextual position per mode */}
            {isSearchOpen && (
              <div key="search-bar" className={`${viewMode === 'view'
                ? 'absolute top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl'
                : 'w-full'
              }`}>
                <SearchBar
                  editorRef={editorScrollRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
                  editorSearchApiRef={editorSearchApiRef as React.RefObject<MarkdownEditorSearchApi | null>}
                  viewerRef={viewerScrollRef as React.RefObject<HTMLDivElement | null>}
                  viewMode={viewMode}
                  position={viewMode === 'view' ? 'viewer-center' : 'editor-top'}
                  showReplaceInitially={searchShowReplace}
                />
              </div>
            )}
            <div key="document-content" ref={documentContentRef} className="flex-1 overflow-hidden flex">
            {!currentFile ? (
              <WelcomeScreen
                onOpen={handleOpen}
                onOpenFolder={handleOpenFolder}
                onNew={handleNewFile}
                onOpenSidebar={!isSidebarOpen ? toggleSidebar : undefined}
              />
            ) : (
              <>
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div
                    data-panel="editor"
                    className="flex flex-col min-w-0 relative z-10"
                    style={viewMode === 'split' ? { width: `${splitRatio}%` } : { flex: 1 }}
                  >
                    <MarkdownEditor
                      syncScroll={viewMode === 'edit' ? undefined : syncScroll}
                      onScrollRef={(el) => { editorScrollRef.current = el; }}
                      onSearchApiRef={(api) => { editorSearchApiRef.current = api; }}
                      onEditorScroll={handleEditorScroll}
                      onToggleSync={viewMode === 'edit' ? undefined : () => setSyncScroll(v => v === 'off' ? 'content' : v === 'content' ? 'position' : 'off')}
                      wordWrap={wordWrap}
                      onToggleWordWrap={() => setWordWrap(!wordWrap)}
                      onFlushRef={(fn) => { flushEditorRef.current = fn; }}
                      onSave={handleSave}
                      matchPalette={matchToolbarPalette}
                      paletteBg={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bg}
                      paletteBgDark={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bgDark}
                    />
                  </div>
                )}
                {viewMode === 'split' && (
                  <div
                    className="splitter w-1.5 flex-shrink-0 bg-[#e5e7eb] dark:bg-[#222c36] hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors active:bg-blue-500 border-l border-r border-gray-200 dark:border-gray-700/20"
                    onMouseDown={startDrag}
                    style={{
                      backgroundColor: matchToolbarPalette ? 'var(--pal-panel-bg)' : undefined,
                      borderColor: matchToolbarPalette ? 'var(--pal-border-soft)' : undefined,
                      ['--splitter-hover' as string]: matchToolbarPalette
                        ? 'color-mix(in srgb, var(--pal-muted) 15%, transparent)'
                        : 'transparent',
                    }}
                  >
                    <div className="w-full h-full" />
                  </div>
                )}
                {(viewMode === 'view' || viewMode === 'split') && (
                  <div
                    data-panel="viewer"
                    className="overflow-hidden relative"
                    style={viewMode === 'split' ? { flex: 1 } : { flex: 1 }}
                  >
                    <MarkdownViewer showToc={showToc} onToggleToc={() => setShowToc(false)} onOpenToc={() => setShowToc(true)} syncScroll={syncScroll} onScrollRef={(el) => { viewerScrollRef.current = el; }} onViewerScroll={handleViewerScroll} distractionFree={activeDistractionFree} />
                    {/* Welcome back toast — minimal, right-side, translucent */}
                    {welcomeBackFile && (
                      <div
                        className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl backdrop-blur-sm text-[13px] text-emerald-600 dark:text-emerald-400 shadow-lg animate-slide-in-right"
                        style={{ backgroundColor: theme === 'dark'
                          ? 'color-mix(in srgb, rgba(0, 0, 0, 0.78) 88%, var(--pal-viewer-bg) 12%)'
                          : 'color-mix(in srgb, rgba(255, 255, 255, 0.78) 88%, var(--pal-viewer-bg) 12%)' }}
                      >
                        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M20.5 15.8V8.2a1.91 1.91 0 0 0-.944-1.645l-6.612-3.8a1.88 1.88 0 0 0-1.888 0l-6.612 3.8A1.9 1.9 0 0 0 3.5 8.2v7.602a1.91 1.91 0 0 0 .944 1.644l6.612 3.8a1.88 1.88 0 0 0 1.888 0l6.612-3.8A1.9 1.9 0 0 0 20.5 15.8"/><path d="m8.667 12.633l1.505 1.721a1 1 0 0 0 1.564-.073L15.333 9.3"/></g></svg>
                        <span>Picked up where you left off</span>
                        <button
                          className="flex items-center gap-1 text-[12px] text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-3 pl-3 border-l border-gray-200 dark:border-gray-600"
                          onClick={() => {
                            if (viewerScrollRef.current) viewerScrollRef.current.scrollTop = 0;
                            setWelcomeBackFile(null);
                          }}
                        >
                          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M4.75 3.5a.75.75 0 0 1 0-1.5h14.5a.75.75 0 0 1 0 1.5zm.47 9.47a.749.749 0 1 0 1.06 1.06l4.97-4.969V21.25a.75.75 0 0 0 1.5 0V9.061l4.97 4.969a.749.749 0 1 0 1.06-1.06l-6.25-6.25a.75.75 0 0 0-1.06 0z"/></svg>
                          Go to top
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          </div>

          {/* Status Bar */}
          {currentFile && !activeDistractionFree && (
            <StatusBar
              matchPalette={matchToolbarPalette}
              paletteBg={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bg}
              paletteBgDark={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bgDark}
            />
          )}
        </div>
      </div>

      {/* Confirm modal for drag-and-drop replacement */}
      <ConfirmModal
        open={confirmOpen}
        title="Replace File"
        message={`Replace "${currentFile}" with "${pendingDropPath?.split(/[/\\]/).pop() || ''}"?\n\nUnsaved changes will be lost.`}
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onConfirm={handleConfirmReplace}
        onCancel={handleCancelReplace}
      />

      {/* Dirty-check modal for unsaved changes */}
      <ConfirmModal
        open={dirtyModalOpen}
        title="Unsaved Changes"
        message={`"${currentFile || 'Untitled'}" has unsaved changes. Would you like to save before proceeding?`}
        saveLabel="Save"
        confirmLabel="Discard"
        cancelLabel="Cancel"
        onSave={handleDirtySave}
        onConfirm={handleDirtyDiscard}
        onCancel={handleDirtyCancel}
      />

      {/* Reload confirmation — same file, different message */}
      <ConfirmModal
        open={reloadModalOpen}
        title="Reload File"
        message={`Reload "${currentFile}" from disk? Unsaved changes will be lost.`}
        confirmLabel="Reload"
        cancelLabel="Cancel"
        onConfirm={handleReloadConfirm}
        onCancel={() => setReloadModalOpen(false)}
      />

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsTab}
        onSyntaxHighlightChange={(enabled) => {
          flushEditorRef.current?.();
          useStore.getState().setSyntaxHighlight(enabled);
        }}
      />
    </div>
  );
};

export default App;
