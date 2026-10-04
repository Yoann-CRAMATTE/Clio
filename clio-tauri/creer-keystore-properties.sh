#!/usr/bin/env bash
# Crée src-tauri/gen/android/keystore.properties sans afficher le mot de passe.
# Le fichier est exclu de git ; il ne doit jamais être versionné.
set -euo pipefail
cd "$(dirname "$0")"
CIBLE="src-tauri/gen/android/keystore.properties"
read -r -s -p "Mot de passe du magasin de clés : " MDP; echo
read -r -s -p "Confirmation : " MDP2; echo
[[ "$MDP" == "$MDP2" ]] || { echo "✗ Les deux saisies diffèrent, rien n'est écrit." >&2; exit 1; }
umask 077
printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=clio\nkeyPassword=%s\n' \
  "$HOME/cles/clio-release.jks" "$MDP" "$MDP" > "$CIBLE"
echo "✓ $CIBLE écrit (lisible par vous seul)."
