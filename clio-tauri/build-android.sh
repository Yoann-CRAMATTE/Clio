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
# Le cloisonnement réseau passe donc par l'absence de la permission INTERNET
# dans AndroidManifest.xml — garantie par le système, pas par le moteur de rendu.
set -euo pipefail

cd "$(dirname "$0")"

# Rust n'est pas dans le PATH par défaut : rustup a été installé sans modifier le shell.
. "$HOME/.cargo/env"

# Le JDK Homebrew n'est pas lié dans /usr/bin ; Gradle a besoin du chemin explicite.
export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"

# Repère temporel : tout APK antérieur à ce point vient d'un build précédent.
REPERE="$(mktemp)"
trap 'rm -f "$REPERE"' EXIT

# Gradle réécrit l'APK de façon incrémentale et y laisse les données de la
# compilation précédente : l'archive gonfle build après build (129 Mo observés
# pour 20 Mo de contenu réel). Le nettoyage coûte moins d'une seconde, le cache
# de compilation Rust n'est pas touché.
(cd src-tauri/gen/android && ./gradlew clean >/dev/null 2>&1) || true

if [[ "${1:-}" == "--release" ]]; then
  echo "→ Build de release (signature requise, voir keystore.properties)"
  npm run tauri android build
else
  echo "→ Build de debug, cible aarch64"
  npm run tauri android build -- --debug --target aarch64
fi

echo
echo "APK produits :"
find src-tauri/gen/android/app/build/outputs -name "*.apk" -exec ls -lh {} \;

# Dépôt de transfert vers tablette et téléphone : le dossier Developer n'est pas
# synchronisé, celui-ci l'est. C'est par là que passent les APK.
DEPOT="$HOME/Documents/APK"
VERSION="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' AppInfo.json | head -1)"
SUFFIXE=$([[ "${1:-}" == "--release" ]] && echo "release" || echo "debug")

mkdir -p "$DEPOT"
cible="$DEPOT/Clio-${VERSION}-android-${SUFFIXE}.apk"

# Le dépôt est un banc d'essai, pas une archive : il ne doit jamais contenir
# qu'un seul APK de Clio — celui à tester maintenant. On retire donc les
# précédents, y compris quand le nom change (version ou debug → release).
find "$DEPOT" -maxdepth 1 -name 'Clio-*-android-*.apk' ! -name "$(basename "$cible")" -print -delete

apk="$(find src-tauri/gen/android/app/build/outputs -name '*.apk' | head -1)"

# Garde-fou : ne déposer qu'un APK réellement produit par CETTE exécution.
# Un binaire périmé sur le banc d'essai se testerait sans qu'on le sache.
if [[ -z "$apk" || "$apk" -ot "$REPERE" ]]; then
  echo "✗ aucun APK frais produit — le dépôt n'est pas mis à jour" >&2
  exit 1
fi

cp "$apk" "$cible"
echo "→ déposé dans $cible ($(du -h "$cible" | cut -f1))"
