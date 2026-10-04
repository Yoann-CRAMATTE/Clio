# Clio — L'atelier de l'écrivain

Traitement de texte pour romanciers, fondé sur l'écriture par fragments :
l'auteur écrit des morceaux — une scène, une réplique, une idée — puis les
assemble et les réordonne. Le texte final se reconstitue par concaténation à la
lecture et à l'export.

```
LIVRE ─┬─ CHAPITRE ─┬─ SCÈNE ─┬─ BLOC ─┬─ titre (optionnel)
       │            │         │        ├─ texte
       │            │         │        ├─ note en marge
       │            │         │        ├─ couleur d'accent
       │            │         │        └─ images
       │            ├─ notes du chapitre
       │            └─ type de section (chapitre, préface, index…)
       ├─ personnages
       ├─ lieux
       └─ métadonnées (titre, auteur, genre, objectif, format)
```

Le bloc est l'unité de pensée : il se déplace dans sa scène, vers une autre
scène, vers un autre chapitre.

EuropaSoft · Yoann CRAMATTE · © 2025-2026, tous droits réservés

**Essayer Clio dans le navigateur :** https://yoann-cramatte.github.io/Clio/ —
installable comme application (PWA) sur ordinateur, tablette et téléphone, et
utilisable hors ligne. Sur Android, Clio existe aussi sur Google Play.

> **Licence.** Ce dépôt est public pour consultation uniquement. Le code n'est
> pas libre : toute copie, modification, redistribution ou réutilisation est
> interdite sans autorisation écrite. Voir [`LICENSE`](LICENSE) ; composants
> tiers dans [`NOTICES`](NOTICES).

---

## Vos textes vous appartiennent

Clio ne collecte aucune donnée. Les livres, les notes et les réglages restent
sur l'appareil de l'auteur et dans les fichiers `.clio` qu'il enregistre
lui-même. Rien n'est transmis. L'application fonctionne sans compte et sans
connexion — c'est vérifiable : elle ne contient aucun appel réseau.

Sur l'appareil, les livres et la corbeille sont enregistrés dans la base
IndexedDB `clio-livres` du navigateur ou du WebView (depuis 1.0.2 ; avant,
dans `localStorage`, dont le quota saturait vite). Les réglages restent dans
`localStorage`. Le fichier `.clio` demeure la seule copie qui survive à
l'effacement des données du navigateur.

---

## Une seule source, plusieurs cibles

`clio-tauri/src/index.html` est **la base commune**. Ce fichier unique contient
toute l'application — structure, style et code. Il sert à la fois la version
web et toutes les applications empaquetées.

| Cible | Comment |
|---|---|
| Web / PWA | `clio-tauri/build-web.sh` produit un dossier statique à déposer |
| Android | `clio-tauri/build-android.sh` produit un APK |
| iOS, macOS, Windows, Linux | Tauri, depuis la même source |

Le code propre à l'empaquetage passe par le drapeau `SOUS_TAURI`. Sur le web ce
drapeau vaut `false` et le comportement d'origine s'applique. **Toute correction
se fait dans la base commune**, jamais dans une copie propre à une plateforme :
une correction faite ailleurs ne profiterait qu'à une seule cible.

### Ce que le HTML embarque

L'application ne dépend d'aucun service extérieur. JSZip et les trois familles
de polices sont livrés avec elle, dans `vendor/` et `fonts/`. Le fichier
`index.html` n'est donc **pas** autonome : il faut déployer le dossier entier.

---

## Organisation du dépôt

```
clio-tauri/
├── src/                    LA SOURCE
│   ├── index.html          l'application complète
│   ├── fonts.css, fonts/   Playfair Display, Crimson Pro, IM Fell English
│   ├── vendor/             JSZip
│   ├── AppInfo.json        identité de l'application et journal des versions,
│   │                       seule source de la version (lue par la page)
│   └── service-worker.js   démarrage hors ligne de la version web
├── src-tauri/              empaquetage Tauri (Rust, manifeste Android)
├── docs/PLATEFORMES.md     contraintes par plateforme, pièges de compilation
├── tests/                  tests automatisés (format .clio, stockage des livres)
├── sync-version.sh         aligne package.json et Cargo.toml sur AppInfo.json
├── build-web.sh            produit le dossier web
└── build-android.sh        produit l'APK

FORMAT-CLIO.md              norme du format .clio, autonome
Clio 0.0.1/                 version HTML d'origine, avant le portage
```

