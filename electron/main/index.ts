import { app, BrowserWindow, shell, ipcMain, dialog, Notification } from "electron";
import { release } from "os";
import { join } from "path";
import { execSync, spawn } from "child_process";
import { autoUpdater } from "electron-updater";

import logger from "../utils/log";
import os from 'os';
import {
  getAccessToken, invalidateToken,
  uploadArticleImage, addImageMaterial, getImageMaterialList, deleteMaterial, addTempMedia,
  addDraft, updateDraft, getDraftList, getDraft, deleteDraft,
  publishDraft, getPublishStatus,
  type WechatConfig,
} from '../utils/wechat'
const pty = require('node-pty');


// Detect if git is available
function detectGit(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const gitAvailable = detectGit();

// Initialize electron-store for window state
const ElectronStore = require("electron-store");
const windowStateStore = new ElectronStore({ name: "window-state" });
ElectronStore.initRenderer();

// Disable GPU Acceleration for Windows 7
//if (release().startsWith("6.1")) app.disableHardwareAcceleration();
app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

export const ROOT_PATH = {
  // /dist
  dist: join(__dirname, "../.."),
  // /dist or /public
  public: join(__dirname, app.isPackaged ? "../.." : "../../../public"),
};

let win: BrowserWindow | null = null;
let ptyProcess: any = null;
// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.js");
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin
const url = `http://${process.env["VITE_DEV_SERVER_HOST"]}:${process.env["VITE_DEV_SERVER_PORT"]}`;
const indexHtml = join(ROOT_PATH.dist, "index.html");

// Default window state
const defaultWindowState = {
  width: 1200,
  height: 800,
  x: undefined as number | undefined,
  y: undefined as number | undefined,
  isMaximized: false,
};

// Get saved window state
function getWindowState() {
  return {
    width: windowStateStore.get("width", defaultWindowState.width) as number,
    height: windowStateStore.get("height", defaultWindowState.height) as number,
    x: windowStateStore.get("x", defaultWindowState.x) as number | undefined,
    y: windowStateStore.get("y", defaultWindowState.y) as number | undefined,
    isMaximized: windowStateStore.get("isMaximized", defaultWindowState.isMaximized) as boolean,
  };
}

// Save window state
function saveWindowState() {
  if (!win) return;

  const bounds = win.getBounds();
  windowStateStore.set("width", bounds.width);
  windowStateStore.set("height", bounds.height);
  windowStateStore.set("x", bounds.x);
  windowStateStore.set("y", bounds.y);
  windowStateStore.set("isMaximized", win.isMaximized());
}

async function createWindow() {
  const windowState = getWindowState();

  win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 900,
    minHeight: 600,

    title: "snowpub",
    icon: join(ROOT_PATH.public, "favicon.ico"),
    // useContentSize: true,
    frame: false,
    // maximizable: false,
    // minimizable: false,
    // fullscreenable: false,
    transparent: true,
    hasShadow: false,
    // resizable: false,
    webPreferences: {
      preload,
      webSecurity: false,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://electronjs.org/docs/latest/tutorial/contextIsolation
      nodeIntegration: true,
      contextIsolation: false,

    },
  });

  // Restore maximized state
  if (windowState.isMaximized) {
    win.maximize();
  }

  // Save window state on close
  win.on("close", () => {
    saveWindowState();
  });

  app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");
  if (app.isPackaged) {
    win.loadFile(indexHtml);
  } else {
    win.loadURL(url);
    win.webContents.openDevTools();
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
    win?.webContents.send("git-available", gitAvailable);
    // Check for updates after UI is ready (production only)
    if (app.isPackaged) {
      setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    }
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // 防止内容链接（如预览中的 markdown 链接）把主窗口导航走，导致编辑会话丢失
  win.webContents.on("will-navigate", (event, url) => {
    if (url === win.webContents.getURL()) return; // 允许同源刷新/锚点
    event.preventDefault();
    if (url.startsWith("https:") || url.startsWith("http:")) shell.openExternal(url);
  });
}

