import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ViewMode, ThemeMode, FileEntry } from './types';
import { PALETTE_OPTIONS } from './palettes';

export const MAX_RECENT_FILES = 15;

export function sameDocumentContent(a: string, b: string): boolean {
  if (a === b) return true;

  let aIndex = 0;
  let bIndex = 0;
  while (aIndex < a.length && bIndex < b.length) {
    let aCode = a.charCodeAt(aIndex++);
    let bCode = b.charCodeAt(bIndex++);

    if (aCode === 13) {
      if (a.charCodeAt(aIndex) === 10) aIndex++;
      aCode = 10;
    } else if (aCode === 160) {
      aCode = 32;
    }

    if (bCode === 13) {
      if (b.charCodeAt(bIndex) === 10) bIndex++;
      bCode = 10;
    } else if (bCode === 160) {
      bCode = 32;
    }

    if (aCode !== bCode) return false;
  }

  return aIndex === a.length && bIndex === b.length;
}

interface EditorState {
  // File state
  currentFile: string | null;
  currentFilePath: string | null;
  fileContent: string;
  originalContent: string;
  isModified: boolean;
  saveRevision: number;

  // Folder state
  currentFolderPath: string | null;
  /** Maps folder path to its children entries */
  folderChildren: Record<string, FileEntry[]>;
  expandedFolderPaths: Set<string>;

  // UI state
  viewMode: ViewMode;
  theme: ThemeMode;
  isSidebarOpen: boolean;
  startWithSidebarOpen: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  searchCurrentIndex: number;
  searchUseRegex: boolean;
  searchCaseSensitive: boolean;
  isMaximized: boolean;

  // Preview settings
  fontFamily: string;
  zoomLevel: number;
  previewPalette: string;
  tocPinned: boolean;
  assetReloadToken: number;
  showSvgBackgroundToggle: boolean;

  // Recent files
  recentFiles: string[];

  // Editor preferences
  wordWrap: boolean;
  tabSize: number;
  syntaxHighlight: boolean;
  undoStackLimit: number;
  autoSave: boolean;
  rememberScrollPosition: boolean;
  /** Maps file path → last scrollTop */
  scrollPositions: Record<string, number>;
  matchToolbarPalette: boolean;
  showHeadingAnchors: boolean;

