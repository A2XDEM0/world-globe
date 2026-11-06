# 世界色彩地球 · World Color Globe

**简体中文** · [繁體中文](README.zh-Hant.md) · [English](README.en.md) · [Français](README.fr.md) · [Русский](README.ru.md) · [Español](README.es.md)

一个可以拖动旋转、缩放的世界地球，能按国家、一级行政区（省、州）或二级行政区（市、县）分别上色，点国家可以打开它的平面地图。有网页版和 macOS 桌面版，两者共用同一份前端代码。

An interactive globe for colouring countries, states and counties, with per-country flat maps, bloc overlays and a Chinese / English interface. Web build plus an Electron app for macOS.

![地球视图：示例配色，涂了加拿大、巴西、墨西哥等国](docs/images/globe.jpg)

## 能做什么

### 转、找、放大

拖动可以旋转，有惯性；滚轮、双指或右上角的按钮可以缩放，最大 10 倍。方向键也能旋转，回车会对画面正中央的国家执行当前操作。

顶部的搜索框可以输入中文名、英文名或三位代码。选中后，地球会转到这个国家的首都，并放大到整个国家大致占满画面。这里只算首都所在的那片国土，以及离首都不比本土最远处远太多的岛屿，所以美国不算阿拉斯加，丹麦不算格陵兰。梵蒂冈、新加坡这样的小国会直接放大到 10 倍；距离较远时，途中会先拉远再拉近。

![搜索“日本”后，地球转到东京并放大到整个日本](docs/images/search.jpg)

### 涂色

顶部有“涂色 / 查看”两种模式，以及“国家 / 一级 / 二级”三种涂色单位。涂色模式下，点一下给当前单位上色，再点一次取消。选一级或二级时，鼠标停在国家上会显示它的行政区界线，以及所指区域的名称和代码。不管当前用的是哪支画笔，按住 Option（Windows 上是 Alt）点击，都会把这个单位直接还原。

每种颜色可以设置名称、纯色或斜线、颜色值，行政区的颜色会盖过国家的颜色。右侧可以直接输入国家名或行政区代码来批量上色，找不到的条目会单独列出。

二级行政区的代码是“国家代码-编号”，比如芝加哥所在的库克县是 `USA-0628`。编号在每个国家内按名称排序生成，底层数据不变，代码就不会变。全世界共 49,340 个，没有重复。一级行政区的代码写成 `USA.US-CA` 这样。

### 平面图

查看模式下点国家，会打开它的平面图。美国用 Albers USA 投影，带阿拉斯加和夏威夷插图；其他国家用按国家范围自动设参数的 Albers 等积圆锥投影，南极洲用极地等积投影。远离本土的领土放进底部的小插图，最多 6 个；中国平面图右下角有南海小图。平面图最大可以放大 12 倍，放大后会显示更多行政区名称。

下图给德国东部 7 个一级行政区单独上了色。德国的行政区沿 1951–1990 年的东西德分界线对齐过，涂色边缘正好落在分界线上，柏林也拆成了西柏林和东柏林。

![德国平面图：东部各州涂成蓝色，边缘沿东西德分界线](docs/images/germany.jpg)

### 阵营和国旗

右侧“阵营”里可以勾选欧盟、北约、华约、集安组织、东盟、欧佩克、美洲国家组织和不结盟运动。勾上的阵营会在地图上叠一层斜纹，同属几个阵营的国家各色轮流出现。展开可以看成员的国旗、成员状态和已退出的成员，还能一键把成员涂成当前颜色。华约按当年的地域显示：苏联取 15 个继承国，东德取德国东部各州。

![欧洲：北约（青绿斜纹）和华约（红色斜纹）叠加显示](docs/images/blocs.jpg)

### 中英文和主题

顶栏可以切换中文和英文，按钮、提示、国家名、行政区名、平面图标注和导出的图都会跟着换。“底图”里可以选跟随系统、浅色或深色主题。主题只改界面，不改地图本身的颜色。

![英文界面加深色主题，地球转到亚洲](docs/images/dark.jpg)

### 导出、备份和导入

当前视图可以导出成 PNG 或 SVG，也可以复制 SVG 代码。底图可以开关一级和二级行政区线、行政区名称（字号 7–20 像素）、经纬网，以及东西德分界线和西柏林边界；海洋、背景和未涂色国家的颜色都可以改。

配色的保存方式要看用的是哪个版本：

- **网页版**每次修改都会自动存进浏览器的本地存储，但只在这一个浏览器里，清除网站数据就没了。要备份，就展开右下角的“配置 JSON（备份或导入）”，复制里面的内容存成 `.json` 文件。恢复时点“导入 .json 文件”，或者把内容粘回去后点“应用”。撤销最多 60 步，刷新页面后清空。
- **桌面版**把配色存在你自己保存的 `.json` 项目文件里，“文件”菜单里有新建、打开、保存、另存为和最近打开。两边的格式相同，网页版存下来的 `.json` 可以直接用桌面版打开。

### 桌面版

桌面版是同一份页面套上 Electron 外壳，可以完全离线使用：地图数据、脚本和字体都打包在程序里，页面有严格的内容安全策略，不会访问外网。macOS 上隐藏了系统标题栏，窗口顶部那条显示文件名，有未保存的修改时会加一个 ●。

![macOS 桌面版](docs/images/desktop.jpg)

## 边界设定

本项目不代表国际公认边界，也不等同于任何一国的官方立场。

## 数据来源