Les sorties de compilation ne sont pas versionnées : `web/`, `target/`,
`node_modules/` et les APK se régénèrent par les scripts.

---

## Déployer la version web

```bash
cd clio-tauri
./build-web.sh
```

Le dossier `web/Clio/` (environ 1,4 Mo) se dépose tel quel sur n'importe quel
hébergement statique. L'application répond alors sur `<votre-site>/Clio/`.

Le manifeste (`manifest.webmanifest`) n'emploie que des chemins relatifs :
posé dans `/Clio/`, il y déclare son périmètre. Rien à configurer.

**GitHub Pages.** Chaque mise à jour de `main` déclenche
`.github/workflows/pwa.yml` : tests, puis `build-web.sh`, puis mise en ligne
sur https://yoann-cramatte.github.io/Clio/. Un test en échec bloque la publication.

**Une adresse `https://` est nécessaire** à l'installation en application
(PWA). En `http://` simple, Clio fonctionne mais ne s'installe pas — c'est une
règle des navigateurs, pas un choix de Clio.

Une fois installée, l'application démarre **sans réseau** : le service worker
garde ses fichiers en cache. Pour publier une mise à jour, relancer
`build-web.sh` et redéposer le dossier ; les utilisateurs la reçoivent au
lancement suivant, l'ancien cache étant écarté automatiquement.

---

## Compiler l'application Android

```bash
cd clio-tauri
./build-android.sh            # APK de débogage, arm64
./build-android.sh --release  # APK de distribution, signature requise
```

Le script exporte lui-même les chemins du JDK, du SDK et du NDK, absents du
`PATH` par défaut. Les pièges rencontrés — et les raisons de chaque réglage —
sont consignés dans `docs/PLATEFORMES.md`. À lire avant toute modification de
la configuration d'empaquetage.

---

## Lancer les tests

```bash
cd clio-tauri
npm install   # une fois : installe aussi fake-indexeddb, seule dépendance des tests
npm test
```

Les tests utilisent le lanceur intégré de Node (`node --test`, Node 18 ou
plus). Ils ne recopient aucune logique : `tests/charger-index.mjs` découpe
`src/index.html` entre des repères (commentaires de section, débuts de
déclaration) et évalue ces extraits tels quels dans un bac à sable `node:vm`,
avec le `vendor/jszip.min.js` livré. Si un repère disparaît, le chargement
échoue au lieu de tester autre chose que l'application.

- `format-clio.test.mjs` : aller-retour d'un livre riche (tous types de
  section, scènes, blocs, notes, images, entités, caractères spéciaux) par
  `bookToClioBlob` puis `clioToBook`, conformité de l'archive à
  `FORMAT-CLIO.md`, et archives piégées (balisage dans les champs, chemins
  `../`, images qui n'en sont pas, pollution de prototype).
- `stockage-livres.test.mjs` : migration localStorage → IndexedDB, écritures
  regroupées, repli localStorage, protections contre l'écrasement de la
  bibliothèque. IndexedDB y est simulée par `fake-indexeddb` (pur JavaScript,
  aucune dépendance).

Ces tests valident la logique, pas les WebView : le comportement sur appareil
reste à vérifier à la main.

---

## Le format `.clio`

Un `.clio` contient une œuvre et une seule : le livre, ses chapitres, ses
scènes, ses blocs et ses images, dans une archive ZIP.

```
<archive>.clio
├── manifest.json
├── book.json
├── chapters/ch-001.json …
└── images/
```

[`FORMAT-CLIO.md`](FORMAT-CLIO.md) décrit la norme de façon autonome : elle
suffit à écrire un lecteur ou un producteur de `.clio` sans disposer du code de
Clio.
