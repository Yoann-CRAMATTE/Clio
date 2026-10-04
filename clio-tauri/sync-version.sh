#!/usr/bin/env bash
# Aligne les numéros de version sur src/AppInfo.json, seule source de vérité.
#
#   ./sync-version.sh
#
# tauri.conf.json n'a rien à recopier : son champ "version" pointe sur
# ../src/AppInfo.json, que Tauri lit lui-même (il accepte le chemin de tout
# fichier JSON portant un champ "version"). Restent package.json et Cargo.toml,
# qui exigent une valeur littérale : ce script les réécrit. Il est appelé par
# build-web.sh et build-android.sh ; le lancer à la main après un changement de
# version suffit sinon. Sans effet quand tout est déjà aligné.
set -euo pipefail

cd "$(dirname "$0")"

VERSION="$(sed -n 's/^  "version": "\([^"]*\)".*/\1/p' src/AppInfo.json | head -1)"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✗ version illisible dans src/AppInfo.json : « ${VERSION} »" >&2
  exit 1
fi

# package.json : le champ "version" de premier niveau, indenté de deux espaces.
# perl -pi plutôt que sed -i : même syntaxe sous macOS et Linux (GitHub Actions).
perl -pi -e "s/^  \"version\": \"[^\"]*\"/  \"version\": \"${VERSION}\"/" package.json

# Cargo.toml : seule la version du paquet, en tête de [package] — pas celles
# des dépendances, écrites en ligne sous la forme { version = "2", … }.
perl -pi -e "s/^version = \"[^\"]*\"/version = \"${VERSION}\"/" src-tauri/Cargo.toml

echo "→ version ${VERSION} alignée (package.json, Cargo.toml ; tauri.conf.json lit AppInfo.json)"
