# World Color Globe

[简体中文](README.md) · [繁體中文](README.zh-Hant.md) · [English](README.en.md) · [Français](README.fr.md) · [Русский](README.ru.md) · **Español**

Un globo terráqueo que se puede girar y ampliar, y colorear por país, por división de primer nivel (provincia, estado) o de segundo nivel (ciudad, condado). Al hacer clic en un país se abre su mapa plano. Hay una versión web y una aplicación de escritorio para macOS y Windows, que comparten el mismo código. La interfaz está en chino simplificado e inglés; los nombres de los botones se dan abajo en inglés.

![Vista del globo con los colores de ejemplo: Canadá, Brasil, México y otros países coloreados](docs/images/globe.jpg)

## Qué hace

### Girar, buscar, ampliar

Arrastre para girar el globo, que conserva algo de inercia. La rueda del ratón, el gesto de pellizcar o los botones de arriba a la derecha amplían hasta 10×. Las flechas del teclado también lo giran, e Intro aplica la acción actual al país que está en el centro de la vista.

En el cuadro de búsqueda de arriba se puede escribir un nombre en chino o en inglés, o un código de tres letras. Al elegir un resultado, el globo gira hacia la capital del país y se acerca hasta que el país llena más o menos la vista. Solo cuenta el territorio alrededor de la capital, más las islas que no están mucho más lejos que el extremo del territorio principal: Estados Unidos se encuadra sin Alaska y Dinamarca sin Groenlandia. Los países pequeños como el Vaticano o Singapur pasan directamente a 10×. En los trayectos largos, la vista se aleja a mitad de camino y luego vuelve a acercarse.

![Tras buscar Japón, el globo gira hacia Tokio y encuadra todo Japón](docs/images/search.jpg)

### Colorear

La barra superior tiene dos modos, **Paint** (colorear) y **View** (ver), y tres unidades, **Country**, **Level 1** y **Level 2**. En el modo de colorear, un clic da el color actual a la unidad y un segundo clic lo quita. Con el primer o el segundo nivel elegido, al pasar el puntero sobre un país se ven sus límites administrativos y el nombre y el código de la división bajo el puntero. Sea cual sea el pincel elegido, Opción-clic (Alt-clic en Windows) devuelve la unidad directamente a sin colorear.

Cada color tiene un nombre, un estilo liso o rayado y un valor de color. El color de una división se impone al del país. A la derecha se pueden escribir nombres de países o códigos de divisiones para colorear muchos a la vez; las entradas que no se encuentran se listan aparte.

Los códigos de segundo nivel son el código del país más un número: el condado de Cook, donde está Chicago, es `USA-0628`. Los números siguen el orden de los nombres dentro de cada país, así que no cambian mientras no cambien los datos. Hay 49 340 en todo el mundo, sin repeticiones. Los códigos de primer nivel tienen la forma `USA.US-CA`.

### Mapas planos

En el modo de ver, un clic en un país abre su mapa plano. Estados Unidos usa la proyección Albers USA, con recuadros de Alaska y Hawái; los demás países, una proyección cónica equivalente de Albers ajustada a su extensión, y la Antártida, una proyección polar equivalente. Los territorios alejados van a pequeños recuadros abajo, hasta seis; el mapa de China tiene un recuadro del mar de la China Meridional abajo a la derecha. Los mapas planos se amplían hasta 12×, y al acercarse aparecen más nombres.

Abajo, los siete estados federados del este de Alemania están coloreados por separado. Las divisiones alemanas están alineadas con la frontera interalemana de 1951–1990, así que el borde del color cae justo sobre ella, y Berlín está dividido en Berlín Oeste y Berlín Este.

![Mapa de Alemania: los estados del este en azul, con el borde siguiendo la frontera interalemana](docs/images/germany.jpg)

### Bloques y banderas

En **Blocs**, a la derecha, se pueden marcar la UE, la OTAN, el Pacto de Varsovia, la OTSC, la ASEAN, la OPEP, la OEA y el Movimiento de Países No Alineados. Cada bloque marcado añade una capa de rayas al mapa; los países de varios bloques muestran sus colores por turnos. Al desplegar un bloque se ven las banderas de los miembros, su situación y los antiguos miembros, y se pueden colorear todos los miembros con un clic. El Pacto de Varsovia se muestra con el territorio de su época: la URSS como sus 15 Estados sucesores y la RDA como los estados del este de Alemania.

![Europa: la OTAN (rayas verde azulado) y el Pacto de Varsovia (rayas rojas) superpuestos](docs/images/blocs.jpg)

### Idiomas y temas

