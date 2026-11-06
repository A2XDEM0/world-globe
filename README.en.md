# World Color Globe

[简体中文](README.md) · [繁體中文](README.zh-Hant.md) · **English** · [Français](README.fr.md) · [Русский](README.ru.md) · [Español](README.es.md)

A world globe you can drag, spin and zoom, and colour by country, by first-level region (province, state) or by second-level region (city, county). Click a country to open its flat map. There is a web build and a desktop app for macOS and Windows, and both run the same front-end code. The interface is available in Simplified Chinese and English.

![Globe view with the sample colours: Canada, Brazil, Mexico and others painted](docs/images/globe.jpg)

## What it does

### Spin, search, zoom

Drag to spin the globe; it keeps some momentum. Zoom with the scroll wheel, a pinch or the buttons at the top right, up to 10×. The arrow keys spin it too, and Enter applies the current action to the country in the centre of the view.

Type a Chinese or English name or a three-letter code into the search box at the top. Pick a result and the globe turns to that country's capital and zooms until the country roughly fills the view. Only the land around the capital counts, plus islands not much further out than the mainland reaches, so the United States is framed without Alaska and Denmark without Greenland. Small countries such as Vatican City or Singapore go straight to 10×. On long trips the view pulls back halfway and then closes in.

![After searching for Japan, the globe turns to Tokyo and frames all of Japan](docs/images/search.jpg)

### Painting

The top bar has two modes, **Paint** and **View**, and three units, **Country**, **Level 1** and **Level 2**. In Paint mode, a click gives the current unit the current colour and a second click takes it off. With Level 1 or Level 2 chosen, hovering over a country shows its region borders and the name and code of the region under the pointer. Whatever brush is selected, an Option-click (Alt-click on Windows) puts the unit straight back to unpainted.

Each colour has a name, a solid or striped style and a colour value. Region colours win over country colours. On the right you can type country names or region codes to paint many at once; entries that are not found are listed separately.

Second-level codes are the country code plus a number: Cook County, home of Chicago, is `USA-0628`. Numbers follow name order within each country, so they stay the same as long as the underlying data does. There are 49,340 of them worldwide, with no duplicates. First-level codes look like `USA.US-CA`.

### Flat maps

In View mode, clicking a country opens its flat map. The United States uses the Albers USA projection with Alaska and Hawaii insets; other countries use an Albers equal-area conic projection fitted to their extent, and Antarctica a polar equal-area projection. Territories far from the mainland go into small insets along the bottom, up to six; China's map has a South China Sea inset in the bottom right. Flat maps zoom up to 12×, and more region names appear as you zoom in.

Below, the seven eastern German states are painted on their own. German regions are aligned to the 1951–1990 inner German border, so the painted edge falls exactly on it, and Berlin is split into West and East Berlin.

![Map of Germany: the eastern states in blue, their edge following the inner German border](docs/images/germany.jpg)

### Blocs and flags

Under **Blocs** on the right you can tick the EU, NATO, the Warsaw Pact, the CSTO, ASEAN, OPEC, the OAS and the Non-Aligned Movement. Each ticked bloc adds a layer of stripes to the map; countries in several blocs show their colours in turn. Expand a bloc to see its members' flags, their status and former members, or paint all members in the current colour with one click. The Warsaw Pact is shown by the territory of its time: the Soviet Union as its 15 successor states, East Germany as the eastern German states.

![Europe: NATO (teal stripes) and the Warsaw Pact (red stripes) overlaid](docs/images/blocs.jpg)

### Languages and themes

The top bar switches between Chinese and English. Buttons, hints, country and region names, flat-map labels and exported images all follow. Under **Base map** you can pick the system, light or dark theme. The theme changes the interface only, never the colours of the map itself.

![English interface with the dark theme, the globe turned to Asia](docs/images/dark.jpg)

### Export, backup and import

The current view can be saved as PNG or SVG, or copied as SVG code. The base map can show or hide first- and second-level region lines, region names (7–20 px), the graticule, and the inner German border with the West Berlin boundary. The ocean, background and unpainted-country colours can all be changed.

Where your colours are kept depends on the version:

- **Web:** every change is saved automatically in the browser's local storage. It lives in that one browser only and is lost if the site data is cleared. To back up, expand **Configuration JSON (back up or import)** at the bottom right and save its contents as a `.json` file. To restore, click **Import .json file**, or paste the contents back and click **Apply**. Undo keeps the last 60 steps and is cleared when the page reloads.
- **Desktop:** colours live in `.json` project files that you save yourself; the **File** menu has New, Open, Save, Save As and Open Recent. The format is the same on both sides, so a `.json` saved from the web build opens directly in the desktop app.

### Desktop app

The desktop app is the same page inside an Electron shell and works fully offline: map data, scripts and fonts are bundled with it, and a strict content security policy keeps the page off the network. On macOS the system title bar is hidden; the strip at the top of the window shows the file name, with a ● when there are unsaved changes.

![The macOS desktop app](docs/images/desktop.jpg)

## Borders

This project does not represent internationally recognised borders, nor the official position of any country.

## Data sources

