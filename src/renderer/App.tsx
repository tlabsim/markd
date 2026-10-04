import React, { useEffect, useCallback, useRef, useState, useLayoutEffect } from 'react';
import { useStore, FONT_OPTIONS } from './store';
import { useShallow } from 'zustand/react/shallow';
import { PALETTE_OPTIONS } from './palettes';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import type { MarkdownEditorSearchApi } from './components/MarkdownEditor';
import ConfirmModal from './components/ConfirmModal';
import SearchBar from './components/SearchBar';
import WelcomeScreen from './components/WelcomeScreen';
import StatusBar from './components/StatusBar';
import { FontSelector, PaletteSelector } from './components/ToolbarSelectors';
import { ListTree } from 'lucide-react';
import HourglassIcon from './components/HourglassIcon';

const loadMarkdownEditor = () => import('./components/MarkdownEditor');
const loadMarkdownViewer = () => import('./components/MarkdownViewer');
const loadSettingsModal = () => import('./components/SettingsModal');
const MarkdownEditor = React.lazy(loadMarkdownEditor);
const MarkdownViewer = React.lazy(loadMarkdownViewer);
const SettingsModal = React.lazy(loadSettingsModal);

const DocumentPanelFallback: React.FC = () => (
  <div className="h-full w-full animate-pulse bg-gray-100/40 dark:bg-white/[0.02]" aria-label="Loading document view" />
);

const PALETTE_KEYS = [
  '--pal-viewer-bg', '--pal-editor-bg', '--pal-editor-toolbar-bg', '--pal-panel-bg', '--pal-border-soft',
  '--pal-bg', '--pal-text', '--pal-link', '--pal-border', '--pal-muted',
  '--pal-blockquote-border', '--pal-blockquote-text', '--pal-code-bg', '--pal-code-text',
  '--pal-pre-bg', '--pal-pre-border', '--pal-th-bg', '--pal-th-border', '--pal-td-border',
  '--pal-tr-even-bg', '--pal-hr', '--pal-h6-text', '--pal-selection',
  '--pal-heading-border', '--pal-cb-bg', '--pal-cb-border',
  '--pal-cb-lang-bg', '--pal-cb-lang-text', '--pal-cb-btn-bg', '--pal-cb-btn-hover', '--pal-cb-btn-text',
];

type ScrollSyncMode = 'heading' | 'position' | 'off';
type DocumentNoticeKind = 'resume' | 'reloaded';

