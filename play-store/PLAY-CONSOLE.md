# Clio sur Google Play — dossier de mise en ligne

Tout ce qu'il faut pour créer Clio dans la Play Console et la publier en **test
interne**. Les champs sont prêts à copier-coller. Les étapes marquées 🔒 demandent
l'accord explicite de Yoann avant d'être validées.

## 1. Identité

| Champ | Valeur |
|---|---|
| Compte développeur | Personnel, Yoann CRAMATTE (règle des 12 testeurs × 14 jours avant production) |
| Nom de l'application | `Clio` |
| Nom du paquet | `eu.europasoft.clio` (fixé par l'AAB, ne peut plus changer ensuite) |
| Langue par défaut | Français (France) – fr-FR |
| Type | Application |
| Gratuite ou payante | Gratuite (⚠ irréversible : une app gratuite ne peut plus devenir payante) |
| Version | 1.0.2 — versionCode 1000002 |
| E-mail de contact | `accueil@europasoft.eu` |
| Site web | `https://www.europasoft.eu` |
| Politique de confidentialité | `https://europasoft.eu/clio/confidentialite.html` (à mettre en ligne — voir § 6) |

## 2. Fichiers

| Fichier | Usage |
|---|---|
| `~/Documents/EuropaSoft/06_PROJETS_INTERNE/Clio/Versions/<version>/Clio-<version>-play.aab` (~13 Mo) | Bundle signé à envoyer dans la release. **Trop lourd pour l'outil d'envoi de Claude (limite 10 Mo) : Yoann le glisse lui-même dans la page.** |
| `play-store/images/icone-512.png` | Icône de la fiche (512 × 512) |
| `play-store/images/banniere-1024x500.png` | Image de présentation (1024 × 500) |
| `clio-tauri/src/confidentialite.html` (publiée avec la version web) | Politique de confidentialité, à héberger |

Captures d'écran téléphone (2 minimum) : **pas nécessaires pour le test interne**,
obligatoires pour le test fermé. À faire sur le téléphone une fois Clio installée.

## 3. Textes de la fiche

**Description courte** (80 caractères max) :

```
Écrivez votre roman par fragments, puis assemblez-le. Sans compte, hors ligne.
```

**Description complète** :

```
Clio est l'atelier de l'écrivain : un traitement de texte pensé pour les romanciers qui écrivent par fragments.

Une scène, une réplique, une idée : chaque fragment est un bloc que vous écrivez librement, puis que vous déplacez dans sa scène, vers une autre scène ou un autre chapitre. Le texte final se reconstitue à la lecture et à l'export.

ÉCRIRE
• Livres, chapitres, scènes et blocs, réorganisables à volonté
• Notes en marge, couleurs d'accent et images pour chaque bloc
• Mode focus pour écrire sans distraction
• Objectif de mots et suivi de l'écriture au jour le jour

CONSTRUIRE L'UNIVERS
• Fiches personnages et lieux, avec repérage de leurs mentions dans le texte
• Sections spéciales : préface, glossaire, index, répertoire, registre…

RELIRE ET PARTAGER
• Mode lecture pour relire le livre d'une traite
• Export EPUB, PDF, Markdown et texte
• Format .clio ouvert et documenté, pour garder la maîtrise de vos fichiers

VOS TEXTES VOUS APPARTIENNENT
Clio ne collecte aucune donnée : pas de compte, pas de publicité, pas de suivi. Vos livres restent sur votre appareil et dans les fichiers .clio que vous enregistrez vous-même. L'application fonctionne entièrement hors ligne.

Clio est développée par EuropaSoft.
```

**Notes de version 1.0.2** (500 caractères max) :

```
<fr-FR>
Première version de test.
• Livres enregistrés dans une base locale plus robuste, sans limite de quelques Mo
• Ouverture des fichiers .clio renforcée contre les fichiers malveillants
• Diverses corrections de stabilité
</fr-FR>
```

## 4. Catégorie et coordonnées

- Catégorie : **Application → Productivité**
- Tags (si proposés) : Écriture, Traitement de texte
- E-mail : `accueil@europasoft.eu` — site : `https://www.europasoft.eu` — téléphone : laisser vide

## 5. Contenu de l'application (questionnaires)

Réponses vérifiées dans le code : aucune requête réseau, aucun SDK tiers, aucun compte.

| Rubrique | Réponse |
|---|---|
| Politique de confidentialité | URL publique de `confidentialite.html` (§ 6) |
| Accès à l'application | « Toutes les fonctionnalités sont disponibles sans accès spécial » (pas de connexion) |
| Annonces | Non, l'application ne contient pas d'annonces |
| Classification du contenu (IARC) | Catégorie « Toutes les autres applications » (utilitaire / productivité) ; répondre **Non** à toutes les questions (violence, sexualité, langage, drogues, jeux d'argent). Interaction entre utilisateurs : **Non**. Partage de position : **Non**. Achats numériques : **Non**. |
| Public cible | **18 ans et plus** (évite les obligations « Familles » ; l'app ne vise pas les enfants) |
| L'app attire-t-elle les enfants ? | Non |
| Sécurité des données | Collecte de données : **Non**. Partage de données : **Non**. (Le chiffrement en transit et la suppression sur demande ne s'appliquent pas puisque rien n'est collecté.) |
| Application gouvernementale | Non |
| Fonctionnalités financières | Aucune |
| Santé | Aucune fonctionnalité santé |
| Application d'actualités | Non |
| Identifiant publicitaire | Non utilisé |

## 6. Politique de confidentialité : où l'héberger

Google exige une **URL publique en https**. Options, de la plus simple à la plus propre :
1. Déployer la version web (`build-web.sh`) sur `www.europasoft.eu` (par ex. `https://www.europasoft.eu/clio/confidentialite.html`).
2. La joindre à la version web de Clio (`build-web.sh`), qui doit de toute façon être déployée en https.

Pour le **test interne seul**, la Play Console tolère souvent de différer ce point ;
il devient bloquant pour le test fermé.

## 7. Déroulé dans la Play Console

1. **Créer l'application** : « Créer une application » → champs du § 1 → 🔒 cocher les deux déclarations (règlement du programme Développeurs, lois export américaines) → Créer.
2. **Test interne → Testeurs** : créer la liste « Moi » avec l'adresse Gmail du téléphone de test → Enregistrer.
3. **Test interne → Créer une release** :
   - 🔒 accepter la **signature d'application par Google Play** (la clé `~/cles/clio-release.jks` devient la clé d'importation) ;
   - Yoann glisse `Clio-1.0.2-play.aab` dans la zone d'envoi ;
   - nom de la release : `1.0.2` ; notes : § 3 ;
   - Suivant → 🔒 **Enregistrer et publier**.
4. **Testeurs** : copier le lien d'invitation, l'ouvrir sur le téléphone, accepter, installer depuis le Play Store.
5. Si la console bloque la release sur des tâches de configuration : les remplir avec le § 5.

## 8. Plus tard (test fermé puis production)

- Captures d'écran téléphone (2 à 8), éventuellement tablette 7" et 10".
- Politique de confidentialité en ligne (§ 6).
- Au moins 12 testeurs inscrits pendant 14 jours consécutifs, puis demande d'accès à la production.
- Avant chaque nouvel envoi : augmenter la version dans `clio-tauri/src/AppInfo.json`, puis `./build-android.sh --release`.
