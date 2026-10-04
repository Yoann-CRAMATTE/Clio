# Retour d'expérience — application monofichier HTML portée en natif

Leçons tirées de Clio : un seul fichier HTML, servi en web et empaqueté par Tauri v2
pour Android, puis publié sur Google Play. À relire **avant de démarrer** une
application du même style, et à compléter à chaque nouvelle leçon.

`PLATEFORMES.md` décrit la fabrication de Clio elle-même ; ce document en garde ce
qui vaut pour les projets suivants.

---

## 1. Architecture

- **Une seule base commune**, servie par le web et par tous les installables. Le
  spécifique plateforme passe par un drapeau d'exécution (`SOUS_TAURI`), jamais par
  une copie du code. Une correction faite une fois profite à toutes les cibles.
- **Identité et version dans un seul fichier** (`src/AppInfo.json`), lu par la page
  au démarrage, avec des valeurs de repli si la lecture échoue (`file://`). Tauri
  lit sa version directement dans ce fichier ; un petit script recopie la version
  dans `package.json` et `Cargo.toml`. À mettre en place **dès le premier jour** :
  sinon la version finit recopiée dans quatre fichiers qui divergent.
- **Aucune CSP** sous Tauri avec du JavaScript en ligne : Tauri ajoute un nonce, qui
  neutralise `'unsafe-inline'`, et l'interface s'affiche mais rien ne réagit.

## 2. Interactions tactiles

- **Le glisser-déposer HTML5 ne fonctionne pas au doigt** dans les WebView mobiles,
  et un `mousedown` n'arrive jamais avant un appui long. Les poignées restaient
  inertes sur tablette, sans aucune erreur.
  → Prévoir dès le départ une **passerelle Pointer Events** : au doigt, rejouer
  `dragstart` / `dragenter` / `dragover` / `dragleave` / `drop` / `dragend` avec de
  vrais `DragEvent` (et un `DataTransfer` construit). Les gestionnaires existants
  servent tels quels ; la souris n'est pas touchée. Ajouter `touch-action: none` sur
  les poignées, un fantôme qui suit le doigt et un défilement automatique près des bords.
- **Zones sûres sur chaque élément collé à un bord**, pas seulement la barre
  principale : volets latéraux (corbeille, panneaux), modes plein écran et
  éléments `position: fixed` placés sous la barre du haut. Le défaut n'apparaît
  que sur l'appareil (barre d'état d'une tablette par-dessus un volet). Faire
  l'inventaire des `position: fixed` dès qu'on ajoute la réservation.
- **Tester chaque geste au doigt**, pas seulement à la souris : les défauts tactiles
  sont silencieux.
- Les **dépôts imbriqués** (un bloc posé sur un bloc, dans une colonne qui accepte
  aussi les dépôts) doivent appeler `stopPropagation()`, sinon l'action est exécutée
  deux fois. Défaut présent à la souris aussi, révélé par les tests tactiles.
- Un état de glissement doit mémoriser **d'où vient l'élément** (chapitre, scène),
  pas le relire dans l'état courant : une ouverture automatique en cours de
  glissement change l'état courant.

## 3. Stockage

- **Pas de `localStorage` pour les données de l'utilisateur** : 5 à 10 Mo de quota,
  vite saturé dès qu'il y a des images en base64. Utiliser **IndexedDB** dès le départ,
  avec un repli `localStorage` si IndexedDB est indisponible.
- Écriture déclarée réussie seulement après validation sur disque ; écritures
  sérialisées et regroupées ; indicateur visible « Sauvegardé / NON SAUVEGARDÉ ».
- Si la lecture au démarrage échoue, **bloquer les écritures** de la session plutôt
  que d'écraser la base avec une liste vide. Même règle pour chaque magasin (la
  corbeille a failli être perdue ainsi).
- Écrire immédiatement quand l'app passe en arrière-plan (`visibilitychange`) :
  Android peut la tuer sans prévenir.

## 4. Sécurité des fichiers importés

- Sans CSP, **l'échappement est la seule défense** contre un fichier piégé.
  Inventorier tous les `innerHTML` ; échapper tout ce qui vient d'un fichier, y
  compris les identifiants et les attributs (`data-*`, `id`, `value`).
- Les **URL d'images** importées doivent être validées strictement
  (`data:image/…;base64,` uniquement) : une valeur qui sort de l'attribut `src`
  exécute du code.