app.whenReady().then(createWindow);

app.on("before-quit", () => {
  if (ptyProcess) {
    try { ptyProcess.kill(); } catch (_) {}
    ptyProcess = null;
  }
});

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

ipcMain.on("min", (e) => win.minimize());
ipcMain.on("window-maximize", function () {
  if (win.isFullScreen()) {
    win.setFullScreen(false);
  } else if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});
ipcMain.on("close", (e) => win.close());
ipcMain.on("reload", (e) => win.reload());

// new window example arg: new windows url
ipcMain.handle("open-win", (event, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
    },
  });

  if (app.isPackaged) {
    childWindow.loadFile(indexHtml, { hash: arg });
  } else {
    childWindow.loadURL(`${url}/#${arg}`);
    childWindow.webContents.openDevTools({ mode: "undocked", activate: true });
  }
});

ipcMain.on("log.info", async (event, arg) => {
  logger.info(arg);
});
ipcMain.on("log.error", async (event, arg) => {
  logger.error(arg);
});

ipcMain.on("openLogs", async (event, arg) => {
  shell.openPath(logger.logger.transports.file.getFile().path);
});
ipcMain.on("openLogFolder", async (event, arg) => {
  shell.openPath(logger.logFolder);
});
ipcMain.on("showItemInFolder", async (event, arg) => {
  shell.showItemInFolder(arg);
});
ipcMain.on("openDevTools", async (event, arg) => {
  if (win.webContents.isDevToolsOpened()) {
    win.webContents.closeDevTools();
  } else {
    win.webContents.openDevTools({ mode: "undocked", activate: true });
  }
});

ipcMain.handle('get-git-available', () => gitAvailable);

ipcMain.on('open-dialog', (event) => {
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (!result.canceled) {
      event.sender.send('selected-directory', result.filePaths);
    }
  });
});

// 文件/目录选择对话框（返回路径，供配置面板使用）
ipcMain.handle('dialog:openFile', async (_event, options: any = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    ...options,
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openDirectory', async (_event, options: any = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    ...options,
  })
  return result.canceled ? null : result.filePaths[0]
})

// Terminal IPC handlers
ipcMain.on('terminal-open', (event, cwd: string) => {
  // Kill existing PTY if any
  if (ptyProcess) {
    try { ptyProcess.kill(); } catch (_) {}
    ptyProcess = null;
  }

  const isWindows = process.platform === 'win32';
  const shell = isWindows
    ? 'powershell.exe'
    : (process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'));
  const shellArgs = isWindows ? [] : ['-l'];
  const validCwd = cwd && require('fs').existsSync(cwd) ? cwd : os.homedir();

  // Augment PATH with common locations missing in Electron's env (Unix only)
  let env: NodeJS.ProcessEnv;
  if (isWindows) {
    env = { ...process.env };
  } else {
    const extraPaths = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ].join(':');
    env = {
      ...process.env,
      PATH: `${extraPaths}:${process.env.PATH || ''}`,
      TERM: 'xterm-256color',
    };
  }

  ptyProcess = pty.spawn(shell, shellArgs, {
    name: isWindows ? 'windows-terminal' : 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: validCwd,
    env,
  });

  ptyProcess.onData((data: string) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('terminal-output', data);
    }
  });

  ptyProcess.onExit(() => {
    ptyProcess = null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('terminal-exited');
    }
  });
});

ipcMain.on('terminal-input', (_event, data: string) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on('terminal-resize', (_event, cols: number, rows: number) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
});