La barra superior cambia entre chino e inglés: botones, ayudas, nombres de países y divisiones, etiquetas de los mapas planos e imágenes exportadas cambian con ella. En **Base map** se puede elegir el tema del sistema, claro u oscuro. El tema solo cambia la interfaz, nunca los colores del propio mapa.

![Interfaz en inglés con el tema oscuro, el globo girado hacia Asia](docs/images/dark.jpg)

### Exportar, copias de seguridad e importar

La vista actual se puede guardar como PNG o SVG, o copiar como código SVG. El mapa base puede mostrar u ocultar los límites de primer y segundo nivel, los nombres de las divisiones (7–20 px), la retícula, y la frontera interalemana con el límite de Berlín Oeste. Los colores del océano, del fondo y de los países sin colorear se pueden cambiar.

Dónde se guardan los colores depende de la versión:

- **Web:** cada cambio se guarda automáticamente en el almacenamiento local del navegador. Solo existe en ese navegador y se pierde si se borran los datos del sitio. Para hacer una copia, despliegue **Configuration JSON (back up or import)** abajo a la derecha y guarde su contenido en un archivo `.json`. Para restaurar, pulse **Import .json file**, o pegue el contenido de nuevo y pulse **Apply**. Deshacer guarda los últimos 60 pasos y se vacía al recargar la página.
- **Escritorio:** los colores están en archivos de proyecto `.json` que usted mismo guarda; el menú **File** tiene New, Open, Save, Save As y Open Recent. El formato es el mismo en los dos lados, así que un `.json` guardado desde la versión web se abre directamente en la aplicación.

### Aplicación de escritorio

La aplicación de escritorio es la misma página dentro de un envoltorio de Electron y funciona totalmente sin conexión: datos del mapa, scripts y fuentes van incluidos, y una política de seguridad de contenido estricta impide que la página acceda a la red. En macOS la barra de título del sistema está oculta; la franja superior de la ventana muestra el nombre del archivo, con un ● cuando hay cambios sin guardar.

![La aplicación de escritorio en macOS](docs/images/desktop.jpg)

## Fronteras

Este proyecto no representa las fronteras reconocidas internacionalmente ni la posición oficial de ningún país.

## Fuentes de datos

| Contenido | Fuente | Licencia |
|---|---|---|
| Contornos de países, divisiones de primer nivel, lagos, los nueve primeros trazos | Natural Earth 1:10m 5.1.1 (incluida la edición «punto de vista de China») | Dominio público |
| Divisiones de segundo nivel | geoBoundaries CGAZ ADM2 | CC BY 4.0 |
| Frontera interalemana, límite de Berlín Oeste (1951–1990) | OpenHistoricalMap, relación 2692241 | CC0 |
| Capitales (destino de una búsqueda) | Natural Earth 1:10m, lugares poblados, más 19 territorios pequeños añadidos a mano | Dominio público |
| Banderas | flag-icons | MIT |
| Posición del décimo trazo | Según los geodatos DataV de Alibaba Cloud, solo aproximada | Condiciones no comprobadas |

Los datos del mapa no están en el repositorio; los scripts de abajo los descargan y los construyen.

## Ejecutar y construir

Hace falta Node.js (desarrollado con la versión 24) y unos 300 MB de disco. La primera vez, ejecute en orden:

```sh
npm install
npm run fetch          # descarga los datos originales en raw/, unos 220 MB
npm run prepare-data   # construye los archivos intermedios
npm run build          # construye dist/data y dist/index.html, unos 20 s
npm run serve          # vista previa local: http://127.0.0.1:8765/wrap.html
```

Si solo cambiaron archivos de `src/`, basta con `npm run assemble`; construye la página web y la de escritorio a la vez. Si cambian las reglas de procesamiento de datos, hay que volver a empezar desde `npm run build`.

Escritorio: `npm run desktop` abre la aplicación, y `npm run dist:mac` genera un dmg y un zip para Apple Silicon (unos 125 MB cada uno, 50 MB de ellos datos del mapa) en `release/`. La aplicación aún no está firmada ni notarizada: la primera vez que se abre en otro Mac, haga clic derecho y elija **Abrir**, o permítala en **Ajustes del Sistema › Privacidad y seguridad**. `npm run dist:win` genera desde un Mac la versión para Windows x64: un instalador, `world-globe-1.0.0-x64-setup.exe` (unos 100 MB), y un zip portátil (unos 140 MB). Tampoco está firmada, así que SmartScreen la detiene la primera vez; haga clic en **Más información** y luego en **Ejecutar de todas formas**.

Las capturas del README se generan con `node scripts/screenshots.mjs <globe|search|germany|blocs|dark>`, con `npm run serve` en marcha. La de la aplicación de escritorio se hizo a mano.

## Cómo funciona

