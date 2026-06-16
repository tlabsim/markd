import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ViewMode, ThemeMode, FileEntry } from './types';
import { PALETTE_OPTIONS } from './palettes';

interface EditorState {
  // File state
  currentFile: string | null;
  currentFilePath: string | null;
  fileContent: string;
  originalContent: string;
  isModified: boolean;

  // Folder state
  currentFolderPath: string | null;
  /** Maps folder path to its children entries */
  folderChildren: Record<string, FileEntry[]>;
  expandedFolderPaths: Set<string>;

  // UI state
  viewMode: ViewMode;
  theme: ThemeMode;
  isSidebarOpen: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  isMaximized: boolean;

  // Preview settings
  fontFamily: string;
  zoomLevel: number;
  previewPalette: string;

  // Recent files
  recentFiles: string[];

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
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setMaximized: (maximized: boolean) => void;
  setFontFamily: (font: string) => void;
  setZoomLevel: (zoom: number) => void;
  setPreviewPalette: (palette: string) => void;
  addRecentFile: (path: string) => void;
  removeRecentFile: (path: string) => void;
  clearRecentFiles: () => void;
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
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
  { label: 'Crimson Pro', value: "'Crimson Pro', 'Times New Roman', Georgia, serif" },
  { label: 'Open Sans', value: "'Open Sans', Arial, sans-serif" },
  { label: 'Source Sans Pro', value: "'Source Sans Pro', Arial, sans-serif" },
  { label: 'Lora', value: 'Lora, Georgia, serif' },
  { label: 'Nunito', value: 'Nunito, Arial, sans-serif' },
  { label: 'Inter', value: "'Inter', 'Segoe UI', Arial, sans-serif" },
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
      currentFolderPath: null,
      folderChildren: {},
      expandedFolderPaths: new Set<string>(),
      viewMode: 'view',
      theme: 'dark',
      isSidebarOpen: true,
      isSearchOpen: false,
      searchQuery: '',
      isMaximized: false,
      fontFamily: 'system',
      zoomLevel: 100,
      previewPalette: 'default',
      recentFiles: [],

      setCurrentFile: (name) => set({ currentFile: name }),
      setCurrentFilePath: (path) => set({ currentFilePath: path }),
      setFileContent: (content) =>
        set({ fileContent: content, isModified: content !== get().originalContent }),
      setOriginalContent: (content) => set({ originalContent: content, fileContent: content, isModified: false }),
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
      setSearchOpen: (open) => set({ isSearchOpen: open }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setMaximized: (maximized) => set({ isMaximized: maximized }),
      setFontFamily: (font) => set({ fontFamily: font }),
      setZoomLevel: (zoom) => set({ zoomLevel: Math.max(50, Math.min(200, zoom)) }),
      setPreviewPalette: (palette) => set({ previewPalette: palette }),
      addRecentFile: (filePath) =>
        set((state) => {
          const filtered = state.recentFiles.filter((p) => p !== filePath);
          return { recentFiles: [filePath, ...filtered].slice(0, 10) };
        }),
      removeRecentFile: (filePath) =>
        set((state) => ({ recentFiles: state.recentFiles.filter((p) => p !== filePath) })),
      clearRecentFiles: () => set({ recentFiles: [] }),
      zoomIn: () => set((s) => ({ zoomLevel: Math.min(200, s.zoomLevel + 10) })),
      zoomOut: () => set((s) => ({ zoomLevel: Math.max(50, s.zoomLevel - 10) })),
    }),
    {
      name: 'markd-preferences',
      partialize: (state) => ({
        theme: state.theme,
        fontFamily: state.fontFamily,
        zoomLevel: state.zoomLevel,
        previewPalette: state.previewPalette,
        recentFiles: state.recentFiles,
      }),
    }
  )
);
