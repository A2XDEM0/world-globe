// Platform layer. The page reads data (JSON, or raw bytes for the elevation bands), saves files and keeps its config only through `platform`:
// the web build uses relative fetch, the Artifact downloads capability and localStorage; the desktop build uses
// the interface the Electron preload exposes as window.globeHost (data comes over the app:// protocol, files through system dialogs,
// the config lives in a .json project file).
const platform = (() => {
  const STORE = 'world-globe-v1';
  const readJSON = path => fetch(path).then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });
  const readBytes = path => fetch(path).then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.arrayBuffer(); });
  const host = window.globeHost;
  if (host) {
    const handlers = {};
    host.onCommand((name, arg) => handlers[name] && handlers[name](arg));
    return {
      kind: 'desktop',
      // macOS: the window has no system title bar, the page draws the strip under the window controls
      titleBar: host.platform === 'darwin',
      data: readJSON,
      bytes: readBytes,
      files: async () => ({
        async save({ filename, data }) {
          const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(await data.arrayBuffer());
          const r = await host.saveFile(filename, bytes);
          if (r === 'declined') throw Object.assign(new Error('declined'), { code: 'declined' });
        }
      }),
      config: {
        load: () => host.project,
        // the config as the page normalized it, right after loading: the baseline for the unsaved mark
        baseline: cfg => host.projectBaseline(JSON.stringify(cfg)),
        store: cfg => host.projectChanged(JSON.stringify(cfg))
      },
      pref: (key, value) => host.pref(key, value),
      // commands from the main process: undo, png, svg, project (a newly opened or new project), title (file name and unsaved mark)
      on: (name, fn) => { handlers[name] = fn; }
    };
  }
  return {
    kind: 'web',
    titleBar: false,
    data: readJSON,
    bytes: readBytes,
    files: async () => window.claude && window.claude.use ? window.claude.use('downloads') : null,
    config: {
      load() { try { const raw = localStorage.getItem(STORE); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
      store(cfg) { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) {} },
      baseline() {}
    },
    pref(key, value) {
      try {
        if (value === undefined) return localStorage.getItem('world-globe-' + key);
        localStorage.setItem('world-globe-' + key, value);
      } catch (e) { return null; }
    },
    on() {}
  };
})();
