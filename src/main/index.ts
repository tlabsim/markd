import { app, BrowserWindow, dialog, ipcMain, Menu, shell, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;

const isDev = !app.isPackaged;

// Required on Windows for proper taskbar grouping, notifications, and file association display name
app.setAppUserModelId('com.markd.app');
// Also set the process name that appears in Task Manager (works in packaged builds)
if (!isDev && process.platform === 'win32') {
  try {
    app.setName('Markd');
  } catch { /* best effort */ }
}

// ---- Settings file (JSON in user data) ----
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function readSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function writeSetting(key: string, value: unknown): void {
  const settings = readSettings();
  settings[key] = value;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// Read multi-instance preference before deciding behaviour
const settings = readSettings();
const multiInstance = settings.multiInstance === true;

if (multiInstance) {
  // Multi-instance: allow multiple windows, each second-instance creates a new window
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, argv) => {
      const cliFile = argv.find((arg, i) =>
        i > 0 && (arg.endsWith('.md') || arg.endsWith('.markdown')) && !arg.startsWith('-')
      );
      createWindow(cliFile);
    });
  }
} else {
  // Single-instance: reuse the existing window
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, argv) => {
      const cliFile = argv.find((arg, i) =>
        i > 0 && (arg.endsWith('.md') || arg.endsWith('.markdown')) && !arg.startsWith('-')
      );
      if (cliFile && mainWindow) {
        const params = new URLSearchParams();
        params.set('file', cliFile);
        params.set('distractionFree', '1');
        mainWindow.loadURL(`app://index.html?${params.toString()}`);
        mainWindow.focus();
      } else if (mainWindow) {
        mainWindow.focus();
      }
    });
  }
}

// Path to the dist/renderer directory
const rendererDir = isDev
  ? path.join(__dirname, '../../dist/renderer')
  : path.join(process.resourcesPath, 'renderer');

// Register privileged protocol so ES modules work (unlike file://)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'local-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// Register custom protocol to serve local files (images, etc.)
function registerLocalFileProtocol(): void {
  const mimeTypes: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
  };
  protocol.handle('local-file', (request) => {
    try {
      const encoded = request.url.replace(/^local-file:\/\/+\/?/, '');
      const filePath = decodeURIComponent(encoded);
      const resolved = path.resolve(filePath);
      const data = fs.readFileSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      return new Response(data, {
        headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}

// Serve built renderer files via app:// protocol
function registerAppProtocol(): void {
  protocol.handle('app', (request) => {
    try {
      const url = new URL(request.url);
      let reqPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!reqPath || reqPath.endsWith('/')) reqPath = 'index.html';
      const filePath = path.join(rendererDir, reqPath);
      // Use fs.readFileSync — works reliably inside ASAR in production
      const data = fs.readFileSync(filePath);
      const ext = path.extname(reqPath).toLowerCase();
      const mime: Record<string, string> = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff',
        '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json',
      };
      return new Response(data, { headers: { 'Content-Type': mime[ext] || 'application/octet-stream' } });
    } catch (e) {
      console.error('app:// serve error:', e);
      return new Response('Not found', { status: 404 });
    }
  });
}

function createWindow(filePath?: string): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    center: true,
    title: 'Markd',
    icon: isDev
      ? path.join(__dirname, '../../resources/markd.png')
      : path.join(process.resourcesPath, 'resources', 'markd.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#222c36',
  });

  const loadUrl = (base: string) => {
    const params = new URLSearchParams();
    if (filePath) params.set('file', filePath);
    params.set('distractionFree', filePath ? '1' : '0');
    const qs = params.toString();
    return `${base}${qs ? `?${qs}` : ''}`;
  };

  if (isDev) {
    net.fetch('http://localhost:5173/', { method: 'HEAD' }).then(() => {
      win.loadURL(loadUrl('http://localhost:5173'));
    }).catch(() => {
      win.loadURL(loadUrl('app://index.html'));
    });
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadURL(loadUrl('app://index.html'));
  }

  win.on('closed', () => {
    if (win === mainWindow) mainWindow = null;
  });

  win.on('maximize', () => {
    win.webContents.send('window-state-changed', 'maximized');
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-state-changed', 'normal');
  });

  // Each window registers its own menu
  setupMenu();

  // Track the first window for backwards compat, but allow multiple
  if (!mainWindow) mainWindow = win;
}

// Handle macOS open-file event (must be registered before app.whenReady)
app.on('open-file', (_event, filePath) => {
  if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
    createWindow(filePath);
  }
});

