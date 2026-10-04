# À faire — Clio

Points en attente, notés pour ne pas les oublier. Retirer une ligne une fois réglée.

## Clé de signature Android (créée le 2026-10-04)

- [ ] **Sauvegarder `~/cles/clio-release.jks` et son mot de passe à deux endroits hors du Mac**
      (clé USB + coffre chiffré). Perdre la clé interdit toute mise à jour de Clio sur Google Play.
- [ ] **Vider la Corbeille** : elle contient `keystore.properties.save`, fichier de secours laissé
      par nano lors du plantage du terminal, qui contient le mot de passe en clair.
- [ ] **Décider du sort de `clio-tauri/creer-keystore-properties.sh`** (saisie masquée du mot de
      passe vers `keystore.properties`) : le documenter dans `docs/PLATEFORMES.md`, ou le supprimer.