  // Actions
  setCurrentFile: (name: string | null) => void;
  setCurrentFilePath: (path: string | null) => void;
  setFileContent: (content: string) => void;
  setOriginalContent: (content: string) => void;
  setModified: (modified: boolean) => void;
  setCurrentFolderPath: (path: string | null) => void;
  setFolderChildren: (path: string, children: FileEntry[]) => void;
  clearFolderChildren: () => void;
  toggleExpandedFolder: (path: string) => void;
  isFolderExpanded: (path: string) => boolean;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setStartWithSidebarOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchCurrentIndex: (index: number) => void;
  setSearchUseRegex: (useRegex: boolean) => void;
  setSearchCaseSensitive: (caseSensitive: boolean) => void;
  setMaximized: (maximized: boolean) => void;
  setFontFamily: (font: string) => void;
  setZoomLevel: (zoom: number) => void;
  setPreviewPalette: (palette: string) => void;
  setTocPinned: (pinned: boolean) => void;
  refreshLinkedAssets: () => void;
  setShowSvgBackgroundToggle: (on: boolean) => void;
  addRecentFile: (path: string) => void;
  removeRecentFile: (path: string) => void;
  clearRecentFiles: () => void;
  setWordWrap: (wrap: boolean) => void;
  setTabSize: (size: number) => void;
  setSyntaxHighlight: (on: boolean) => void;
  setUndoStackLimit: (limit: number) => void;
  setAutoSave: (on: boolean) => void;
  setRememberScrollPosition: (on: boolean) => void;
  setScrollPosition: (filePath: string, scrollTop: number) => void;
  setShowHeadingAnchors: (on: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

const FONT_OPTIONS = [
  { label: 'System Default', value: 'system' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Sans-Serif', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Monospace', value: "'Courier New', monospace" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', Consolas, 'Courier New', monospace" },
  { label: 'Geist Mono', value: "'Geist Mono', 'SF Mono', 'Fira Code', monospace" },
  { label: 'Source Code Pro', value: "'Source Code Pro', 'Fira Code', Consolas, monospace" },
  { label: 'Inter', value: "'Inter', 'Segoe UI', Arial, sans-serif" },
  { label: 'Source Sans 3', value: "'Source Sans 3', Arial, sans-serif" },
  { label: 'Atkinson Hyperlegible Next', value: "'Atkinson Hyperlegible Next', Arial, sans-serif" },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
  { label: 'Source Serif 4', value: "'Source Serif 4', Georgia, serif" },
  { label: 'Crimson Pro', value: "'Crimson Pro', 'Times New Roman', Georgia, serif" },
  { label: 'Lora', value: 'Lora, Georgia, serif' },
  { label: 'Literata', value: 'Literata, Georgia, serif' },
];

export { FONT_OPTIONS, PALETTE_OPTIONS };

export const useStore = create<EditorState>()(
  persist(
    (set, get) => ({
      currentFile: null,
      currentFilePath: null,
      fileContent: '',
      originalContent: '',
      isModified: false,
      saveRevision: 0,
      currentFolderPath: null,
      folderChildren: {},
      expandedFolderPaths: new Set<string>(),
      viewMode: 'view',
      theme: 'dark',
      isSidebarOpen: true,
      startWithSidebarOpen: true,
      isSearchOpen: false,
      searchQuery: '',
      searchCurrentIndex: 0,
      searchUseRegex: false,
      searchCaseSensitive: false,
      isMaximized: false,
      fontFamily: 'system',
      zoomLevel: 100,
      previewPalette: 'default',
      tocPinned: false,
      assetReloadToken: 0,
      showSvgBackgroundToggle: true,
      recentFiles: [],
      wordWrap: true,
      tabSize: 4,
      syntaxHighlight: false,
      undoStackLimit: 256,
      autoSave: false,
      rememberScrollPosition: true,
      scrollPositions: {},
      matchToolbarPalette: true,
      showHeadingAnchors: false,

      setCurrentFile: (name) => set({ currentFile: name }),
      setCurrentFilePath: (path) => set({ currentFilePath: path }),
      setFileContent: (content) =>
        set({ fileContent: content, isModified: !sameDocumentContent(content, get().originalContent) }),
      setOriginalContent: (content) => set((state) => ({
        originalContent: content,
        fileContent: content,
        isModified: false,
        saveRevision: (state.saveRevision ?? 0) + 1,
      })),
      setModified: (modified) => set({ isModified: modified }),
      setCurrentFolderPath: (path) => set({ currentFolderPath: path }),
      setFolderChildren: (folderPath, children) =>
        set((state) => ({
          folderChildren: { ...state.folderChildren, [folderPath]: children },
        })),
      clearFolderChildren: () => set({ folderChildren: {}, expandedFolderPaths: new Set() }),
      toggleExpandedFolder: (path) => {
        const expanded = new Set(get().expandedFolderPaths);
        if (expanded.has(path)) {
          expanded.delete(path);
        } else {
          expanded.add(path);
        }
        set({ expandedFolderPaths: expanded });
      },
      isFolderExpanded: (path) => get().expandedFolderPaths.has(path),
      setViewMode: (mode) => set({ viewMode: mode }),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set({ isSidebarOpen: !get().isSidebarOpen }),
      setStartWithSidebarOpen: (open) => set({ startWithSidebarOpen: open }),
      setSearchOpen: (open) => set({ isSearchOpen: open }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchCurrentIndex: (index) => set({ searchCurrentIndex: index }),
      setSearchUseRegex: (useRegex) => set({ searchUseRegex: useRegex }),
      setSearchCaseSensitive: (caseSensitive) => set({ searchCaseSensitive: caseSensitive }),
      setMaximized: (maximized) => set({ isMaximized: maximized }),
      setFontFamily: (font) => set({ fontFamily: font }),
      setZoomLevel: (zoom) => set({ zoomLevel: Math.max(50, Math.min(200, zoom)) }),
      setPreviewPalette: (palette) => set({ previewPalette: palette }),
      setTocPinned: (pinned) => set({ tocPinned: pinned }),
      refreshLinkedAssets: () => set((s) => ({ assetReloadToken: s.assetReloadToken + 1 })),
      setShowSvgBackgroundToggle: (on) => set({ showSvgBackgroundToggle: on }),
      addRecentFile: (filePath) =>
        set((state) => {
          const filtered = state.recentFiles.filter((p) => p !== filePath);
          return { recentFiles: [filePath, ...filtered].slice(0, MAX_RECENT_FILES) };
        }),
      removeRecentFile: (filePath) =>
        set((state) => ({ recentFiles: state.recentFiles.filter((p) => p !== filePath) })),
      clearRecentFiles: () => set({ recentFiles: [] }),
      setWordWrap: (wrap) => set({ wordWrap: wrap }),
      setTabSize: (size) => set({ tabSize: size }),
      setSyntaxHighlight: (on) => set({ syntaxHighlight: on }),
      setUndoStackLimit: (limit) => set({ undoStackLimit: Math.max(10, Math.min(2000, Math.floor(limit))) }),
      setAutoSave: (on) => set({ autoSave: on }),
      setRememberScrollPosition: (on) => set({ rememberScrollPosition: on }),
      setScrollPosition: (filePath, scrollTop) =>
        set((s) => ({ scrollPositions: { ...s.scrollPositions, [filePath]: scrollTop } })),
      setShowHeadingAnchors: (on) => set({ showHeadingAnchors: on }),
      zoomIn: () => set((s) => ({ zoomLevel: Math.min(200, s.zoomLevel + 10) })),
      zoomOut: () => set((s) => ({ zoomLevel: Math.max(50, s.zoomLevel - 10) })),
    }),
    {
      name: 'markd-preferences',
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as EditorState;
        const fontReplacements: Record<string, string> = {
          "'Open Sans', Arial, sans-serif": "'Inter', 'Segoe UI', Arial, sans-serif",
          "'Source Sans Pro', Arial, sans-serif": "'Source Sans 3', Arial, sans-serif",
          'Nunito, Arial, sans-serif': "'Atkinson Hyperlegible Next', Arial, sans-serif",
        };
        return {
          ...state,
          fontFamily: fontReplacements[state.fontFamily] ?? state.fontFamily,
          matchToolbarPalette: true,
          startWithSidebarOpen: state.startWithSidebarOpen ?? true,
          showSvgBackgroundToggle: true,
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        startWithSidebarOpen: state.startWithSidebarOpen,
        fontFamily: state.fontFamily,
        zoomLevel: state.zoomLevel,
        previewPalette: state.previewPalette,
        tocPinned: state.tocPinned,
        showSvgBackgroundToggle: state.showSvgBackgroundToggle,
        recentFiles: state.recentFiles,
        wordWrap: state.wordWrap,
        tabSize: state.tabSize,
        syntaxHighlight: state.syntaxHighlight,
        undoStackLimit: state.undoStackLimit,
        autoSave: state.autoSave,
        rememberScrollPosition: state.rememberScrollPosition,
        scrollPositions: state.scrollPositions,
        showHeadingAnchors: state.showHeadingAnchors,
      }),
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<EditorState>) };
        merged.isSidebarOpen = merged.startWithSidebarOpen;
        return merged;
      },
    }
  )
);
