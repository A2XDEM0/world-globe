# World Color Globe

[简体中文](README.md) · [繁體中文](README.zh-Hant.md) · [English](README.en.md) · **Français** · [Русский](README.ru.md) · [Español](README.es.md)

Un globe terrestre que l'on peut faire tourner et agrandir, et colorier par pays, par division de premier niveau (province, État) ou de second niveau (ville, comté). Un clic sur un pays ouvre sa carte à plat. Il existe une version web et une application de bureau pour macOS et Windows, qui partagent le même code. L'interface est disponible en chinois simplifié et en anglais ; les noms des boutons ci-dessous sont donnés en anglais.

![Vue du globe avec les couleurs d'exemple : Canada, Brésil, Mexique et d'autres pays coloriés](docs/images/globe.jpg)

## Fonctionnalités

### Tourner, chercher, agrandir

Faites glisser pour tourner le globe, qui garde un peu d'élan. La molette, le pincement ou les boutons en haut à droite agrandissent jusqu'à 10×. Les flèches du clavier le font aussi tourner, et Entrée applique l'action en cours au pays situé au centre de la vue.

Le champ de recherche en haut accepte un nom chinois ou anglais, ou un code à trois lettres. Une fois le résultat choisi, le globe tourne vers la capitale du pays et l'agrandit jusqu'à ce que le pays remplisse à peu près la vue. Seul compte le territoire autour de la capitale, avec les îles qui ne sont pas beaucoup plus loin que l'extrémité du territoire principal : les États-Unis sont cadrés sans l'Alaska, le Danemark sans le Groenland. Les petits pays comme le Vatican ou Singapour passent directement à 10×. Sur un long trajet, la vue recule à mi-chemin puis se rapproche.

![Après une recherche sur le Japon, le globe tourne vers Tokyo et cadre tout le Japon](docs/images/search.jpg)

### Colorier

La barre du haut propose deux modes, **Paint** (colorier) et **View** (consulter), et trois unités, **Country**, **Level 1** et **Level 2**. En mode coloriage, un clic donne la couleur en cours à l'unité, un second clic la retire. Avec le premier ou le second niveau, survoler un pays affiche ses limites administratives ainsi que le nom et le code de la division sous le pointeur. Quel que soit le pinceau choisi, Option-clic (Alt-clic sous Windows) remet directement l'unité à l'état non colorié.

Chaque couleur a un nom, un style uni ou hachuré et une valeur de couleur. La couleur d'une division l'emporte sur celle du pays. Dans la carte **Current colour**, à droite, on peut saisir des noms de pays ou des codes de division pour colorier en série ; les entrées introuvables sont listées à part.

Les codes de second niveau sont formés du code du pays et d'un numéro : le comté de Cook, celui de Chicago, est `USA-0628`. Les numéros suivent l'ordre des noms dans chaque pays, donc ils ne changent pas tant que les données ne changent pas. Il y en a 49 340 dans le monde, sans doublon. Les codes de premier niveau s'écrivent comme `USA.US-CA`.

### Cartes à plat

En mode consultation, un clic sur un pays ouvre sa carte à plat. Les États-Unis utilisent la projection Albers USA, avec des cartons pour l'Alaska et Hawaï ; les autres pays une projection conique équivalente d'Albers ajustée à leur étendue, et l'Antarctique une projection polaire équivalente. Les territoires éloignés vont dans de petits cartons en bas, six au maximum ; la carte de la Chine a un carton de la mer de Chine méridionale en bas à droite. Les cartes à plat s'agrandissent jusqu'à 12×, et davantage de noms apparaissent en zoomant.

Ci-dessous, les sept Länder de l'est de l'Allemagne sont coloriés à part. Les divisions allemandes sont alignées sur la frontière interallemande de 1951–1990 : le bord du coloriage tombe exactement dessus, et Berlin est divisé en Berlin-Ouest et Berlin-Est.

