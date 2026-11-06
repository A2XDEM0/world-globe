// Electron main process for the desktop build. The page itself is the same front end as the web version (desktop/app, made by
// scripts/assemble.mjs); it reaches the disk only through the preload, and its files come over the app:// protocol.
import { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, net, protocol, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(HERE, 'app');
// packaged builds carry data/ as an extra resource; during development it is the web build's dist/data
const DATA_ROOT = app.isPackaged ? path.join(process.resourcesPath, 'data') : path.join(HERE, '..', 'dist', 'data');
const SETTINGS = () => path.join(app.getPath('userData'), 'settings.json');
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let win = null;
let settings = { recent: [], prefs: {}, lastDir: '' };
// the open project: its file (null when untitled), the page's config as last written and as it is now
const project = { file: null, saved: null, current: null, raw: null };
let quitting = false;

// menus, dialogs and the window title follow the language chosen in the page
const WORDS = {
  zh: {
    app: '世界色彩地球', untitled: '未命名', save: '保存', dontSave: '不保存', cancel: '取消', askSave: '要保存对“{name}”的修改吗？', askSaveDetail: '不保存的话，这些修改会丢失。',
    notProject: '这个文件里没有 cats 列表，不是世界色彩地球的配置。', projectKind: '世界色彩地球项目', cantOpen: '打不开 {name}', badJson: 'JSON 格式有误。', saveFailed: '没有保存成功',
    png: 'PNG 图片', svg: 'SVG 矢量图', badKind: '不支持的文件类型。', clearRecent: '清除列表', noRecent: '没有最近的文件',
    file: '文件', new: '新建', open: '打开…', recent: '最近打开', saveAs: '另存为…', exportPng: '导出 PNG…', exportSvg: '导出 SVG…', closeWindow: '关闭窗口',
    edit: '编辑', undo: '撤销', cut: '剪切', copy: '复制', paste: '粘贴', selectAll: '全选', viewMenu: '显示', reload: '重新载入', devTools: '开发者工具', fullScreen: '全屏', window: '窗口'
  },
  en: {
    app: 'World Color Globe', untitled: 'Untitled', save: 'Save', dontSave: 'Don’t Save', cancel: 'Cancel', askSave: 'Save the changes to “{name}”?', askSaveDetail: 'Your changes will be lost if you don’t save them.',
    notProject: 'This file has no cats list, so it is not a World Color Globe configuration.', projectKind: 'World Color Globe project', cantOpen: 'Can’t open {name}', badJson: 'The JSON is malformed.', saveFailed: 'The file could not be saved',
    png: 'PNG image', svg: 'SVG vector image', badKind: 'Unsupported file type.', clearRecent: 'Clear Menu', noRecent: 'No Recent Files',
    file: 'File', new: 'New', open: 'Open…', recent: 'Open Recent', saveAs: 'Save As…', exportPng: 'Export PNG…', exportSvg: 'Export SVG…', closeWindow: 'Close Window',
    edit: 'Edit', undo: 'Undo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', viewMenu: 'View', reload: 'Reload', devTools: 'Developer Tools', fullScreen: 'Full Screen', window: 'Window'
  }
};
const L = (key, v = {}) => WORDS[settings.prefs && settings.prefs.lang === 'en' ? 'en' : 'zh'][key].replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);

// tests (unpackaged, WG_TEST_DIR set) answer the dialogs themselves and drive the menu from here
const TEST = !app.isPackaged && process.env.WG_TEST_DIR ? { dir: process.env.WG_TEST_DIR, answer: 1, open: null, asked: [] } : null;
const dialogs = TEST ? {
  showSaveDialog: async (w, o) => ({ canceled: false, filePath: path.join(TEST.dir, path.basename(o.defaultPath)) }),
  showOpenDialog: async () => ({ canceled: !TEST.open, filePaths: [TEST.open] }),
  showMessageBox: async (w, o) => { TEST.asked.push(o.message); return { response: TEST.answer }; }
} : dialog;

function readSettings() {
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')) }; } catch (e) {}
  settings.recent = (settings.recent || []).filter(f => typeof f === 'string' && fs.existsSync(f)).slice(0, 10);
}
function writeSettings() {
  try { fs.mkdirSync(path.dirname(SETTINGS()), { recursive: true }); fs.writeFileSync(SETTINGS(), JSON.stringify(settings, null, 2)); } catch (e) {}
}
const dirty = () => project.current !== null && project.current !== project.saved;
function syncTitle() {
  if (!win) return;
  const name = project.file ? path.basename(project.file) : L('untitled');
  win.setTitle(`${dirty() ? '● ' : ''}${name} — ${L('app')}`);
  win.setDocumentEdited(dirty());
  win.setRepresentedFilename(project.file || '');
  // the title bar is hidden on macOS, so the page shows the name in its own strip
  send('title', { name, dirty: dirty() });
}
function remember(file) {
  settings.recent = [file, ...settings.recent.filter(f => f !== file)].slice(0, 10);
  settings.lastDir = path.dirname(file);
  writeSettings();
  app.addRecentDocument(file);
  buildMenu();
}