| 内容 | 来源 | 许可 |
|---|---|---|
| 国家轮廓、一级行政区、湖泊、前九段线 | Natural Earth 1:10m 5.1.1（含中国视角版本） | 公有领域 |
| 二级行政区 | geoBoundaries CGAZ ADM2 | CC BY 4.0 |
| 东西德分界线、西柏林边界（1951–1990） | OpenHistoricalMap 关系 2692241 | CC0 |
| 各国首都（搜索时转到的位置） | Natural Earth 1:10m 有人口地区，另有 19 个小领地是手工补的 | 公有领域 |
| 国旗 | flag-icons | MIT |
| 第十段线的位置 | 参考阿里云 DataV 地理数据，只是近似 | 条款未核实 |

地图数据不放在仓库里，用下面的脚本下载、生成。

## 运行和构建

需要 Node.js（开发时用的是 24）、约 300MB 磁盘空间，第一次使用时按顺序运行：

```sh
npm install
npm run fetch          # 下载原始数据到 raw/，约 220MB
npm run prepare-data   # 生成中间文件
npm run build          # 生成 dist/data 和 dist/index.html，约 20 秒
npm run serve          # 本地预览：http://127.0.0.1:8765/wrap.html
```

只改了 `src/` 里的文件时，运行 `npm run assemble` 就够了，它会同时生成网页版和桌面版的页面。改了数据处理规则，要从 `npm run build` 开始重跑。

桌面版：`npm run desktop` 直接启动，`npm run dist:mac` 打包 Apple Silicon 版的 dmg 和 zip（各约 125MB，其中 50MB 是地图数据），输出到 `release/`。目前还没有签名和公证，复制到别的 Mac 上第一次打开时，要右键选择“打开”，或者在“系统设置 › 隐私与安全性”里放行。

README 里的截图由 `node scripts/screenshots.mjs <globe|search|germany|blocs|dark>` 生成，需要先运行 `npm run serve`。桌面版那张是手动截的。

## 实现方式

地球用 WebGL2 和正射投影绘制，拖动和静止都是 1:10m 精度，三种拖动情况都稳定在 60 帧；浏览器不支持 WebGL2 时退回 Canvas 2D。悬停高亮画在一层 Canvas 2D 上，平面图用 SVG 绘制，方便导出。读数据、保存文件和读写配置都经过 `src/platform.js`，网页版和桌面版各有一套实现。用到的库有 D3 7.9.0、TopoJSON 和 earcut 2.2.4。

简化后的国家轮廓直接嵌在页面里。1:10m 轮廓、行政区线，以及每个国家的一级（210 个文件）和二级（201 个文件）行政区数据是单独的文件，打开对应国家时才加载，总共约 50MB。

数据用 mapshaper 处理，主要步骤是：

1. 以 Natural Earth 的国家数据为底，按自定义边界合并或拆分部分单位，再扣掉跨国湖泊。
2. 用带湖泊镂空的一级行政区数据，按上面的设定重新分配归属，并用西柏林边界把柏林切成两半。
3. 德国的一级、二级行政区用 OpenHistoricalMap 的东德多边形对齐（`scripts/gdr-align.mjs`）：每个行政区保留大部分面积所在的一侧，贴着分界线、落在另一侧的碎块交给另一侧共享边界最长的邻区。诺伊豪斯从二级数据里切出来，在两级里都单独成块。
4. 二级行政区默认沿用数据自带的国家归属，只有边界做过调整或分属不同单位的地方，才按重叠面积重新判断。原始数据的文字编码是混杂的，名称要逐条按 UTF-8 或 Latin-1 解码。

WebGL 改造、桌面版、帧率测试和各版本的细节见 [开发记录](docs/DEVLOG.md)。

## 目录

```
src/globe.html       页面模板，__GEO__ 处会填入内嵌数据
src/globe-gl.js      WebGL 地球：球面三角化、着色器和绘制
src/platform.js      平台接口层：网页版和桌面版的读数据、保存文件、读写配置
src/i18n.js          中英文界面文字
src/blocs.js         阵营和成员（截至 2026 年 11 月）
src/capitals.js      各单位的首都坐标，由 scripts/capitals.mjs 生成
desktop/             Electron 外壳：main.mjs（主进程、菜单、app:// 协议）、preload.cjs
design/logo/         标志：生成脚本、导出脚本、使用说明 GUIDE.md，成品在 kit/
docs/                开发记录和 README 截图
scripts/             数据下载、处理、组装、截图和本地预览脚本
  fetch-data.sh        下载原始数据到 raw/
  prepare.sh           从原始数据生成中间文件
  build.sh             生成 dist/data，并组装出 dist/index.html
  capitals.mjs         从 Natural Earth 生成 src/capitals.js
  flags.mjs            把 flag-icons 的国旗按地图单位打包成 dist/data/flags.json
  gdr-align.mjs        把德国行政区和东西德分界线对齐，切出诺伊豪斯
  assemble.mjs         组装 dist/index.html 和 desktop/app/
  screenshots.mjs      生成 README 截图
  serve.mjs            本地预览
test/                用 puppeteer-core 驱动本机 Chrome 和 Electron 的测试
  interactions.mjs     涂色、代码输入、旧配置迁移
  denmark.mjs          平面图插图
  webgl.mjs            WebGL 显示、点击、悬停、缩放、导出、阵营和中英文（分批运行）
  desktop.mjs          桌面版：项目文件、菜单、导出、内容安全策略
  bench.mjs            拖动帧率
  mesh.mjs             在 Node 里检查球面三角化
```

`raw/`、`work/`、`dist/`、`release/` 和 `desktop/app/` 都是生成的，不进 git。

## 许可

代码（`src/`、`desktop/`、`scripts/`、`test/`、`design/`）按 [GNU GPL 3.0](LICENSE) 发布：可以自由使用、修改和再发布，但发布修改后的版本时也要按 GPL 3.0 开源。地图数据和国旗不在仓库里，构建时下载，各自的许可见上面的“数据来源”。