app.whenReady().then(() => {
  registerAppProtocol();
  registerLocalFileProtocol();

  // On Windows/Linux, check command line for file path
  const cliFile = process.argv.find((arg, i) =>
    i > 0 && (arg.endsWith('.md') || arg.endsWith('.markdown')) && !arg.startsWith('-')
  );

  createWindow(cliFile);
});

function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            win?.webContents.send('menu-action', 'new');
          },
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) openFile(win);
          },
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) openFolder(win);
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) saveFile(win);
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) saveFileAs(win);
          },
        },
        { type: 'separator' },
        {
          label: 'Export as HTML...',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) exportHtml(win);
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            win?.webContents.send('menu-action', 'find');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            win?.webContents.send('menu-action', 'toggle-theme');
          },
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            win?.webContents.send('menu-action', 'toggle-sidebar');
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Markd',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              dialog.showMessageBox(win, {
                type: 'info',
                title: 'About Markd',
                message: 'Markd v1.0.0',
                detail: 'A beautiful, feature-rich desktop markdown viewer and editor.\n\nBuilt with Electron, React, and TypeScript.',
              });
            }
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('open-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  return await openFile(win);
});

ipcMain.handle('open-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  return await openFolder(win);
});

ipcMain.handle('save-file', async (event, content: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'No window' };
  return await saveFile(win, content);
});

ipcMain.handle('save-file-as', async (event, content: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'No window' };
  return await saveFileAs(win, content);
});

ipcMain.handle('get-file-content', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-directory', async (_event, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')))
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: false,
      }));
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: true,
      }));
    return { success: true, files: [...directories, ...files], path: dirPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-local-file', async (_event, filePath: string) => {
  try {
    const resolved = path.resolve(filePath);
    const data = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
    };
    const mime = mimeTypes[ext] || 'application/octet-stream';
    const base64 = data.toString('base64');
    return { success: true, dataUrl: `data:${mime};base64,${base64}` };
  } catch {
    return { success: false };
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('documents');
});

// Settings IPC
ipcMain.handle('get-setting', (_event, key: string) => {
  return readSettings()[key] ?? null;
});

ipcMain.handle('set-setting', (_event, key: string, value: unknown) => {
  writeSetting(key, value);
});

ipcMain.handle('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.handle('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('window-is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});

ipcMain.handle('export-html', async (event, { content, title }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  return await exportHtml(win, content, title);
});

async function openFile(senderWindow: BrowserWindow): Promise<{ success: boolean; content?: string; filePath?: string; error?: string } | null> {
  const result = await dialog.showOpenDialog(senderWindow, {
    title: 'Open Markdown File',
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    senderWindow.setTitle(`Markd - ${path.basename(filePath)}`);
    return { success: true, content, filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function openFolder(senderWindow: BrowserWindow): Promise<{ success: boolean; path?: string; error?: string } | null> {
  const result = await dialog.showOpenDialog(senderWindow, {
    title: 'Open Folder',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  return { success: true, path: result.filePaths[0] };
}

async function saveFile(senderWindow: BrowserWindow, content?: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (!currentFilePath) {
    return await saveFileAs(senderWindow, content);
  }

  try {
    if (content !== undefined) {
      fs.writeFileSync(currentFilePath, content, 'utf-8');
    }
    return { success: true, filePath: currentFilePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function saveFileAs(senderWindow: BrowserWindow, content?: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const result = await dialog.showSaveDialog(senderWindow, {
    title: 'Save Markdown File',
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };

  try {
    if (content !== undefined) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
    }
    currentFilePath = result.filePath;
    senderWindow.setTitle(`Markd - ${path.basename(result.filePath)}`);
    return { success: true, filePath: result.filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function exportHtml(senderWindow: BrowserWindow, content?: string, title?: string): Promise<{ success: boolean; filePath?: string; error?: string } | null> {
  if (!content) return null;

  const result = await dialog.showSaveDialog(senderWindow, {
    title: 'Export as HTML',
    filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }],
    defaultPath: title ? `${title}.html` : 'export.html',
  });

  if (result.canceled || !result.filePath) return null;

  try {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Markdown Export'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #1f2328;
    }
    pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d0d7de; padding: 8px; }
    blockquote { border-left: 4px solid #d0d7de; padding-left: 1rem; color: #656d76; }
  </style>
</head>
<body>${content}</body>
</html>`;
    fs.writeFileSync(result.filePath, htmlContent, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

ipcMain.handle('open-external', async (_event, url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await shell.openExternal(url);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
