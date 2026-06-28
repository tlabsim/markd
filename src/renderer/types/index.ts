export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FileResult {
  success: boolean;
  content?: string;
  filePath?: string;
  error?: string;
}

export interface DirectoryResult {
  success: boolean;
  files?: FileEntry[];
  path?: string;
  error?: string;
}

export interface MarkdAPI {
  openFile: () => Promise<FileResult | null>;
  openFolder: () => Promise<{ success: boolean; path?: string; error?: string } | null>;
  saveFile: (content: string, currentPath?: string) => Promise<FileResult>;
  saveFileAs: (content: string, currentPath?: string) => Promise<FileResult>;
  getSetting: (key: string) => Promise<unknown>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  getFileContent: (filePath: string) => Promise<FileResult>;
  readDirectory: (dirPath: string) => Promise<DirectoryResult>;
  getAppPath: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  exportHtml: (data: { content: string; title: string }) => Promise<FileResult | null>;
  openExternal: (url: string) => Promise<void>;
  locateOnDisk: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  resolveImagePath: (src: string, currentFilePath: string) => string;
  onMenuAction: (callback: (action: string) => void) => () => void;
  onWindowStateChanged: (callback: (state: string) => void) => () => void;
}

declare global {
  interface Window {
    markd: MarkdAPI;
  }
}

export type ViewMode = 'view' | 'edit' | 'split';
export type ThemeMode = 'light' | 'dark' | 'system';
