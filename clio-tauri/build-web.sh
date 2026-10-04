#!/usr/bin/env bash
# Produit le dossier web autonome de Clio, prêt à déposer sur un hébergement
# statique (site EuropaSoft, GitHub Pages, n'importe quel serveur de fichiers).
#
#   ./build-web.sh            → ../web/Clio/
#   ./build-web.sh <chemin>   → <chemin>/Clio/
#
# Le dossier produit est une SORTIE : ne jamais l'éditer à la main. La source
# unique reste src/, partagée avec les applications empaquetées par Tauri.
set -euo pipefail

cd "$(dirname "$0")"

DEST="${1:-../web}/Clio"
# AppInfo.json vit dans src/ : la page le lit au démarrage, il part donc avec
# elle dans le dossier produit. Le premier "version" est celui de l'application,
# ceux du journal viennent après.
VERSION="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' src/AppInfo.json | head -1)"
./sync-version.sh
BUILD="$(sed -n 's/.*build: *"\([^"]*\)".*/\1/p' src/index.html | head -1)"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R src/. "$DEST/"

# Le service worker porte la version : la changer suffit à écarter l'ancien
# cache chez tous les utilisateurs, au lancement suivant. Sans cette
# substitution, une mise à jour déposée pourrait rester invisible.
if [[ -f "$DEST/service-worker.js" ]]; then
  perl -pi -e "s/__VERSION__/${VERSION}-${BUILD}/" "$DEST/service-worker.js"
fi

echo "Dossier web produit : $DEST"
echo "  version    : ${VERSION}-${BUILD}"
echo "  fichiers   : $(find "$DEST" -type f | wc -l | tr -d ' ')"
echo "  poids      : $(du -sh "$DEST" | cut -f1 | tr -d ' ')"
echo
echo "À déposer tel quel. L'application répondra alors sur <votre-site>/Clio/"
echo "Une adresse https:// est nécessaire à l'installation en PWA."