| Content | Source | Licence |
|---|---|---|
| Country outlines, first-level regions, lakes, the first nine dashes | Natural Earth 1:10m 5.1.1 (including the China point-of-view edition) | Public domain |
| Second-level regions | geoBoundaries CGAZ ADM2 | CC BY 4.0 |
| Inner German border, West Berlin boundary (1951–1990) | OpenHistoricalMap relation 2692241 | CC0 |
| Capitals (where a search flies to) | Natural Earth 1:10m populated places, plus 19 small territories added by hand | Public domain |
| Flags | flag-icons | MIT |
| Position of the tenth dash | Based on Alibaba Cloud DataV geodata, approximate only | Terms not checked |

The map data is not kept in the repository; the scripts below download and build it.

## Running and building

You need Node.js (developed with version 24) and about 300 MB of disk space. The first time, run in order:

```sh
npm install
npm run fetch          # download the raw data into raw/, about 220 MB
npm run prepare-data   # build the intermediate files
npm run build          # build dist/data and dist/index.html, about 20 s
npm run serve          # local preview: http://127.0.0.1:8765/wrap.html
```

If you only changed files in `src/`, `npm run assemble` is enough; it builds the web page and the desktop page together. After changing the data processing rules, start again from `npm run build`.

Desktop: `npm run desktop` starts the app, and `npm run dist:mac` packages an Apple Silicon dmg and zip (about 125 MB each, 50 MB of which is map data) into `release/`. The app is not yet signed or notarised; the first time you open a copy on another Mac, right-click it and choose **Open**, or allow it under **System Settings › Privacy & Security**. `npm run dist:win` cross-builds the Windows x64 version on a Mac: an installer, `world-globe-1.0.0-x64-setup.exe` (about 100 MB), and a portable zip (about 140 MB). It is not signed either, so SmartScreen stops it on first run; click **More info**, then **Run anyway**.

The README screenshots come from `node scripts/screenshots.mjs <globe|search|germany|blocs|dark>`, with `npm run serve` running. The desktop one was taken by hand.

## How it works

The globe is drawn with WebGL2 in an orthographic projection, at 1:10m both while dragging and at rest, holding a steady 60 fps in all three drag tests; browsers without WebGL2 fall back to Canvas 2D. Hover highlights are drawn on a Canvas 2D layer, and flat maps are SVG so they export cleanly. Reading data, saving files and storing settings all go through `src/platform.js`, which has one implementation for the web and one for the desktop. Libraries: D3 7.9.0, TopoJSON and earcut 2.2.4.

Simplified country outlines are embedded in the page. The 1:10m outlines, the region lines and each country's first-level (210 files) and second-level (201 files) data are separate files, loaded when a country is opened; about 50 MB in all.

The data is processed with mapshaper. The main steps:

1. Start from Natural Earth's country data, merge or split some units according to the custom borders, then cut out cross-border lakes.
2. Reassign first-level regions (with lakes cut out) to match, and split Berlin along the West Berlin boundary.
3. Align Germany's first- and second-level regions to OpenHistoricalMap's GDR polygon (`scripts/gdr-align.mjs`): each region keeps the side where most of its area lies, and slivers on the other side that touch the border go to the neighbour there with the longest shared edge. Amt Neuhaus is cut out of the second-level data and becomes its own region at both levels.
4. Second-level regions keep the country given in the data, except where borders were adjusted or a region belongs to a different unit; those are reassigned by overlap area. The text encoding of the raw data is mixed, so each name is decoded as UTF-8 or Latin-1 individually.

Details of the WebGL rewrite, the desktop app, frame-rate tests and each version are in the [development log](docs/DEVLOG.md) (in Chinese).

## Layout

```
src/globe.html       page template; embedded data goes in at __GEO__
src/globe-gl.js      WebGL globe: sphere triangulation, shaders and drawing
src/platform.js      platform layer: reading data, saving files and settings for web and desktop
src/i18n.js          interface text in Chinese and English
src/blocs.js         blocs and their members (as of November 2026)
src/capitals.js      capital coordinates for each unit, made by scripts/capitals.mjs
desktop/             Electron shell: main.mjs (main process, menus, app:// protocol), preload.cjs
design/logo/         logo: build and export scripts, usage notes in GUIDE.md, finished files in kit/
docs/                development log and README screenshots
scripts/             download, processing, assembly, screenshot and preview scripts
  fetch-data.sh        download the raw data into raw/
  prepare.sh           build intermediate files from the raw data
  build.sh             build dist/data and assemble dist/index.html
  capitals.mjs         build src/capitals.js from Natural Earth
  flags.mjs            pack flag-icons flags per map unit into dist/data/flags.json
  gdr-align.mjs        align German regions to the inner German border, cut out Amt Neuhaus
  assemble.mjs         assemble dist/index.html and desktop/app/
  screenshots.mjs      take the README screenshots
  serve.mjs            local preview
test/                tests driving the local Chrome and Electron through puppeteer-core
  interactions.mjs     painting, code entry, migrating old settings
  denmark.mjs          flat-map insets
  webgl.mjs            WebGL drawing, clicks, hover, zoom, export, blocs and languages (run in batches)
  desktop.mjs          desktop app: project files, menus, export, content security policy
  bench.mjs            drag frame rate
  mesh.mjs             checks the sphere triangulation in Node
```

`raw/`, `work/`, `dist/`, `release/` and `desktop/app/` are generated and not kept in git.

## Licence

The code (`src/`, `desktop/`, `scripts/`, `test/`, `design/`) is released under the [GNU GPL 3.0](LICENSE): you may use, change and share it freely, but modified versions you distribute must also be released under GPL 3.0. Map data and flags are not in the repository; they are downloaded at build time, under the licences listed in "Data sources" above.