El globo se dibuja con WebGL2 en proyección ortográfica, a 1:10m tanto al arrastrar como en reposo, con 60 fotogramas por segundo estables en las tres pruebas de arrastre; sin WebGL2, el navegador vuelve a Canvas 2D. El resaltado al pasar el puntero se dibuja en una capa de Canvas 2D, y los mapas planos son SVG para exportarlos limpiamente. La lectura de datos, el guardado de archivos y los ajustes pasan por `src/platform.js`, que tiene una implementación para la web y otra para el escritorio. Bibliotecas: D3 7.9.0, TopoJSON y earcut 2.2.4.

Los contornos simplificados de los países van incrustados en la página. Los contornos a 1:10m, las líneas de las divisiones y los datos de primer nivel (210 archivos) y de segundo nivel (201 archivos) de cada país son archivos aparte, que se cargan al abrir el país; unos 50 MB en total.

Los datos se procesan con mapshaper. Pasos principales:

1. Partir de los datos de países de Natural Earth, unir o separar algunas unidades según las fronteras elegidas y quitar los lagos transfronterizos.
2. Reasignar en consecuencia las divisiones de primer nivel (con los lagos recortados) y cortar Berlín por el límite de Berlín Oeste.
3. Alinear las divisiones alemanas de primer y segundo nivel con el polígono de la RDA de OpenHistoricalMap (`scripts/gdr-align.mjs`): cada división conserva el lado donde está la mayor parte de su superficie, y los fragmentos del otro lado que tocan la frontera pasan al vecino de ese lado con el que comparten el borde más largo. El Amt Neuhaus se recorta de los datos de segundo nivel y queda como división propia en los dos niveles.
4. Las divisiones de segundo nivel conservan el país que indican los datos, salvo donde se ajustaron las fronteras o donde una división pertenece a otra unidad; esas se reasignan según la superficie de solapamiento. La codificación del texto de los datos originales está mezclada, así que cada nombre se decodifica por separado como UTF-8 o Latin-1.

Los detalles de la reescritura en WebGL, la aplicación de escritorio, las pruebas de fluidez y cada versión están en el [registro de desarrollo](docs/DEVLOG.md) (en chino).

## Estructura

```
src/globe.html       plantilla de la página; los datos incrustados van en __GEO__
src/globe-gl.js      globo en WebGL: triangulación de la esfera, shaders y dibujo
src/platform.js      capa de plataforma: datos, archivos y ajustes para la web y el escritorio
src/i18n.js          textos de la interfaz en chino e inglés
src/blocs.js         bloques y miembros (a noviembre de 2026)
src/capitals.js      coordenadas de las capitales, generadas por scripts/capitals.mjs
desktop/             envoltorio de Electron: main.mjs (proceso principal, menús, protocolo app://), preload.cjs
design/logo/         logotipo: scripts de construcción y exportación, guía GUIDE.md, archivos finales en kit/
docs/                registro de desarrollo y capturas del README
scripts/             descarga, procesamiento, montaje, capturas y vista previa
  fetch-data.sh        descarga los datos originales en raw/
  prepare.sh           construye los archivos intermedios
  build.sh             construye dist/data y monta dist/index.html
  capitals.mjs         genera src/capitals.js a partir de Natural Earth
  flags.mjs            agrupa las banderas de flag-icons por unidad en dist/data/flags.json
  gdr-align.mjs        alinea las divisiones alemanas con la frontera interalemana y recorta el Amt Neuhaus
  assemble.mjs         monta dist/index.html y desktop/app/
  screenshots.mjs      toma las capturas del README
  serve.mjs            vista previa local
test/                pruebas que manejan Chrome y Electron en local con puppeteer-core
  interactions.mjs     coloreado, introducción de códigos, migración de ajustes antiguos
  denmark.mjs          recuadros de los mapas planos
  webgl.mjs            dibujo WebGL, clics, puntero, zoom, exportación, bloques e idiomas (por lotes)
  desktop.mjs          escritorio: archivos de proyecto, menús, exportación, política de seguridad
  bench.mjs            fluidez al arrastrar
  mesh.mjs             comprueba la triangulación de la esfera en Node
```

`raw/`, `work/`, `dist/`, `release/` y `desktop/app/` se generan y no se guardan en git.

## Licencia

El código (`src/`, `desktop/`, `scripts/`, `test/`, `design/`) se publica bajo la [GNU GPL 3.0](LICENSE): puede usarlo, modificarlo y compartirlo libremente, pero las versiones modificadas que distribuya también deben publicarse bajo GPL 3.0. Los datos del mapa y las banderas no están en el repositorio; se descargan al construir, con las licencias indicadas arriba en «Fuentes de datos».