// Git diff IPC handler
ipcMain.handle('git:diff', async (_event, { repoPath, hashA, hashB, filePath }: {
  repoPath: string, hashA: string, hashB: string | null, filePath: string
}) => {
  try {
    const rel = filePath.startsWith(repoPath) ? filePath.slice(repoPath.length + 1) : filePath
    // hashB null 表示与工作区当前文件对比
    const cmd = hashB
      ? `git diff ${hashA} ${hashB} -- "${rel}"`
      : `git diff ${hashA} -- "${rel}"`
    const result = execSync(cmd, { cwd: repoPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
    return { diff: result }
  } catch (e: any) {
    return { diff: e.stdout || '', error: e.message }
  }
})

ipcMain.handle('app:version', () => app.getVersion())

// ── Auto Updater ──────────────────────────────────────────────────────────────
autoUpdater.logger = logger;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  win?.webContents.send('updater:available', info);
});
autoUpdater.on('update-not-available', () => {
  // silent — no need to notify user
});
autoUpdater.on('download-progress', (progress) => {
  win?.webContents.send('updater:progress', progress);
});
autoUpdater.on('update-downloaded', (info) => {
  win?.webContents.send('updater:downloaded', info);
});
autoUpdater.on('error', (err) => {
  logger.error(`AutoUpdater error: ${err.message}`);
});

ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall(false, true));

// ── WeChat Official Account ───────────────────────────────────────────────────
// AppID/AppSecret persisted via electron-store (injected through renderer config),
// access_token cached in electron/utils/wechat.ts.

function readWechatConfig(): WechatConfig {
  return {
    appId: windowStateStore.get('wechat.appId', '') as string,
    appSecret: windowStateStore.get('wechat.appSecret', '') as string,
  }
}

ipcMain.handle('wechat:test', async (_event, { appId, appSecret }: WechatConfig) => {
  // Test connection with provided credentials without persisting them.
  invalidateToken(appId)
  try {
    const token = await getAccessToken({ appId, appSecret })
    return { ok: true, token: token.slice(0, 8) + '...' }
  } catch (e: any) {
    return { ok: false, errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:getConfig', () => {
  return readWechatConfig()
})

ipcMain.handle('wechat:saveConfig', (_event, { appId, appSecret }: WechatConfig) => {
  windowStateStore.set('wechat.appId', appId || '')
  windowStateStore.set('wechat.appSecret', appSecret || '')
  // Invalidate cached token when credentials change
  invalidateToken(appId)
  return { ok: true }
})

ipcMain.handle('wechat:uploadArticleImage', async (_event, filePath: string) => {
  try {
    return await uploadArticleImage(readWechatConfig(), filePath)
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:addImageMaterial', async (_event, filePath: string) => {
  try {
    return await addImageMaterial(readWechatConfig(), filePath)
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:addTempMedia', async (_event, filePath: string) => {
  try {
    return await addTempMedia(readWechatConfig(), filePath)
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:getImageMaterialList', async (_event, offset = 0, count = 20) => {
  try {
    return await getImageMaterialList(readWechatConfig(), offset, count)
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:deleteMaterial', async (_event, mediaId: string) => {
  try {
    await deleteMaterial(readWechatConfig(), mediaId)
    return { ok: true }
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:addDraft', async (_event, article: any) => {
  try {
    const mediaId = await addDraft(readWechatConfig(), article)
    return { ok: true, media_id: mediaId }
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:updateDraft', async (_event, mediaId: string, index: number, article: any) => {
  try {
    await updateDraft(readWechatConfig(), mediaId, index, article)
    return { ok: true }
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:getDraftList', async (_event, offset = 0, count = 20) => {
  try {
    return await getDraftList(readWechatConfig(), offset, count)
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:getDraft', async (_event, mediaId: string) => {
  try {
    return await getDraft(readWechatConfig(), mediaId)
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:deleteDraft', async (_event, mediaId: string) => {
  try {
    await deleteDraft(readWechatConfig(), mediaId)
    return { ok: true }
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:publish', async (_event, mediaId: string) => {
  try {
    const publishId = await publishDraft(readWechatConfig(), mediaId)
    return { ok: true, publish_id: publishId }
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

ipcMain.handle('wechat:getPublishStatus', async (_event, publishId: string) => {
  try {
    return await getPublishStatus(readWechatConfig(), publishId)
  } catch (e: any) {
    return { errcode: e.errcode, errmsg: e.errmsg || e.message }
  }
})

