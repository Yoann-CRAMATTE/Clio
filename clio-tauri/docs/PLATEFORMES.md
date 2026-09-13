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
natif maison (`ClioOuvrir`) qui n'existe pas dans ce portage : les
`intent-filter` du manifeste font apparaître Clio dans « Partager » et « Ouvrir
avec », mais **le fichier reçu n'est pas encore chargé**. Reste à porter.

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

**Numéro de version.** `versionCode` et `versionName` viennent de la version
déclarée dans `tauri.conf.json` : `1.0.0` donne le code `1000000`. Google Play
refuse un dépôt dont le `versionCode` n'est pas strictement supérieur au
précédent — incrémenter la version dans `tauri.conf.json` et dans
`AppInfo.json` avant chaque publication.

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
`fonts.css`, `fonts/` (22 fichiers woff2) et `vendor/jszip.min.js`. Pour la
version en ligne, déployer le dossier `src/` entier.

Sur le web, `SOUS_TAURI` vaut `false` et le comportement d'origine s'applique :
API File System Access quand le navigateur la propose, `<input type="file">`
sinon. Vérifier les deux chemins après chaque modification.