![Carte de l'Allemagne : les Länder de l'est en bleu, leur bord suivant la frontière interallemande](docs/images/germany.jpg)

### Blocs et drapeaux

Sous **Blocs**, dans la barre de gauche, on peut cocher l'UE, l'OTAN, le pacte de Varsovie, l'OTSC, l'ASEAN, l'OPEP, l'OEA et le Mouvement des non-alignés. Chaque bloc coché ajoute une couche de hachures sur la carte ; les pays de plusieurs blocs montrent leurs couleurs à tour de rôle. En dépliant un bloc, on voit les drapeaux des membres, leur statut et les anciens membres, et on peut colorier tous les membres d'un clic. Le pacte de Varsovie est montré selon le territoire de l'époque : l'URSS par ses 15 États successeurs, la RDA par les Länder de l'est de l'Allemagne.

![Europe : l'OTAN (hachures bleu-vert) et le pacte de Varsovie (hachures rouges) superposés](docs/images/blocs.jpg)

### Langues et thèmes

La barre du haut bascule entre chinois et anglais : boutons, aides, noms de pays et de divisions, étiquettes des cartes à plat et images exportées suivent. Sous **Interface**, dans la barre de gauche, on choisit le thème du système, clair ou sombre. Le thème ne change que l'interface, jamais les couleurs de la carte elle-même.

![Interface en anglais avec le thème sombre, le globe tourné vers l'Asie](docs/images/dark.jpg)

### Barres latérales et disposition

La page tient sur un seul écran et ne défile jamais. Les outils sont dans la barre de gauche (blocs, calques, thème de l'interface, export et configuration), les couleurs dans celle de droite (pinceaux, couleur en cours, couleurs de la carte). Chaque barre se replie en un rail étroit (raccourcis `[` et `]`), et chaque carte se replie sous son titre. Le crayon en haut d'une barre lance l'édition : masquer des cartes entières ou de simples lignes (un bloc dont on ne se sert jamais, par exemple), réordonner les cartes ou en passer une de l'autre côté ; **Reset layout** rétablit la disposition par défaut. La disposition est mémorisée localement (dans le fichier de réglages pour l'application de bureau) et revient à l'ouverture suivante. Sous 900 px de large, les barres s'ouvrent par-dessus la carte, une à la fois.

### Export, sauvegarde et import

La vue en cours peut être enregistrée en PNG ou en SVG, ou copiée sous forme de code SVG. **Layers**, dans la barre de gauche, affiche ou masque les limites de premier et de second niveau, les noms des divisions (7 à 20 px), le canevas, ainsi que la frontière interallemande et la limite de Berlin-Ouest. **Map colours**, à droite, change les couleurs de l'océan et du fond ; le pinceau **Unpainted** change celle des pays non coloriés.

L'endroit où vos couleurs sont conservées dépend de la version :

- **Web :** chaque modification est enregistrée automatiquement dans le stockage local du navigateur et relue à l'ouverture suivante. Elle n'existe que dans ce navigateur et disparaît si l'on efface les données du site. Pour sauvegarder, dépliez **Configuration JSON (back up or import)** sous **Export this view**, dans la barre de gauche, et enregistrez son contenu dans un fichier `.json`. Pour restaurer, cliquez sur **Import .json file**, ou recollez le contenu et cliquez sur **Apply**. L'annulation garde les 60 dernières étapes et se vide au rechargement de la page.
- **Bureau :** les couleurs sont dans des fichiers de projet `.json`. Chaque modification est écrite aussitôt dans le fichier ouvert, et l'application rouvre le dernier projet au démarrage ; un projet sans titre, pas encore enregistré comme fichier, est conservé dans le dossier de réglages de l'application et revient lui aussi. Le menu **File** propose New, Open, Save, Save As et Open Recent. Le format est le même des deux côtés : un `.json` enregistré depuis la version web s'ouvre directement dans l'application.

### Application de bureau

L'application de bureau est la même page dans une enveloppe Electron et fonctionne entièrement hors ligne : données, scripts et polices sont embarqués, et une politique de sécurité du contenu stricte empêche tout accès au réseau. Sous macOS, la barre de titre du système est masquée ; la bande en haut de la fenêtre affiche le nom du fichier, avec un ● tant qu'un projet sans titre n'a pas été enregistré comme fichier.

![L'application de bureau sous macOS](docs/images/desktop.jpg)

## Frontières

Ce projet ne représente pas les frontières reconnues internationalement, ni la position officielle d'aucun pays.

## Sources des données

| Contenu | Source | Licence |
|---|---|---|
| Contours des pays, divisions de premier niveau, lacs, les neuf premiers traits | Natural Earth 1:10m 5.1.1 (y compris l'édition « point de vue de la Chine ») | Domaine public |
| Divisions de second niveau | geoBoundaries CGAZ ADM2 | CC BY 4.0 |
| Frontière interallemande, limite de Berlin-Ouest (1951–1990) | OpenHistoricalMap, relation 2692241 | CC0 |
| Capitales (destination d'une recherche) | Natural Earth 1:10m, lieux peuplés, plus 19 petits territoires ajoutés à la main | Domaine public |
| Drapeaux | flag-icons | MIT |
| Position du dixième trait | D'après les géodonnées DataV d'Alibaba Cloud, approximative | Conditions non vérifiées |

Les données cartographiques ne sont pas dans le dépôt ; les scripts ci-dessous les téléchargent et les construisent.

## Lancer et construire

Il faut Node.js (développé avec la version 24) et environ 300 Mo d'espace disque. La première fois, lancez dans l'ordre :

```sh
npm install
npm run fetch          # télécharge les données brutes dans raw/, environ 220 Mo
npm run prepare-data   # construit les fichiers intermédiaires
npm run build          # construit dist/data et dist/index.html, environ 20 s
npm run serve          # aperçu local : http://127.0.0.1:8765/wrap.html
```

Si seuls des fichiers de `src/` ont changé, `npm run assemble` suffit ; il construit la page web et la page de bureau ensemble. Après une modification des règles de traitement des données, repartez de `npm run build`.

Bureau : `npm run desktop` lance l'application, et `npm run dist:mac` produit un dmg et un zip pour Apple Silicon (environ 125 Mo chacun, dont 50 Mo de données) dans `release/`. L'application n'est pas encore signée ni notariée : la première fois qu'on l'ouvre sur un autre Mac, il faut faire un clic droit et choisir **Ouvrir**, ou l'autoriser dans **Réglages Système › Confidentialité et sécurité**. `npm run dist:win` produit depuis un Mac la version Windows x64 : un installateur, `world-globe-1.0.0-x64-setup.exe` (environ 100 Mo), et un zip portable (environ 140 Mo). Elle n'est pas signée non plus : au premier lancement, SmartScreen la bloque ; cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.

Les captures du README sont produites par `node scripts/screenshots.mjs <globe|search|germany|blocs|dark>`, avec `npm run serve` lancé. Celle de l'application de bureau a été prise à la main.

## Fonctionnement

Le globe est dessiné en WebGL2 en projection orthographique, au 1:10m pendant le glissement comme au repos, à 60 images/s stables dans les trois tests de glissement ; sans WebGL2, le navigateur revient à Canvas 2D. Le survol est dessiné sur un calque Canvas 2D, et les cartes à plat sont en SVG pour s'exporter proprement. La lecture des données, l'enregistrement des fichiers et les réglages passent tous par `src/platform.js`, qui a une implémentation web et une de bureau. Bibliothèques : D3 7.9.0, TopoJSON et earcut 2.2.4.

Les contours simplifiés des pays sont intégrés à la page. Les contours au 1:10m, les limites administratives et les données de premier niveau (210 fichiers) et de second niveau (201 fichiers) de chaque pays sont des fichiers séparés, chargés à l'ouverture du pays ; environ 50 Mo en tout.

Les données sont traitées avec mapshaper. Étapes principales :

1. Partir des données de pays de Natural Earth, fusionner ou séparer certaines unités selon les frontières choisies, puis retirer les lacs transfrontaliers.
2. Réattribuer en conséquence les divisions de premier niveau (lacs évidés), et couper Berlin le long de la limite de Berlin-Ouest.
3. Aligner les divisions allemandes de premier et de second niveau sur le polygone de la RDA d'OpenHistoricalMap (`scripts/gdr-align.mjs`) : chaque division garde le côté où se trouve l'essentiel de sa surface, et les éclats de l'autre côté qui touchent la frontière vont au voisin de ce côté avec lequel ils partagent le plus long bord. L'Amt Neuhaus est découpé dans les données de second niveau et devient une division à part aux deux niveaux.
4. Les divisions de second niveau gardent le pays indiqué dans les données, sauf là où les frontières ont été ajustées ou là où une division relève d'une autre unité ; celles-ci sont réattribuées selon la surface de recouvrement. L'encodage du texte des données brutes est mélangé : chaque nom est décodé individuellement en UTF-8 ou en Latin-1.

Les détails de la réécriture en WebGL, de l'application de bureau, des tests de fluidité et de chaque version sont dans le [journal de développement](docs/DEVLOG.md) (en chinois).

## Organisation

```
src/globe.html       modèle de page ; les données intégrées vont à __GEO__
src/globe-gl.js      globe WebGL : triangulation de la sphère, shaders et dessin
src/platform.js      couche plateforme : données, fichiers et réglages pour le web et le bureau
src/i18n.js          textes de l'interface en chinois et en anglais
src/blocs.js         blocs et membres (à novembre 2026)
src/capitals.js      coordonnées des capitales, produites par scripts/capitals.mjs
desktop/             enveloppe Electron : main.mjs (processus principal, menus, protocole app://), preload.cjs
design/logo/         logo : scripts de construction et d'export, guide GUIDE.md, fichiers finis dans kit/
docs/                journal de développement et captures du README
scripts/             téléchargement, traitement, assemblage, captures et aperçu
  fetch-data.sh        télécharge les données brutes dans raw/
  prepare.sh           construit les fichiers intermédiaires
  build.sh             construit dist/data et assemble dist/index.html
  capitals.mjs         produit src/capitals.js depuis Natural Earth
  flags.mjs            regroupe les drapeaux flag-icons par unité dans dist/data/flags.json
  gdr-align.mjs        aligne les divisions allemandes sur la frontière interallemande, découpe l'Amt Neuhaus
  assemble.mjs         assemble dist/index.html et desktop/app/
  screenshots.mjs      prend les captures du README
  serve.mjs            aperçu local
test/                tests pilotant Chrome et Electron en local via puppeteer-core
  interactions.mjs     coloriage, saisie de codes, migration d'anciens réglages
  denmark.mjs          cartons des cartes à plat
  webgl.mjs            dessin WebGL, clics, survol, zoom, export, blocs et langues (par lots)
  desktop.mjs          application de bureau : fichiers de projet, menus, export, politique de sécurité
  layout.mjs           barres latérales, cartes repliables, édition de l'affichage, page sans défilement
  bench.mjs            fluidité du glissement
  mesh.mjs             vérifie la triangulation de la sphère dans Node
```

`raw/`, `work/`, `dist/`, `release/` et `desktop/app/` sont générés et ne sont pas suivis par git.

## Licence

Le code (`src/`, `desktop/`, `scripts/`, `test/`, `design/`) est publié sous [GNU GPL 3.0](LICENSE) : vous pouvez l'utiliser, le modifier et le partager librement, mais les versions modifiées que vous diffusez doivent aussi être publiées sous GPL 3.0. Les données cartographiques et les drapeaux ne sont pas dans le dépôt ; ils sont téléchargés à la construction, sous les licences indiquées dans « Sources des données » ci-dessus.