- Assainir à l'import : types, identifiants (`[A-Za-z0-9_-]`), noms de fichiers
  (pas de `/`, `\`, `..`), clés `__proto__` / `constructor`.
- À l'export, ne construire les chemins d'archive qu'à partir de valeurs sûres
  (sinon « zip slip »).

## 5. Tests

- Un **test d'aller-retour du format de fichier** (écrire puis relire un document
  riche, plus un fichier piégé) avec le **vrai code** de la page, chargé dans
  `node:vm` à partir de repères de section. Il a révélé trois défauts réels.
- `fake-indexeddb` suffit à tester la couche de stockage sous Node.
- Vérifier la syntaxe de chaque `<script>` en ligne (`node --check`) après chaque modification.

## 6. Android : compilation et signature

- **Nettoyer Gradle avant chaque compilation** (`./gradlew clean`) et retirer les
  symboles de débogage du binaire natif : sinon l'APK gonfle (129 Mo pour 20 Mo réels).
- **Clé de signature** créée une fois, hors du dépôt (`~/cles/<app>-release.jks`),
  sauvegardée à deux endroits hors de la machine. La perdre interdit toute mise à jour.
- Ne jamais taper le mot de passe dans un éditeur de terminal (nano a planté et
  laissé un fichier de secours `.save` en clair, **non ignoré par git**). Utiliser un
  script à saisie masquée (`read -s`) qui écrit `keystore.properties` en `umask 077`.
- `build-android.sh --release` refuse de produire un bundle non signé.
- Le versionCode vient de la version : `MAJ×1 000 000 + MIN×1 000 + PATCH`. Il doit
  **toujours augmenter** ; un numéro envoyé une fois est brûlé.
- Les filtres d'intent annoncent des fonctions au système : n'en déclarer aucun
  (ex. « Partager vers ») tant que la fonction n'est pas codée.

## 7. Google Play

- **Type de compte** : un compte personnel récent impose un **test fermé avec au
  moins 12 testeurs inscrits pendant 14 jours consécutifs** avant la production. Les
  testeurs internes ne comptent pas. Un compte organisation (D-U-N-S) en est dispensé :
  à choisir **avant** de créer le compte si l'app est destinée au public.
- Parcours : test interne (soi seul, immédiat, sans examen) → test fermé (examen,
  fiche complète requise) → production.
- Préparer le **dossier de fiche** à l'avance : textes, icône 512 × 512, bannière
  1024 × 500, captures d'écran, réponses aux questionnaires (sécurité des données,
  classification, public cible), **politique de confidentialité en ligne en https**.
  Voir `play-store/PLAY-CONSOLE.md` de Clio comme modèle.
- La signature d'application par Google Play est obligatoire pour un AAB : la clé
  locale devient la clé d'importation.
- Une app installée depuis le Play Store et un APK installé à la main n'ont pas la
  même signature : désinstaller l'un avant d'installer l'autre (exporter les données d'abord).
- Le lien de test seul ne suffit pas : l'adresse Gmail du testeur doit être dans une liste.
- La Play Console peut être pilotée par Claude in Chrome, sauf l'envoi d'un AAB de
  plus de 10 Mo, à glisser à la main. Toute acceptation de conditions et toute
  publication demandent l'accord explicite du propriétaire.

## 8. Publication web (PWA)

- **Manifeste en vrai fichier** (`manifest.webmanifest`, chemins relatifs) et vraies
  icônes PNG 192 / 512 : un manifeste injecté en `data:` n'a pas d'adresse de base
  et son installation n'est pas garantie.
- **GitHub Pages par GitHub Actions** : tests, puis script de build, puis mise en
  ligne à chaque `push` sur `main`. Scripts de build **portables macOS/Linux**
  (`perl -pi` plutôt que `sed -i ''`).
- Toutes les PWA d'un même compte GitHub partagent **la même origine**
  (`<compte>.github.io`) : stockage, caches et service workers voisinent. Préfixer
  chaque clé, base IndexedDB et cache par le nom de l'app, et ne supprimer que ses
  propres caches à l'activation du service worker.
- Le navigateur intégré à l'app Claude refuse les service workers : tester la PWA
  dans un vrai Chrome.
- Une app web en un seul fichier HTML est **lisible par tous** une fois en ligne :
  rendre le dépôt public n'expose que l'historique et la « cuisine ». Protéger par
  une licence explicite et un en-tête de copyright, pas par le secret. Auditer
  l'historique (secrets, adresses, branches d'autres projets) avant de publier.

## 9. Organisation du travail

- **Branche de travail** avant toute série de modifications ; ne committer qu'une
  fois validé sur l'appareil.
- Les agents qui modifient un même fichier unique doivent passer **l'un après
  l'autre**, jamais en parallèle ; finir par un agent vérificateur sceptique.
- Reproduire chaque défaut avant de le corriger, et vérifier sur l'appareil réel :
  le comportement d'un WebView diffère souvent de la documentation.
- Garder une **procédure de publication écrite** (version → tests → build signé →
  envoi → testeurs) et un fichier `A-FAIRE.md` pour les points en suspens.