/* ---- the app:// protocol: page files from desktop/app, map data from data/ ---- */
function inside(root, rel) {
  const file = path.resolve(root, '.' + path.sep + rel);
  return file === root || file.startsWith(root + path.sep) ? file : null;
}
async function serve(request) {
  const url = new URL(request.url);
  if (url.host !== 'globe') return new Response('not found', { status: 404 });
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = rel.startsWith('data/') ? inside(DATA_ROOT, rel.slice(5)) : inside(APP_ROOT, rel);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('not found', { status: 404 });
  const res = await net.fetch(pathToFileURL(file).toString());
  return new Response(res.body, { status: 200, headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-security-policy': CSP, 'x-content-type-options': 'nosniff' } });
}

/* ---- project files: the existing config JSON, as is ---- */
function send(name, arg) { if (win) win.webContents.send('command', name, arg); }
async function confirmDiscard() {
  if (!dirty()) return true;
  const { response } = await dialogs.showMessageBox(win, {
    type: 'warning', buttons: [L('save'), L('dontSave'), L('cancel')], defaultId: 0, cancelId: 2,
    message: L('askSave', { name: project.file ? path.basename(project.file) : L('untitled') }), detail: L('askSaveDetail')
  });
  if (response === 2) return false;
  if (response === 0) return saveProject(false);
  return true;
}
function loadProjectFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.cats)) throw new Error(L('notProject'));
  return raw;
}
async function openProject(file) {
  if (!(await confirmDiscard())) return;
  if (!file) {
    const r = await dialogs.showOpenDialog(win, { defaultPath: settings.lastDir || app.getPath('documents'), filters: [{ name: L('projectKind'), extensions: ['json'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return;
    file = r.filePaths[0];
  }
  let raw;
  try { raw = loadProjectFile(file); } catch (e) {
    dialogs.showMessageBox(win, { type: 'error', message: L('cantOpen', { name: path.basename(file) }), detail: e instanceof SyntaxError ? L('badJson') : e.message });
    return;
  }
  Object.assign(project, { file, saved: null, current: null, raw });
  remember(file);
  send('project', raw);
  syncTitle();
}
async function newProject() {
  if (!(await confirmDiscard())) return;
  Object.assign(project, { file: null, saved: null, current: null, raw: null });
  send('project', null);
  syncTitle();
}
async function saveProject(as) {
  if (project.current === null) return true;
  let file = project.file;
  if (as || !file) {
    const r = await dialogs.showSaveDialog(win, { defaultPath: file || path.join(settings.lastDir || app.getPath('documents'), L('app') + '.json'), filters: [{ name: L('projectKind'), extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return false;
    file = r.filePath;
  }
  const text = JSON.stringify(JSON.parse(project.current), null, 2) + '\n';
  try { fs.writeFileSync(file, text); } catch (e) {
    dialogs.showMessageBox(win, { type: 'error', message: L('saveFailed'), detail: e.message });
    return false;
  }
  project.file = file;
  project.saved = project.current;
  remember(file);
  syncTitle();
  return true;
}

ipcMain.on('boot', e => { e.returnValue = { project: project.raw, prefs: settings.prefs || {} }; });
// the page reports its normalized config once after loading a project, so "unchanged" compares like with like
ipcMain.on('project:baseline', (e, json) => { project.saved = project.current = json; syncTitle(); });
ipcMain.on('project:changed', (e, json) => {
  project.current = json;
  project.raw = JSON.parse(json);
  syncTitle();
});
ipcMain.on('pref', (e, key, value) => {
  settings.prefs = { ...settings.prefs, [String(key)]: value };
  writeSettings();
  if (key === 'theme') applyTheme();
  if (key === 'lang') { buildMenu(); syncTitle(); }
});
// the page's theme choice also drives the window: background, window controls and the dialogs
const ground = () => nativeTheme.shouldUseDarkColors ? '#14171d' : '#eef0f3';
function applyTheme() {
  const t = settings.prefs && settings.prefs.theme;
  nativeTheme.themeSource = t === 'light' || t === 'dark' ? t : 'system';
}
nativeTheme.on('updated', () => { if (win) win.setBackgroundColor(ground()); });
ipcMain.handle('file:save', async (e, name, bytes) => {
  const ext = path.extname(String(name)).slice(1).toLowerCase();
  const kinds = { png: L('png'), svg: L('svg') };
  if (!kinds[ext] || !(bytes instanceof Uint8Array)) throw new Error(L('badKind'));
  const r = await dialogs.showSaveDialog(win, { defaultPath: path.join(settings.lastDir || app.getPath('documents'), path.basename(String(name))), filters: [{ name: kinds[ext], extensions: [ext] }] });
  if (r.canceled || !r.filePath) return 'declined';
  fs.writeFileSync(r.filePath, bytes);
  settings.lastDir = path.dirname(r.filePath);
  writeSettings();
  return 'saved';
});

/* ---- menu ---- */
function buildMenu() {
  const recent = settings.recent.length
    ? [...settings.recent.map(f => ({ label: path.basename(f), sublabel: path.dirname(f), click: () => openProject(f) })), { type: 'separator' }, { label: L('clearRecent'), click: () => { settings.recent = []; app.clearRecentDocuments(); writeSettings(); buildMenu(); } }]
    : [{ label: L('noRecent'), enabled: false }];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu', label: L('app') },
    { label: L('file'), submenu: [
      { label: L('new'), accelerator: 'CmdOrCtrl+N', click: newProject },
      { label: L('open'), accelerator: 'CmdOrCtrl+O', click: () => openProject() },
      { label: L('recent'), submenu: recent },
      { type: 'separator' },
      { label: L('save'), accelerator: 'CmdOrCtrl+S', click: () => saveProject(false) },
      { label: L('saveAs'), accelerator: 'Shift+CmdOrCtrl+S', click: () => saveProject(true) },
      { type: 'separator' },
      { label: L('exportPng'), accelerator: 'CmdOrCtrl+E', click: () => send('png') },
      { label: L('exportSvg'), accelerator: 'Shift+CmdOrCtrl+E', click: () => send('svg') },
      { type: 'separator' },
      { role: 'close', label: L('closeWindow') }
    ] },
    { label: L('edit'), submenu: [
      { label: L('undo'), accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
      { type: 'separator' },
      { role: 'cut', label: L('cut') }, { role: 'copy', label: L('copy') }, { role: 'paste', label: L('paste') }, { role: 'selectAll', label: L('selectAll') }
    ] },
    { label: L('viewMenu'), submenu: [{ role: 'reload', label: L('reload') }, { role: 'toggleDevTools', label: L('devTools') }, { type: 'separator' }, { role: 'togglefullscreen', label: L('fullScreen') }] },
    { role: 'windowMenu', label: L('window') }
  ]));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 960, minWidth: 720, minHeight: 560, show: false, backgroundColor: ground(),
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 13 } } : {}),
    webPreferences: { preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', syncTitle);
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://globe/')) e.preventDefault(); });
  win.on('close', async e => {
    if (quitting || !dirty()) return;
    e.preventDefault();
    if (await confirmDiscard()) { quitting = true; win.close(); }
  });
  win.on('closed', () => { win = null; });
  win.loadURL('app://globe/index.html');
  syncTitle();
}

// opening a .json from Finder, or a path on the command line (also used by the tests)
const argFile = process.argv.slice(1).find(a => a.endsWith('.json') && fs.existsSync(a));
let pendingFile = argFile ? path.resolve(argFile) : null;
app.on('open-file', (e, file) => { e.preventDefault(); if (win) openProject(file); else pendingFile = file; });

app.whenReady().then(() => {
  readSettings();
  applyTheme();
  // a packaged build takes its icon from the bundle; during development show the same one in the Dock
  if (!app.isPackaged && process.platform === 'darwin' && app.dock) app.dock.setIcon(path.join(HERE, '..', 'design', 'logo', 'kit', 'web', 'icon-512.png'));
  protocol.handle('app', serve);
  if (pendingFile) {
    try { Object.assign(project, { file: pendingFile, raw: loadProjectFile(pendingFile) }); remember(pendingFile); } catch (e) {}
  }
  buildMenu();
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});
if (TEST) {
  const item = (items, label) => { for (const m of items) { if (m.label === label) return m; const sub = m.submenu && item(m.submenu.items, label); if (sub) return sub; } return null; };
  app.setPath('userData', path.join(TEST.dir, 'userData'));
  globalThis.wgTest = { state: TEST, project, get settings() { return settings; }, click: label => item(Menu.getApplicationMenu().items, label).click(), title: () => win && win.getTitle(), close: () => win && win.close(), alive: () => !!win, theme: () => [nativeTheme.themeSource, nativeTheme.shouldUseDarkColors], menu: () => Menu.getApplicationMenu().items.map(m => m.label) };
}
app.on('before-quit', () => { if (!dirty()) quitting = true; });
app.on('window-all-closed', () => app.quit());
