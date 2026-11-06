// The only bridge between the page and the main process. The page sees window.globeHost and nothing of Node or Electron.
const { contextBridge, ipcRenderer } = require('electron');

const boot = ipcRenderer.sendSync('boot');
const prefs = { ...boot.prefs };

contextBridge.exposeInMainWorld('globeHost', {
  project: boot.project,
  projectBaseline: json => ipcRenderer.send('project:baseline', String(json)),
  projectChanged: json => ipcRenderer.send('project:changed', String(json)),
  saveFile: (name, bytes) => ipcRenderer.invoke('file:save', String(name), bytes),
  pref(key, value) {
    if (value === undefined) return prefs[key] ?? null;
    prefs[key] = value;
    ipcRenderer.send('pref', String(key), value);
  },
  onCommand: fn => { ipcRenderer.on('command', (e, name, arg) => fn(name, arg)); }
});
