# Clio — contraintes de plateforme et pièges de compilation

Ce document rassemble ce qui ne doit **pas** vivre dans `src/index.html` : les
règles de compilation, les contraintes propres à chaque cible, et les pièges
déjà rencontrés. Le HTML reste la base commune du comportement, partagée par la
version en ligne et par tous les installables.

**Règle de partage.** Une modification qui change ce que fait Clio va dans
`src/index.html`, derrière le drapeau `SOUS_TAURI` si elle est spécifique à
l'empaquetage. Une modification qui change *comment on fabrique* l'application
va ici, dans `build-android.sh`, ou dans la configuration Tauri.

---

## Android

### La CSP rend l'application entièrement inerte

`app.security.csp` doit rester à `null` dans `tauri.conf.json`.

Tauri injecte un nonce dans `script-src`. La spécification CSP prévoit que
`'unsafe-inline'` est ignoré dès qu'un nonce ou un hash est présent. Or tout le
JavaScript de Clio est en ligne : trois blocs `<script>` et plus de cent
attributs `onclick`. Avec la moindre CSP, rien ne s'exécute.

Le symptôme trompe : l'interface s'affiche normalement, mais aucun bouton ne
répond et le thème enregistré ne s'applique pas. Message exact du moteur :

> Executing inline event handler violates the following Content Security Policy
> directive… Note that 'unsafe-inline' is ignored if either a hash or nonce
> value is present in the source list.

Pour cloisonner le réseau, ne pas compter sur la CSP. La voie serait de retirer
`android.permission.INTERNET` du manifeste — mais Tauri sert ses assets via
`http://tauri.localhost`, et rien ne garantit que le WebView puisse émettre ces
requêtes sans la permission. À ne tenter qu'avec un appareil sous la main.
En l'état, la permission est **conservée** : aucun cloisonnement réseau n'est
en place, seule l'absence de tout appel réseau dans le code en tient lieu.

### Aucune API fichier du navigateur ne fonctionne

`showOpenFilePicker`, `showSaveFilePicker` et `showDirectoryPicker` n'existent
pas dans le WebView Android. `<a download>` sur une URL blob y est sans effet,
silencieusement. Clio passe donc par les greffons Tauri `dialog` et `fs`, via le
pont défini dans `src/index.html`.

Conséquence à retenir : un échec de sortie de fichier est **muet**. Un bouton
sans réaction ne veut pas dire qu'il n'est pas câblé, mais que la voie de sortie
n'existe pas. Le pont vérifie donc la taille écrite après coup.

### Le sélecteur perd sa navigation sans filtre

Le greffon `dialog` construit `EXTRA_MIME_TYPES` à partir des filtres. Sans
aucun filtre, il transmet un tableau **vide**, qu'Android interprète comme
« aucun type accepté » : le sélecteur perd son menu latéral et reste bloqué sur
Téléchargements. Passer un filtre unique — « tous les fichiers » — évite cet
extra et rend la navigation.

### L'extension .clio est inconnue d'Android

Android n'a pas `.clio` dans sa table de types et l'étiquette « Fichier BIN ».
Deux conséquences :

- Ne poser **aucun filtre d'extension** à l'ouverture, sinon les `.clio` sont
  grisés et non sélectionnables.
- Le suffixe `.clio.zip` était un contournement du sélecteur de Capacitor. Il
  n'a plus lieu d'être sous Tauri : l'auteur choisit l'emplacement lui-même.

### Le système dessine par-dessus la page

Barre d'état en haut, barre de geste en bas, encoche sur un côté en paysage :
sans réservation, le chrome de Clio passe dessous et devient illisible. La page
déclare `viewport-fit=cover`, et quatre jetons définis sur `:root` exposent les
valeurs réelles : `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right`.

Hors mobile, `env(safe-area-inset-*)` vaut zéro : la version web n'est pas
touchée, sans avoir à distinguer les plateformes à l'exécution.

Deux pièges rencontrés, tous deux silencieux :

