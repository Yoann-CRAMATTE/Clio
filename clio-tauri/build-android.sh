#!/usr/bin/env bash
# Compilation Android de Clio (Tauri v2).
#   ./build-android.sh            → APK debug, arm64 seulement (rapide)
#   ./build-android.sh --release  → APK/AAB de release, toutes architectures
#
# NOTE tauri.conf.json : le champ security.csp reste à null, volontairement.
# Tauri injecte un nonce dans script-src, or la spec CSP neutralise
# 'unsafe-inline' dès qu'un nonce est présent. Comme tout le JavaScript de Clio
# est inline (3 blocs <script> et 105 attributs onclick), la moindre CSP rend
# l'application entièrement inerte : l'interface s'affiche, rien ne réagit.
# Aucun cloisonnement réseau n'est donc en place : le manifeste garde la
# permission INTERNET, faute de pouvoir garantir que le WebView charge encore
# http://tauri.localhost sans elle (voir le commentaire d'AndroidManifest.xml).
# Ce qui tient lieu de garde-fou : Clio n'émet aucune requête, JSZip et les
# polices sont embarqués.
set -euo pipefail

cd "$(dirname "$0")"

# Rust n'est pas dans le PATH par défaut : rustup a été installé sans modifier le shell.
. "$HOME/.cargo/env"

# Le JDK Homebrew n'est pas lié dans /usr/bin ; Gradle a besoin du chemin explicite.
export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"

# package.json et Cargo.toml suivent src/AppInfo.json ; tauri.conf.json le lit
# directement. Le versionCode Android en découle : x.y.z → x·1000000 + y·1000 + z.
./sync-version.sh

# Repère temporel : tout APK antérieur à ce point vient d'un build précédent.
REPERE="$(mktemp)"
trap 'rm -f "$REPERE"' EXIT

# Gradle réécrit l'APK de façon incrémentale et y laisse les données de la
# compilation précédente : l'archive gonfle build après build (129 Mo observés
# pour 20 Mo de contenu réel). Le nettoyage coûte moins d'une seconde, le cache
# de compilation Rust n'est pas touché.
(cd src-tauri/gen/android && ./gradlew clean >/dev/null 2>&1) || true

if [[ "${1:-}" == "--release" ]]; then
  # Google Play demande un AAB signé. Sans magasin de clés, Gradle produit un
  # bundle non signé que le Store refusera : autant s'arrêter tout de suite,
  # avec l'indication de ce qui manque.
  if [[ ! -f src-tauri/gen/android/keystore.properties ]]; then
    echo "✗ keystore.properties introuvable dans src-tauri/gen/android/" >&2
    echo "  Sans lui, le bundle sortirait non signé et Google Play le refuserait." >&2
    echo "  Marche à suivre : docs/PLATEFORMES.md, section « Publier sur le Play Store »." >&2
    exit 1
  fi
  echo "→ Build de release, toutes architectures"
  npm run tauri android build
else
  echo "→ Build de debug, cible aarch64"
  npm run tauri android build -- --debug --target aarch64
fi

if [[ "${1:-}" == "--release" ]]; then
  echo
  echo "Bundle pour Google Play :"
  find src-tauri/gen/android/app/build/outputs -name "*.aab" -exec ls -lh {} \;
fi

echo
echo "APK produits :"
find src-tauri/gen/android/app/build/outputs -name "*.apk" -exec ls -lh {} \;

# Dossier des versions : une archive, pas un banc d'essai. Chaque version garde
# son sous-dossier (AAB pour Google Play, APK pour une installation directe,
# notes tirées du changelog), pour retrouver exactement ce qui a été publié.
# Il vit dans le dossier EuropaSoft du projet ; CLIO_VERSIONS permet d'en changer.
DEPOT_RACINE="${CLIO_VERSIONS:-$HOME/Documents/EuropaSoft/06_PROJETS_INTERNE/Clio/Versions}"
VERSION="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' src/AppInfo.json | head -1)"
SUFFIXE=$([[ "${1:-}" == "--release" ]] && echo "release" || echo "debug")
DEPOT="$DEPOT_RACINE/$VERSION"
mkdir -p "$DEPOT"

# Garde-fou : ne déposer que des fichiers réellement produits par CETTE
# exécution. Un binaire périmé se testerait, ou se publierait, sans qu'on le sache.
frais() { [[ -n "$1" && ! "$1" -ot "$REPERE" ]]; }

apk="$(find src-tauri/gen/android/app/build/outputs -name '*.apk' | head -1)"
if ! frais "$apk"; then
  echo "✗ aucun APK frais produit — le dossier de version n'est pas mis à jour" >&2
  exit 1
fi
cp "$apk" "$DEPOT/Clio-${VERSION}-android-${SUFFIXE}.apk"

if [[ "$SUFFIXE" == "release" ]]; then
  aab="$(find src-tauri/gen/android/app/build/outputs -name '*.aab' | head -1)"
  if ! frais "$aab"; then
    echo "✗ aucun AAB frais produit — rien à envoyer à Google Play" >&2
    exit 1
  fi
  cp "$aab" "$DEPOT/Clio-${VERSION}-play.aab"
fi

# Notes de version, prêtes à coller dans la Play Console (500 caractères max).
python3 - "$VERSION" > "$DEPOT/NOTES.md" <<'PY'
import json, sys
v = sys.argv[1]
info = json.load(open('src/AppInfo.json'))
e = next((c for c in info.get('changelog', []) if c.get('version') == v), None)
print(f"# Clio {v}" + (f" — {e['date']}" if e else ""))
print()
for ligne in (e or {}).get('changes', []):
    print(f"- {ligne}")
PY

echo
echo "→ version $VERSION déposée dans $DEPOT :"
ls -lh "$DEPOT" | tail -n +2
