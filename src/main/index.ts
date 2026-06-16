import { app, BrowserWindow, dialog, ipcMain, Menu, shell, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;

const isDev = !app.isPackaged;

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

  // Only set mainWindow for the first window
  if (!mainWindow) {
    mainWindow = win;
    setupMenu();
  }
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
          click: () => mainWindow?.webContents.send('menu-action', 'new'),
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile(),
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => openFolder(),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => saveFile(),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => saveFileAs(),
        },
        { type: 'separator' },
        {
          label: 'Export as HTML...',
          click: () => exportHtml(),
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
          click: () => mainWindow?.webContents.send('menu-action', 'find'),
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
          click: () => mainWindow?.webContents.send('menu-action', 'toggle-theme'),
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow?.webContents.send('menu-action', 'toggle-sidebar'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Markd',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Markd',
              message: 'Markd v1.0.0',
              detail: 'A beautiful, feature-rich desktop markdown viewer and editor.\n\nBuilt with Electron, React, and TypeScript.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('open-file', async () => {
  return await openFile();
});

ipcMain.handle('open-folder', async () => {
  return await openFolder();
});

ipcMain.handle('save-file', async (_event, content: string) => {
  return await saveFile(content);
});

ipcMain.handle('save-file-as', async (_event, content: string) => {
  return await saveFileAs(content);
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

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('export-html', async (_event, { content, title }) => {
  return await exportHtml(content, title);
});

async function openFile(): Promise<{ success: boolean; content?: string; filePath?: string; error?: string } | null> {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
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
    currentFilePath = filePath;
    mainWindow.setTitle(`Markd - ${path.basename(filePath)}`);
    return { success: true, content, filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function openFolder(): Promise<{ success: boolean; path?: string; error?: string } | null> {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Folder',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  return { success: true, path: result.filePaths[0] };
}

async function saveFile(content?: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (!currentFilePath) {
    return await saveFileAs(content);
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

async function saveFileAs(content?: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (!mainWindow) return { success: false, error: 'No window' };

  const result = await dialog.showSaveDialog(mainWindow, {
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
    mainWindow.setTitle(`Markd - ${path.basename(result.filePath)}`);
    return { success: true, filePath: result.filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function exportHtml(content?: string, title?: string): Promise<{ success: boolean; filePath?: string; error?: string } | null> {
  if (!mainWindow || !content) return null;

  const result = await dialog.showSaveDialog(mainWindow, {
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