function scrollRange(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

const textareaHeadingCache = new WeakMap<HTMLElement, { content: string; signature: string; tops: number[] }>();
const richEditorHeadingCache = new WeakMap<HTMLElement, { content: string; signature: string; starts: string; tops: number[] }>();

function editorHeadingTops(editor: HTMLElement, content: string, starts: number[], lines: number[]): number[] {
  const style = getComputedStyle(editor);
  const lineHeight = parseFloat(style.lineHeight) || 24;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const fallback = lines.map(line => line * lineHeight + paddingTop);
  if (style.whiteSpace === 'pre') return fallback;

  if (editor instanceof HTMLTextAreaElement) {
    const signature = [editor.clientWidth, style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight,
      style.letterSpacing, style.padding, style.whiteSpace, style.overflowWrap, style.wordBreak, style.tabSize].join('|');
    const cached = textareaHeadingCache.get(editor);
    if (cached?.content === content && cached.signature === signature) return cached.tops;

    const mirror = document.createElement('textarea');
    mirror.rows = 1;
    mirror.wrap = editor.wrap;
    mirror.tabIndex = -1;
    mirror.setAttribute('aria-hidden', 'true');
    Object.assign(mirror.style, {
      position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden', pointerEvents: 'none',
      boxSizing: 'border-box', width: `${editor.clientWidth}px`, height: '0', minHeight: '0',
      border: '0', overflow: 'hidden', resize: 'none', padding: style.padding,
      fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
      fontStyle: style.fontStyle, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
      whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap, wordBreak: style.wordBreak,
      tabSize: style.tabSize, direction: style.direction,
    });
    document.body.appendChild(mirror);
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const tops = starts.map((start, index) => {
      mirror.value = content.slice(0, start);
      const measured = mirror.scrollHeight - paddingBottom - lineHeight;
      return Number.isFinite(measured) && measured >= 0 ? measured : fallback[index];
    });
    mirror.remove();
    textareaHeadingCache.set(editor, { content, signature, tops });
    return tops;
  }

  const signature = [editor.clientWidth, editor.scrollHeight, style.fontFamily, style.fontSize, style.fontWeight,
    style.lineHeight, style.letterSpacing, style.padding, style.whiteSpace].join('|');
  const renderedContent = editor.textContent || '';
  const startsKey = starts.join(',');
  const cached = richEditorHeadingCache.get(editor);
  if (cached?.content === renderedContent && cached.signature === signature && cached.starts === startsKey) return cached.tops;

  const tops = [...fallback];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const editorTop = editor.getBoundingClientRect().top;
  let node = walker.nextNode();
  let offset = 0;
  let heading = 0;
  while (node && heading < starts.length) {
    const length = node.textContent?.length || 0;
    while (length && heading < starts.length && starts[heading] >= offset && starts[heading] < offset + length) {
      const local = starts[heading] - offset;
      range.setStart(node, local);
      range.setEnd(node, Math.min(length, local + 1));
      const rect = range.getBoundingClientRect();
      if (rect.height) tops[heading] = rect.top - editorTop + editor.scrollTop;
      heading++;
    }
    offset += length;
    node = walker.nextNode();
  }
  richEditorHeadingCache.set(editor, { content: renderedContent, signature, starts: startsKey, tops });
  return tops;
}

function headingScrollAnchors(editor: HTMLElement, viewer: HTMLElement, content: string): Array<{ editor: number; viewer: number }> {
  // Both textarea values and rendered contentEditable text use LF line endings.
  const editorContent = content.replace(/\r\n?/g, '\n');
  const rendered = Array.from(viewer.querySelectorAll<HTMLElement>('.markdown-body h1[id], .markdown-body h2[id], .markdown-body h3[id], .markdown-body h4[id], .markdown-body h5[id], .markdown-body h6[id]'));
  const viewerTop = viewer.getBoundingClientRect().top;
  const matches: Array<{ start: number; line: number; viewer: HTMLElement }> = [];
  let renderedIndex = 0;
  let fence: string | null = null;
  let lineStart = 0;

  editorContent.split('\n').forEach((line, index) => {
    const start = lineStart;
    lineStart += line.length + 1;
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = null;
      return;
    }
    if (fence) return;
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/);
    if (!match) return;
    const text = match[1].replace(/!?(?:\[([^\]]+)\])\([^)]*\)/g, '$1').replace(/[`*_~]/g, '');
    const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    const found = rendered.findIndex((heading, position) => position >= renderedIndex && heading.id === id);
    if (found < 0) return;
    renderedIndex = found + 1;
    matches.push({ start, line: index, viewer: rendered[found] });
  });
  const tops = editorHeadingTops(editor, editorContent, matches.map(match => match.start), matches.map(match => match.line));
  return matches.map((match, index) => ({
    editor: tops[index],
    viewer: match.viewer.getBoundingClientRect().top - viewerTop + viewer.scrollTop,
  }));
}

function mappedScrollTop(source: HTMLElement, target: HTMLElement, anchors: Array<{ editor: number; viewer: number }>, from: 'editor' | 'viewer'): number {
  const sourceMax = scrollRange(source);
  const targetMax = scrollRange(target);
  if (!sourceMax || !targetMax) return 0;
  const top = Math.min(sourceMax, Math.max(0, source.scrollTop));
  if (!anchors.length) return top / sourceMax * targetMax;
  if (top === 0) return 0;
  if (top >= sourceMax) return targetMax;

  const to = from === 'editor' ? 'viewer' : 'editor';
  const points = [{ source: 0, target: 0 }, ...anchors.map(anchor => ({ source: anchor[from], target: anchor[to] }))
    .filter(point => point.source > 0 && point.source < sourceMax && point.target > 0 && point.target < targetMax),
  { source: sourceMax, target: targetMax }]
    .sort((a, b) => a.source - b.source);
  for (let index = 1; index < points.length; index++) {
    const end = points[index];
    if (top > end.source) continue;
    const start = points[index - 1];
    const span = end.source - start.source;
    let mapped = start.target + (span ? (top - start.source) / span * (end.target - start.target) : 0);
    const approaching = anchors.find(anchor => anchor[from] >= top && anchor[from] - top < 96 && anchor[to] < targetMax);
    if (approaching) {
      const distance = approaching[from] - top;
      const visibleTop = approaching[to] - distance;
      if (mapped > visibleTop) mapped -= (mapped - visibleTop) * (1 - distance / 96);
    }
    mapped = Math.min(targetMax, Math.max(0, mapped));
    // Leave a small safety margin when Preview drives the editor.
    if (from === 'viewer') mapped -= Math.min(32, mapped, targetMax - mapped);
    return mapped;
  }
  return targetMax;
}

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

  const flushEditorRef = useRef<(() => void) | null>(null);
  const documentContentRef = useRef<HTMLDivElement>(null);
  const [documentRevealVersion, setDocumentRevealVersion] = useState(0);
  const [editorDocumentVersion, setEditorDocumentVersion] = useState(0);
  const [settingsModuleMounted, setSettingsModuleMounted] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // percentage
  const [scrollSyncMode, setScrollSyncMode] = useState<ScrollSyncMode>('heading');
  const [distractionFree, setDistractionFree] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDropPath, setPendingDropPath] = useState<string | null>(null);
  const [dirtyModalOpen, setDirtyModalOpen] = useState(false);
  const [reloadModalOpen, setReloadModalOpen] = useState(false);
  const [externalReloadPrompt, setExternalReloadPrompt] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'settings' | 'shortcuts' | 'about'>('settings');
  const [documentNotice, setDocumentNotice] = useState<{ kind: DocumentNoticeKind; id: number } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [searchShowReplace, setSearchShowReplace] = useState(false);
  const [openingFilePath, setOpeningFilePath] = useState<string | null>(null);
  const [showFileLoading, setShowFileLoading] = useState(false);
  const pendingOpenAction = useRef<(() => void) | null>(null);
  const pendingFilePath = useRef<string | null>(null);
  const documentNoticeTimerRef = useRef<number>(0);
  const documentNoticeDelayRef = useRef<number>(0);
  const documentNoticeIdRef = useRef(0);
  const fileOpenRequestRef = useRef(0);
  const fileOpenLoadingTimerRef = useRef<number>(0);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const paletteMenuRef = useRef<HTMLDivElement>(null);
  const tocButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const paneScrollPositions = useRef<{ view?: number; edit?: number; splitEditor?: number; splitViewer?: number }>({});
  const lastPaneScrollIntent = useRef({ editor: -Infinity, viewer: -Infinity });
  const documentScrollVersion = useRef(0);
  const knownFileState = useRef<{ path: string; mtimeMs: number; size: number } | null>(null);
  const fileStateCheckInFlight = useRef(false);
  const fileStateGeneration = useRef(0);

  const refreshKnownFileState = useCallback(async (filePath: string | null) => {
    const generation = ++fileStateGeneration.current;
    if (!filePath) {
      knownFileState.current = null;
      return;
    }
    const result = await window.markd?.getFileState(filePath);
    if (generation === fileStateGeneration.current && result?.success && result.exists && result.mtimeMs !== undefined && result.size !== undefined) {
      knownFileState.current = { path: filePath, mtimeMs: result.mtimeMs, size: result.size };
    }
  }, []);

  const dismissDocumentNotice = useCallback(() => {
    clearTimeout(documentNoticeTimerRef.current);
    clearTimeout(documentNoticeDelayRef.current);
    setDocumentNotice(null);
  }, []);

  const showDocumentNotice = useCallback((kind: DocumentNoticeKind, duration = 5000) => {
    clearTimeout(documentNoticeTimerRef.current);
    clearTimeout(documentNoticeDelayRef.current);
    documentNoticeIdRef.current++;
    setDocumentNotice({ kind, id: documentNoticeIdRef.current });
    documentNoticeTimerRef.current = window.setTimeout(() => setDocumentNotice(null), duration);
  }, []);

  useEffect(() => () => {
    clearTimeout(documentNoticeTimerRef.current);
    clearTimeout(documentNoticeDelayRef.current);
    clearTimeout(fileOpenLoadingTimerRef.current);
  }, []);
  const [mountedPanes, setMountedPanes] = useState({ version: 0, editor: false, viewer: false });
  const changeViewModeRef = useRef<(mode: 'view' | 'edit' | 'split') => void>(() => {});
  const editorScrollRef = useRef<HTMLElement | null>(null);
  const editorSearchApiRef = useRef<MarkdownEditorSearchApi | null>(null);
  const viewerScrollRef = useRef<HTMLElement | null>(null);
  const dragRatio = useRef(50); // ref for instant drag updates

  const rememberPanePositions = useCallback(() => {
    const mode = useStore.getState().viewMode;
    if (mode !== 'view' && editorScrollRef.current) {
      const key = mode === 'split' ? 'splitEditor' : 'edit';
      paneScrollPositions.current[key] ??= editorScrollRef.current.scrollTop;
    }
    if (mode !== 'edit' && viewerScrollRef.current) {
      const key = mode === 'split' ? 'splitViewer' : 'view';
      paneScrollPositions.current[key] ??= viewerScrollRef.current.scrollTop;
    }
  }, []);

  const notePaneScrollIntent = useCallback((pane: 'editor' | 'viewer') => {
    lastPaneScrollIntent.current[pane] = performance.now();
  }, []);

  const syncSplitScroll = useCallback((pane: 'editor' | 'viewer') => {
    if (scrollSyncMode === 'off' || useStore.getState().viewMode !== 'split') return;
    const editor = editorScrollRef.current;
    const viewer = viewerScrollRef.current;
    if (!editor || !viewer) return;
    const source = pane === 'editor' ? editor : viewer;
    const target = pane === 'editor' ? viewer : editor;
    lastPaneScrollIntent.current[pane === 'editor' ? 'viewer' : 'editor'] = -Infinity;
    const anchors = scrollSyncMode === 'heading' ? headingScrollAnchors(editor, viewer, useStore.getState().fileContent) : [];
    target.scrollTop = mappedScrollTop(source, target, anchors, pane);
    paneScrollPositions.current[pane === 'editor' ? 'splitViewer' : 'splitEditor'] = target.scrollTop;
  }, [scrollSyncMode]);

  const capturePaneScroll = useCallback((pane: 'editor' | 'viewer', event: React.UIEvent<HTMLDivElement>) => {
    const element = pane === 'editor' ? editorScrollRef.current : viewerScrollRef.current;
    const mode = useStore.getState().viewMode;
    if (!element || event.target !== element || (pane === 'editor' ? mode === 'view' : mode === 'edit')) return;
    if (performance.now() - lastPaneScrollIntent.current[pane] > 1500) return;
    const key = pane === 'editor' ? (mode === 'split' ? 'splitEditor' : 'edit') : (mode === 'split' ? 'splitViewer' : 'view');
    paneScrollPositions.current[key] = element.scrollTop;
    if (mode === 'split') syncSplitScroll(pane);
  }, [syncSplitScroll]);

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

  const beginFileOpen = useCallback((filePath: string) => {
    const requestId = ++fileOpenRequestRef.current;
    clearTimeout(fileOpenLoadingTimerRef.current);
    setOpeningFilePath(filePath);
    setShowFileLoading(false);
    fileOpenLoadingTimerRef.current = window.setTimeout(() => {
      if (fileOpenRequestRef.current === requestId) setShowFileLoading(true);
    }, 160);
    return requestId;
  }, []);

  const finishFileOpen = useCallback((requestId: number, waitForDocumentPaint = false) => {
    if (fileOpenRequestRef.current !== requestId) return;
    clearTimeout(fileOpenLoadingTimerRef.current);
    const clearLoadingState = () => {
      if (fileOpenRequestRef.current !== requestId) return;
      setShowFileLoading(false);
      setOpeningFilePath(null);
    };
    if (waitForDocumentPaint) {
      requestAnimationFrame(() => requestAnimationFrame(clearLoadingState));
    } else {
      clearLoadingState();
    }
  }, []);

  const cancelFileOpen = useCallback(() => {
    fileOpenRequestRef.current++;
    clearTimeout(fileOpenLoadingTimerRef.current);
    setShowFileLoading(false);
    setOpeningFilePath(null);
  }, []);

  // Helper: load file content into both store and editor (textarea/contentEditable)
  const loadFileIntoEditor = useCallback((name: string | null, filePath: string | null, content: string) => {
    const state = useStore.getState();
    const isNewDocument = state.currentFilePath !== filePath || state.currentFile !== name;
    // Save current scroll position before switching files.
    if (state.currentFilePath && state.rememberScrollPosition && viewerScrollRef.current) {
      state.setScrollPosition(state.currentFilePath, viewerScrollRef.current.scrollTop);
    }
    if (isNewDocument || filePath === null || documentScrollVersion.current === 0) {
      dismissDocumentNotice();
      paneScrollPositions.current = {};
      lastPaneScrollIntent.current = { editor: -Infinity, viewer: -Infinity };
      documentScrollVersion.current++;
      if (editorScrollRef.current) editorScrollRef.current.scrollTop = 0;
    }
    setCurrentFile(name);
    setCurrentFilePath(filePath);
    setOriginalContent(content);
    setEditorDocumentVersion(version => version + 1);
    // Force-sync only the uncontrolled textarea. The highlighted contentEditable
    // owns its rendered HTML and synchronizes from the store in MarkdownEditor.
    if (editorScrollRef.current instanceof HTMLTextAreaElement) {
      editorScrollRef.current.value = content;
    }
    if (isNewDocument) setDocumentRevealVersion(version => version + 1);
  }, [dismissDocumentNotice]);
  const openWithDirtyCheck = useCallback((action: () => void) => {
    // Flush any pending debounced text to the store before checking
    flushEditorRef.current?.();
    const state = useStore.getState();
    if (state.currentFile && state.isModified) {
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
      await refreshKnownFileState(result.filePath || currentFilePath);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } else {
      setSaveState('idle');
    }
  }, [currentFilePath, refreshKnownFileState]);

  const handleSaveAs = useCallback(async () => {
    flushEditorRef.current?.();
    const content = useStore.getState().fileContent;
    const result = await window.markd?.saveFileAs(content, currentFilePath || undefined);
    if (result?.success) {
      setCurrentFile(result.filePath ? result.filePath.split(/[/\\]/).pop() || null : null);
      setCurrentFilePath(result.filePath || null);
      setOriginalContent(content);
      if (result.filePath) useStore.getState().addRecentFile(result.filePath);
      await refreshKnownFileState(result.filePath || null);
    }
  }, [currentFilePath, refreshKnownFileState]);

  const handleNewFile = useCallback(() => {
    openWithDirtyCheck(() => {
      cancelFileOpen();
      loadFileIntoEditor('Untitled.md', null, '');
      setSearchQuery('');
      setViewMode('split');
    });
  }, [openWithDirtyCheck, cancelFileOpen, loadFileIntoEditor]);

  const reloadFileFromDisk = useCallback(async (filePath: string) => {
    const result = await window.markd?.getFileContent(filePath);
    if (result?.success && result.content !== undefined) {
      loadFileIntoEditor(filePath.split(/[/\\]/).pop() || null, filePath, result.content);
      useStore.getState().refreshLinkedAssets();
      showDocumentNotice('reloaded');
      await refreshKnownFileState(filePath);
    }
  }, [loadFileIntoEditor, refreshKnownFileState, showDocumentNotice]);

  const handleOpenPath = useCallback((path: string, onMissing?: () => void) => {
    if (path === currentFilePath) {
      flushEditorRef.current?.();
      if (useStore.getState().isModified) {
        pendingFilePath.current = path;
        setReloadModalOpen(true);
      } else {
        void reloadFileFromDisk(path);
      }
      return;
    }

    openWithDirtyCheck(async () => {
      const requestId = beginFileOpen(path);
      try {
        const result = await window.markd?.getFileContent(path);
        if (fileOpenRequestRef.current !== requestId) return;
        if (!result?.success || result.content === undefined) {
          if (result && !result.alreadyOpen) onMissing?.();
          finishFileOpen(requestId);
          return;
        }

        // Large documents can spend most of their time parsing/rendering rather
        // than reading. Ensure the loading veil paints before that work begins.
        if (result.content.length >= 300_000) {
          clearTimeout(fileOpenLoadingTimerRef.current);
          setShowFileLoading(true);
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
          if (fileOpenRequestRef.current !== requestId) return;
        }

        const name = path.split(/[/\\]/).pop() || null;
        loadFileIntoEditor(name, path, result.content);
        useStore.getState().addRecentFile(path);
        finishFileOpen(requestId, true);
      } catch (error) {
        console.error('Unable to open file:', error);
        finishFileOpen(requestId);
      }
    });
  }, [beginFileOpen, currentFilePath, finishFileOpen, loadFileIntoEditor, openWithDirtyCheck, reloadFileFromDisk]);

  useEffect(() => {
    fileStateGeneration.current++;
    knownFileState.current = null;
    if (!currentFilePath) return;

    let active = true;
    const checkFileState = async (detectChanges: boolean) => {
      if (!active || fileStateCheckInFlight.current || document.visibilityState !== 'visible') return;
      fileStateCheckInFlight.current = true;
      const generation = ++fileStateGeneration.current;
      try {
        const result = await window.markd?.getFileState(currentFilePath);
        if (!active || generation !== fileStateGeneration.current || !result?.success || !result.exists || result.mtimeMs === undefined || result.size === undefined) return;

        const previous = knownFileState.current;
        const next = { path: currentFilePath, mtimeMs: result.mtimeMs, size: result.size };
        knownFileState.current = next;
        if (!detectChanges || !previous || previous.path !== currentFilePath) return;
        if (previous.mtimeMs === next.mtimeMs && previous.size === next.size) return;

        flushEditorRef.current?.();
        if (useStore.getState().isModified) {
          pendingFilePath.current = currentFilePath;
          setExternalReloadPrompt(true);
          setReloadModalOpen(true);
        } else {
          await reloadFileFromDisk(currentFilePath);
        }
      } finally {
        fileStateCheckInFlight.current = false;
      }
    };

    void checkFileState(false);
    const interval = window.setInterval(() => void checkFileState(true), 5000);
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkFileState(true);
    };
    window.addEventListener('focus', checkWhenVisible);
    document.addEventListener('visibilitychange', checkWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkWhenVisible);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [currentFilePath, reloadFileFromDisk]);

  const handleCloseFile = useCallback(() => {
    openWithDirtyCheck(() => {
      cancelFileOpen();
      paneScrollPositions.current = {};
      lastPaneScrollIntent.current = { editor: -Infinity, viewer: -Infinity };
      documentScrollVersion.current++;
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
  }, [openWithDirtyCheck, cancelFileOpen]);

  const handleEditDocument = useCallback(() => {
    setDistractionFree(false);
    changeViewModeRef.current('split');
  }, []);

  const handleToggleDF = useCallback(() => {
    if (!useStore.getState().currentFile) return;
    setDistractionFree(v => {
      if (!v && viewMode === 'split') {
        // Enabling DF from split → switch to preview first
        changeViewModeRef.current('view');
      }
      return !v;
    });
  }, [viewMode]);

  const handleOpenRecentFile = useCallback((filePath: string) => {
      if (filePath === currentFilePath) {
        // Same file — show reload confirmation instead
        flushEditorRef.current?.();
        if (useStore.getState().isModified) {
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

  const changeViewMode = useCallback((mode: 'view' | 'edit' | 'split') => {
    if (mode === viewMode) return;
    if (viewMode !== 'split' && viewMode !== 'view') flushEditorRef.current?.();
    rememberPanePositions();
    lastPaneScrollIntent.current = { editor: -Infinity, viewer: -Infinity };
    setViewMode(mode);
  }, [viewMode, setViewMode, rememberPanePositions]);
  changeViewModeRef.current = changeViewMode;

  const activeDocumentVersion = documentScrollVersion.current;

  const handleViewerDocumentRendered = useCallback((version: number, filePath: string | null) => {
    if (version !== documentScrollVersion.current || !viewerScrollRef.current) return;
    const state = useStore.getState();
    const saved = filePath && state.rememberScrollPosition ? state.scrollPositions[filePath] : 0;
    viewerScrollRef.current.scrollTop = saved && saved > 800 ? saved : 0;
    if (saved && saved > 800) {
      clearTimeout(documentNoticeDelayRef.current);
      documentNoticeDelayRef.current = window.setTimeout(() => showDocumentNotice('resume'), 500);
    }
  }, [showDocumentNotice]);

  useLayoutEffect(() => {
    if (!currentFile) return;
    setMountedPanes(previous => {
      const sameDocument = previous.version === activeDocumentVersion;
      const editor = (sameDocument && previous.editor) || viewMode !== 'view';
      const viewer = (sameDocument && previous.viewer) || viewMode !== 'edit';
      return sameDocument && previous.editor === editor && previous.viewer === viewer
        ? previous
        : { version: activeDocumentVersion, editor, viewer };
    });
  }, [activeDocumentVersion, currentFile, viewMode]);

  useLayoutEffect(() => {
    if (!currentFile) return;
    const positions = paneScrollPositions.current;
    if (viewMode === 'view' && viewerScrollRef.current && positions.view !== undefined) {
      viewerScrollRef.current.scrollTop = positions.view;
    } else if (viewMode === 'edit' && editorScrollRef.current && positions.edit !== undefined) {
      editorScrollRef.current.scrollTop = positions.edit;
    } else if (viewMode === 'split') {
      if (editorScrollRef.current && positions.splitEditor !== undefined) editorScrollRef.current.scrollTop = positions.splitEditor;
      if (viewerScrollRef.current && positions.splitViewer !== undefined) viewerScrollRef.current.scrollTop = positions.splitViewer;
    }
  }, [activeDocumentVersion, viewMode]);

  const registerScrollPane = useCallback((pane: 'editor' | 'viewer', el: HTMLElement | null) => {
    if (pane === 'editor') editorScrollRef.current = el;
    else viewerScrollRef.current = el;
  }, []);

  const registerEditorScroll = useCallback((el: HTMLElement | null) => registerScrollPane('editor', el), [registerScrollPane]);
  const registerViewerScroll = useCallback((el: HTMLElement | null) => registerScrollPane('viewer', el), [registerScrollPane]);

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

  // Keep the main-process file registry aligned with this window, including
  // close-file transitions back to the Welcome screen.
  useEffect(() => {
    let active = true;
    void window.markd?.setWindowFile(currentFilePath).then((registered) => {
      if (active && currentFilePath && !registered) void window.markd?.closeWindow();
    });
    return () => { active = false; };
  }, [currentFilePath]);

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
        } else if (result?.alreadyOpen) {
          // The owning window was restored and focused by the main process.
          void window.markd?.closeWindow();
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
        if (useStore.getState().isModified) {
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
    setExternalReloadPrompt(false);
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
  const visibleEditor = viewMode !== 'view';
  const visibleViewer = viewMode !== 'edit';
  const sameDocumentMounted = mountedPanes.version === activeDocumentVersion;
  const renderEditor = visibleEditor || (sameDocumentMounted && mountedPanes.editor);
  const renderViewer = visibleViewer || (sameDocumentMounted && mountedPanes.viewer);

  useEffect(() => {
    if (settingsOpen) setSettingsModuleMounted(true);
  }, [settingsOpen]);

  useEffect(() => {
    if (currentFile) void import('./fonts').then(({ loadFontFamily }) => loadFontFamily(fontFamily));
  }, [currentFile, fontFamily]);

  // Keep first paint light, then warm the document chunks while Welcome is idle.
  useEffect(() => {
    if (currentFile) return;
    const preloadDocumentUi = () => {
      void Promise.all([loadMarkdownEditor(), loadMarkdownViewer()]);
    };
    if ('requestIdleCallback' in window) {
      const idle = window.requestIdleCallback(preloadDocumentUi, { timeout: 2500 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = globalThis.setTimeout(preloadDocumentUi, 1000);
    return () => globalThis.clearTimeout(timer);
  }, [currentFile]);

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
        onReloadFile={() => { flushEditorRef.current?.(); if (useStore.getState().isModified) { pendingFilePath.current = currentFilePath; setReloadModalOpen(true); } else { pendingFilePath.current = currentFilePath; handleReloadConfirm(); } }}
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
            onOpenPath={handleOpenPath}
            openingFilePath={openingFilePath}
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
                  onClick={() => changeViewMode('view')}
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
                  onClick={() => changeViewMode('edit')}
                  title="Edit mode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M16.443 7.328a.75.75 0 0 1 1.059-.056l1.737 1.564c.737.663 1.347 1.212 1.767 1.71c.44.525.754 1.088.754 1.784c0 .695-.313 1.258-.754 1.782c-.42.499-1.03 1.049-1.767 1.711l-1.737 1.564a.75.75 0 1 1-1.004-1.115l1.697-1.527c.788-.709 1.319-1.19 1.663-1.598c.33-.393.402-.622.402-.817c0-.196-.072-.425-.402-.818c-.344-.409-.875-.889-1.663-1.598l-1.697-1.527a.75.75 0 0 1-.056-1.06m-8.94 1.06a.75.75 0 0 0-1.004-1.115L4.761 8.836c-.737.663-1.347 1.212-1.767 1.71c-.44.525-.754 1.088-.754 1.784c0 .695.313 1.258.754 1.782c.42.499 1.03 1.049 1.767 1.711l1.737 1.564a.75.75 0 1 0 1.004-1.115l-1.697-1.527c-.788-.709-1.319-1.19-1.663-1.598c-.33-.393-.402-.622-.402-.817c0-.196.072-.425.402-.818c.344-.409.875-.889 1.663-1.598z"/><path fill="currentColor" d="M14.182 4.276a.75.75 0 0 1 .53.918l-3.974 14.83a.75.75 0 1 1-1.449-.389l3.974-14.83a.75.75 0 0 1 .919-.53" opacity=".5"/></svg>
                </button>
                <button
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === 'split' ? 'bg-slate-600/10 dark:bg-white/10 text-slate-800 dark:text-gray-100' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-500/10 dark:hover:bg-slate-100/10'}`}
                  onClick={() => changeViewMode('split')}
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
            <div key="document-content" ref={documentContentRef} className="relative flex-1 min-w-0 overflow-hidden flex">
            {!currentFile ? (
              <WelcomeScreen
                onOpen={handleOpen}
                onOpenFolder={handleOpenFolder}
                onNew={handleNewFile}
                onOpenSidebar={!isSidebarOpen ? toggleSidebar : undefined}
              />
            ) : (
              <>
                {renderEditor && (
                  <div
                    data-panel="editor"
                    className="flex flex-col min-w-0 relative z-10"
                    onWheelCapture={() => notePaneScrollIntent('editor')}
                    onPointerDownCapture={() => notePaneScrollIntent('editor')}
                    onPointerMoveCapture={(event) => { if (event.buttons) notePaneScrollIntent('editor'); }}
                    onTouchStartCapture={() => notePaneScrollIntent('editor')}
                    onKeyDownCapture={() => notePaneScrollIntent('editor')}
                    onScrollCapture={(event) => capturePaneScroll('editor', event)}
                    style={visibleEditor
                      ? (viewMode === 'split' ? { width: `${splitRatio}%` } : { flex: 1 })
                      : { position: 'absolute', inset: 0, width: '100%', height: '100%', visibility: 'hidden', pointerEvents: 'none' }}
                  >
                    <React.Suspense fallback={<DocumentPanelFallback />}>
                      <MarkdownEditor
                        documentVersion={editorDocumentVersion}
                        isActive={visibleEditor}
                        isSplitView={viewMode === 'split'}
                        scrollSyncMode={scrollSyncMode}
                        onScrollSyncModeChange={setScrollSyncMode}
                        onScrollRef={registerEditorScroll}
                        onSearchApiRef={(api) => { editorSearchApiRef.current = api; }}
                        wordWrap={wordWrap}
                        onToggleWordWrap={() => setWordWrap(!wordWrap)}
                        onFlushRef={(fn) => { flushEditorRef.current = fn; }}
                        onSave={handleSave}
                        matchPalette={matchToolbarPalette}
                        paletteBg={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bg}
                        paletteBgDark={PALETTE_OPTIONS.find(o => o.value === previewPalette)?.bgDark}
                      />
                    </React.Suspense>
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
                {renderViewer && (
                  <div
                    data-panel="viewer"
                    className="overflow-hidden relative"
                    onWheelCapture={() => notePaneScrollIntent('viewer')}
                    onPointerDownCapture={() => notePaneScrollIntent('viewer')}
                    onPointerMoveCapture={(event) => { if (event.buttons) notePaneScrollIntent('viewer'); }}
                    onTouchStartCapture={() => notePaneScrollIntent('viewer')}
                    onKeyDownCapture={() => notePaneScrollIntent('viewer')}
                    onScrollCapture={(event) => capturePaneScroll('viewer', event)}
                    style={visibleViewer
                      ? { flex: 1 }
                      : { position: 'absolute', inset: 0, width: '100%', height: '100%', visibility: 'hidden', pointerEvents: 'none' }}
                  >
                    <React.Suspense fallback={<DocumentPanelFallback />}>
                      <MarkdownViewer
                        showToc={showToc}
                        onToggleToc={() => setShowToc(false)}
                        onOpenToc={() => setShowToc(true)}
                        onScrollRef={registerViewerScroll}
                        distractionFree={activeDistractionFree}
                        documentVersion={activeDocumentVersion}
                        onDocumentRendered={handleViewerDocumentRendered}
                      />
                    </React.Suspense>
                  </div>
                )}
              </>
            )}
            {documentNotice && currentFile && (
              <div
                key={documentNotice.id}
                role="status"
                aria-live="polite"
                className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl backdrop-blur-sm text-[13px] text-emerald-600 dark:text-emerald-400 shadow-lg animate-slide-in-right"
                style={{ backgroundColor: theme === 'dark'
                  ? 'color-mix(in srgb, rgba(0, 0, 0, 0.78) 88%, var(--pal-viewer-bg) 12%)'
                  : 'color-mix(in srgb, rgba(255, 255, 255, 0.78) 88%, var(--pal-viewer-bg) 12%)' }}
              >
                {documentNotice.kind === 'resume' ? (
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M20.5 15.8V8.2a1.91 1.91 0 0 0-.944-1.645l-6.612-3.8a1.88 1.88 0 0 0-1.888 0l-6.612 3.8A1.9 1.9 0 0 0 3.5 8.2v7.602a1.91 1.91 0 0 0 .944 1.644l6.612 3.8a1.88 1.88 0 0 0 1.888 0l6.612-3.8A1.9 1.9 0 0 0 20.5 15.8"/><path d="m8.667 12.633l1.505 1.721a1 1 0 0 0 1.564-.073L15.333 9.3"/></g></svg>
                ) : (
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M17.65 6.35a7.95 7.95 0 0 0-6.48-2.31c-3.67.37-6.69 3.35-7.1 7.02C3.52 15.91 7.27 20 12 20a7.98 7.98 0 0 0 7.21-4.56c.32-.67-.16-1.44-.9-1.44c-.37 0-.72.2-.88.53a5.994 5.994 0 0 1-6.8 3.31c-2.22-.49-4.01-2.3-4.48-4.52A6.002 6.002 0 0 1 12 6c1.66 0 3.14.69 4.22 1.78l-1.51 1.51c-.63.63-.19 1.71.7 1.71H19c.55 0 1-.45 1-1V6.41c0-.89-1.08-1.34-1.71-.71z"/></svg>
                )}
                <span>{documentNotice.kind === 'resume' ? 'Picked up where you left off' : 'File reloaded from disk'}</span>
                {documentNotice.kind === 'resume' && (
                  <button
                    className="flex items-center gap-1 text-[12px] text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-3 pl-3 border-l border-gray-200 dark:border-gray-600"
                    onClick={() => {
                      if (viewerScrollRef.current) viewerScrollRef.current.scrollTop = 0;
                      dismissDocumentNotice();
                    }}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M4.75 3.5a.75.75 0 0 1 0-1.5h14.5a.75.75 0 0 1 0 1.5zm.47 9.47a.749.749 0 1 0 1.06 1.06l4.97-4.969V21.25a.75.75 0 0 0 1.5 0V9.061l4.97 4.969a.749.749 0 1 0 1.06-1.06l-6.25-6.25a.75.75 0 0 0-1.06 0z"/></svg>
                    Go to top
                  </button>
                )}
              </div>
            )}
            {showFileLoading && openingFilePath && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 z-[70] flex items-center justify-center backdrop-blur-[1px]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--pal-viewer-bg) 72%, transparent)' }}
              >
                <div
                  className="flex min-w-52 max-w-[min(28rem,80%)] items-center gap-3 rounded-xl border px-4 py-3 shadow-lg"
                  style={{
                    color: 'var(--pal-text)',
                    backgroundColor: 'color-mix(in srgb, var(--pal-panel-bg) 94%, transparent)',
                    borderColor: 'var(--pal-border-soft)',
                  }}
                >
                  <HourglassIcon className="h-5 w-5 shrink-0 text-blue-500" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">Opening file</div>
                    <div className="truncate text-[11px]" style={{ color: 'var(--pal-muted)' }}>
                      {openingFilePath.split(/[/\\]/).pop() || openingFilePath}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>

          {/* Status Bar */}
          {currentFile && !activeDistractionFree && (
            <StatusBar
              onViewModeChange={changeViewMode}
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
        title={externalReloadPrompt ? 'File Changed on Disk' : 'Reload File'}
        message={externalReloadPrompt
          ? `"${currentFile}" changed outside Markd. Reload it? Your unsaved changes will be lost.`
          : `Reload "${currentFile}" from disk? Unsaved changes will be lost.`}
        confirmLabel="Reload"
        cancelLabel="Cancel"
        onConfirm={handleReloadConfirm}
        onCancel={() => {
          pendingFilePath.current = null;
          setExternalReloadPrompt(false);
          setReloadModalOpen(false);
        }}
      />

      {/* Settings modal */}
      {(settingsOpen || settingsModuleMounted) && (
        <React.Suspense fallback={null}>
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            initialTab={settingsTab}
            onSyntaxHighlightChange={(enabled) => {
              flushEditorRef.current?.();
              useStore.getState().setSyntaxHighlight(enabled);
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default App;