- **Ne pas enfermer la réservation dans une media query mobile.** Elle ne visait
  que `max-width: 700px`, alors qu'une tablette en paysage dépasse tous les
  points de rupture tout en ayant une barre d'état. La réservation appartient à
  la règle de base.
- **Proscrire le raccourci `padding` dans les media queries** sur un élément qui
  réserve une zone sûre : `padding: 0 1rem` remet `padding-top` à zéro. La
  hauteur de la barre augmente, mais le contenu reste sous la barre du système —
  le défaut se voit mal. Employer la forme longue.

Vérifier en surchargeant les jetons dans la console, à plusieurs largeurs, plutôt
qu'en se fiant à l'inspection visuelle d'une seule taille.

### Capacitor n'existe plus

Tout le code mobile d'origine passait par `window.Capacitor`. Sous Tauri cet
objet est absent, donc `surMobileNatif()` renvoie `false` et Clio se croit sur
un ordinateur. La fonction `reclamerFichierRecu()` attend en outre un greffon
natif maison (`ClioOuvrir`) qui n'existe pas dans ce portage : l'`intent-filter`
VIEW du manifeste fait apparaître Clio dans « Ouvrir avec », mais **le fichier
reçu n'est pas encore chargé**. Reste à porter. Le filtre SEND (« Partager →
Clio ») a été retiré en attendant : le rétablir en même temps que la réception.

---

## Compilation

### Toujours nettoyer avant de compiler

Gradle réécrit l'APK de façon incrémentale et y laisse les données de la
compilation précédente. Observé : une archive de 129 Mo pour 20 Mo de contenu
réel, soit 109 Mo de données mortes. `build-android.sh` lance donc
`gradlew clean` à chaque fois — cela coûte moins d'une seconde et ne touche pas
le cache de compilation Rust.

### Retirer les symboles de débogage

Le profil `dev` de `Cargo.toml` force `debug = false` et `strip = true`. Sans
cela la bibliothèque native pèse près de 130 Mo à elle seule. Remettre
`debug = true` uniquement pour déboguer le code Rust.

Avec ces deux mesures, l'APK de test fait environ 20 Mo.

### Variables d'environnement obligatoires

Ni Rust ni le JDK ne sont dans le `PATH` par défaut sur cette machine.
`build-android.sh` exporte les trois nécessaires : `JAVA_HOME` (openjdk@17 de
Homebrew), `ANDROID_HOME` et `NDK_HOME`. Sans elles, Gradle et Cargo échouent.

### Publier sur le Play Store

Google Play demande un **AAB** signé, pas un APK. La configuration de signature
est en place dans `app/build.gradle.kts` ; il manque la clé, que seul le
propriétaire du compte doit créer et détenir.

**1. Créer le magasin de clés** — une fois pour toutes, hors du dépôt :

```bash
keytool -genkeypair -v \
  -keystore ~/cles/clio-release.jks \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -alias clio
```

Conserver ce fichier et son mot de passe **hors du dépôt et sauvegardés** :
perdre la clé interdit toute mise à jour de l'application publiée, sans recours
autre que la republier sous une autre identité.

**2. Déclarer la clé** dans `src-tauri/gen/android/keystore.properties` — ce
fichier est exclu du dépôt par `.gitignore`, il ne doit jamais y entrer :

```properties
storeFile=/Users/<vous>/cles/clio-release.jks
storePassword=…
keyAlias=clio
keyPassword=…
```

**3. Produire le bundle** :

```bash
cd clio-tauri
./build-android.sh --release
```

L'AAB sort dans `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/`.
Le script en range une copie, avec l'APK et les notes tirées du changelog, dans
`~/Documents/EuropaSoft/06_PROJETS_INTERNE/Clio/Versions/<version>/` : une archive
où chaque version publiée garde son sous-dossier. La variable `CLIO_VERSIONS`
change cet emplacement.

**Numéro de version.** `versionCode` et `versionName` viennent de la version
lue par `tauri.conf.json` : `x.y.z` donne le code `x·1000000 + y·1000 + z`
(`1.0.2` → `1000002`). Google Play refuse un dépôt dont le `versionCode` n'est
pas strictement supérieur au précédent — incrémenter la version dans
`src/AppInfo.json` avant chaque publication, et jamais réutiliser un numéro
déjà présent dans son journal.

