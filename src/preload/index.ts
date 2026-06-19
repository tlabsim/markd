import { contextBridge, ipcRenderer } from 'electron';

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

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

// Minimal path utilities (no Node.js path module — preload is sandboxed)
function getDirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
}

function resolvePath(base: string, relative: string): string {
  const normalized = base.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const relParts = relative.replace(/\\/g, '/').split('/');
  for (const p of relParts) {
    if (p === '.' || p === '') continue;
    if (p === '..') { if (parts.length > 0) parts.pop(); }
    else parts.push(p);
  }
  return parts.join('/');
}

const api = {
  openFile: (): Promise<FileResult | null> => ipcRenderer.invoke('open-file'),
  openFolder: (): Promise<{ success: boolean; path?: string; error?: string } | null> =>
    ipcRenderer.invoke('open-folder'),
  saveFile: (content: string): Promise<FileResult> => ipcRenderer.invoke('save-file', content),
  saveFileAs: (content: string, currentPath?: string): Promise<FileResult> => ipcRenderer.invoke('save-file-as', content, currentPath),
  getFileContent: (filePath: string): Promise<FileResult> => ipcRenderer.invoke('get-file-content', filePath),
  readDirectory: (dirPath: string): Promise<DirectoryResult> => ipcRenderer.invoke('read-directory', dirPath),
  getAppPath: (): Promise<string> => ipcRenderer.invoke('get-app-path'),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: (): Promise<void> => ipcRenderer.invoke('window-maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window-close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
  exportHtml: (data: { content: string; title: string }): Promise<FileResult | null> =>
    ipcRenderer.invoke('export-html', data),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  getSetting: (key: string): Promise<unknown> => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke('set-setting', key, value),
  resolveImagePath: async (src: string, currentFilePath: string): Promise<string> => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return src;
    }
    const dir = getDirname(currentFilePath);
    const fullPath = resolvePath(dir, src);
    const result = await ipcRenderer.invoke('read-local-file', fullPath);
    if (result?.success && result.dataUrl) {
      return result.dataUrl;
    }
    return src;
  },
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action: string) => callback(action));
    return () => ipcRenderer.removeAllListeners('menu-action');
  },
  onWindowStateChanged: (callback: (state: string) => void) => {
    ipcRenderer.on('window-state-changed', (_event, state: string) => callback(state));
    return () => ipcRenderer.removeAllListeners('window-state-changed');
  },
};

contextBridge.exposeInMainWorld('markd', api);

export type MarkdAPI = typeof api;