### Une seule source pour la version : `src/AppInfo.json`

L'identité de l'application (nom, version, entreprise, contact, copyright,
description, journal) n'est écrite qu'à un endroit : `src/AppInfo.json`. Il vit
dans `src/` parce que la page le lit au démarrage (`fetch('AppInfo.json')`,
qui remplit `APP_CONFIG`) — même chemin sur le web et sous Tauri, et le service
worker le met en cache avec les fichiers essentiels pour le hors-ligne. En
`file://`, le fetch est refusé : la page garde alors un repli minimal (nom,
entreprise, version vide).

Les fichiers de fabrication suivent :

| Fichier | Comment il suit |
|---|---|
| `src-tauri/tauri.conf.json` | `"version": "../src/AppInfo.json"` — Tauri lit le champ `version` de ce JSON lui-même (chemin relatif à `src-tauri/`). |
| `package.json` | réécrit par `sync-version.sh` |
| `src-tauri/Cargo.toml` | réécrit par `sync-version.sh` (version du paquet seulement) |

`sync-version.sh` est appelé par `build-web.sh` et `build-android.sh` ; après
un changement de version hors de ces scripts (un `cargo` ou `tauri dev` direct),
le lancer à la main. La documentation de Tauri parle d'un chemin vers un
`package.json`, mais le code (`tauri-utils`, `PackageVersion`) accepte tout
fichier JSON portant un champ `version` : vérifié avec `cargo check` en
tauri-utils 2.9.3. Si une version future de Tauri se limitait à
`package.json`, pointer sur `"../package.json"`, que `sync-version.sh` tient
déjà à jour.

**Attention aux fichiers générés.** `gen/android/` est produit par Tauri. La
configuration de signature, les `intent-filter` et les ajustements du manifeste
y vivent : un `tauri android init` les écraserait. Les vérifier après toute
régénération.

### Portée des cibles

Depuis le Mac : Android, iOS et macOS. Windows et Linux exigent leur propre
machine ou un CI.

---

## Web

Depuis le retrait des CDN, `index.html` n'est plus autonome. Il référence
`fonts.css`, `fonts/` (22 fichiers woff2), `vendor/jszip.min.js` et `AppInfo.json`. Pour la
version en ligne, déployer le dossier `src/` entier.

Sur le web, `SOUS_TAURI` vaut `false` et le comportement d'origine s'applique :
API File System Access quand le navigateur la propose, `<input type="file">`
sinon. Vérifier les deux chemins après chaque modification.

### Stockage local : IndexedDB, repli localStorage

Les livres et la corbeille sont dans la base IndexedDB `clio-livres`
(magasin `donnees`, clés `clio-books` et `clio-trash`, même texte JSON
qu'autrefois). IndexedDB existe partout où Clio tourne — navigateurs,
WKWebView (macOS, iOS), WebView2 (Windows), WebView Android — et n'a pas le
plafond de 5 à 10 Mo de `localStorage`. Les petits réglages restent dans
`localStorage`.

- **Migration** : au premier lancement, chaque ancienne clé `localStorage` est
  recopiée, relue et comparée ; `meta/migration` n'est posé qu'ensuite, avec le
  témoin `localStorage['clio-stockage'] = 'indexeddb'`. En cas d'échec, la
  session reste sur `localStorage` et la migration est retentée.
- **Anciennes clés conservées** en filet de sécurité, figées au jour de la
  migration. À supprimer au plus tôt en 1.1, si `meta/migration.date` a plus
  de 60 jours.
- **Repli** : IndexedDB absente ou muette plus de 5 s → `localStorage`. Si le
  témoin dit que la migration avait eu lieu, l'auteur est prévenu qu'il voit
  la copie figée.
- **Origine** : comme `localStorage`, la base est cloisonnée par origine
  (`http://tauri.localhost`, `tauri://localhost`, l'adresse web, `file://`).
  Changer d'origine — par exemple le schéma Tauri — revient à partir d'une
  bibliothèque vide.
