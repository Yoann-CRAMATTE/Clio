# Le format `.clio` — norme

**Version du format : 2.0** · Établi par EuropaSoft · Dernière révision : 2026-08-30

Ce document décrit le format de fichier `.clio` de façon autonome. Il suffit à
écrire un lecteur ou un producteur de `.clio` sans disposer du code de Clio.

---

## 1. Objet et principes

Un `.clio` contient **une œuvre et une seule** : le livre, ses chapitres, ses
scènes, ses blocs, ses personnages, ses lieux et ses images.

Trois principes gouvernent le format :

1. **Lisible sans outil.** L'archive est un ZIP ordinaire et tout son contenu
   est du JSON en clair. Un `.clio` s'ouvre avec n'importe quel décompresseur et
   se lit dans un éditeur de texte.
2. **Le texte reste du texte.** Le champ `text` d'un bloc ne contient aucune
   balise, aucun identifiant, aucune structure parallèle. Un fichier ouvert
   dans un éditeur tiers reste un manuscrit lisible.
3. **La validité vient du manifeste, jamais de l'extension.** Un lecteur ne doit
   pas se fier au nom du fichier pour décider s'il sait l'ouvrir.

---

## 2. Enveloppe

| Propriété | Valeur |
|---|---|
| Conteneur | Archive **ZIP** |
| Compression | **DEFLATE** |
| Encodage des fichiers internes | **UTF-8**, sans BOM |
| Type MIME | `application/zip` |
| Type uniforme Apple (UTI) | `eu.europasoft.clio.livre`, conforme à `public.zip-archive` |

Aucun chiffrement, aucun mot de passe, aucune signature.

---

## 3. Extension du fichier

L'extension normale est **`.clio`**.

### 3.1 La variante `.clio.zip` — contrainte Android

Android ne connaît pas l'extension `.clio` dans sa table de types. Un fichier
ainsi nommé y devient inexploitable :

- il n'apparaît pas dans les téléchargements de Google Drive ;
- il s'affiche grisé et non sélectionnable dans les sélecteurs de fichiers ;
- le symptôme est identique dans une application empaquetée et dans Chrome, ce
  qui écarte la responsabilité de l'application.

**Règle.** Sur Android, un producteur écrit `<Titre>.clio.zip`. Sur toute autre
plateforme, il écrit `<Titre>.clio`.

**À la lecture, l'extension n'est jamais vérifiée.** Les deux formes sont
strictement interchangeables : un fichier produit sur une plateforme s'ouvre sur
toutes les autres.

> Conséquence pour le travail multi-appareils : un `.clio` déposé sur un espace
> en ligne depuis un ordinateur restera inexploitable depuis Android tant qu'il
> n'aura pas reçu le suffixe `.zip`. Le renommer suffit — le contenu est
> identique.

---

## 4. Arborescence de l'archive

```
<archive>.clio
├── manifest.json                 (obligatoire)
├── book.json                     (obligatoire)
├── chapters/                     (obligatoire, ≥ 1 entrée)
│   ├── ch-001.json
│   ├── ch-002.json
│   └── ch-NNN.json
└── images/                       (facultatif)
    ├── <imageId>.<ext>
    └── …
```

| Chemin | Rôle | Obligatoire |
|---|---|---|
| `manifest.json` | Identifie l'archive et la version du format | oui |
| `book.json` | Le livre **sans** ses chapitres | oui |
| `chapters/ch-NNN.json` | Un chapitre par fichier, dans l'ordre du livre | oui, ≥ 1 |
| `images/` | Les binaires des images, extraits des blocs | non |

Aucun autre fichier n'est défini. Un lecteur **ignore** les entrées qu'il ne
connaît pas plutôt que de rejeter l'archive : cela réserve la place à des
extensions futures.

### 4.1 Nommage des chapitres

`ch-` suivi d'un **numéro à trois chiffres**, à partir de `001`, dans l'ordre du
livre : `ch-001.json`, `ch-002.json`, … `ch-014.json`.

Au-delà de 999 chapitres, le numéro s'allonge naturellement (`ch-1000.json`) ;
le tri décrit en §9 reste correct tant que la largeur est homogène, et un
producteur devrait alors passer à quatre chiffres pour l'ensemble de l'archive.

### 4.2 Nommage des images

`images/<imageId>.<ext>` où `<imageId>` est l'`id` de l'image et `<ext>` la
partie du type MIME située **après la barre oblique** : `image/jpeg` → `jpeg`,
`image/png` → `png`.

---

## 5. `manifest.json`

```json
{
  "app": "Clio",
  "version": "1.1.0",
  "format": "2.0",
  "created": "2026-04-27T10:00:00.000Z",
  "saved": "2026-08-30T09:41:12.512Z"
}
```

| Clé | Type | Rôle |
|---|---|---|
| `app` | chaîne | **Doit valoir exactement `"Clio"`.** Seul critère de validité de l'archive. |
| `version` | chaîne | Version de l'application qui a écrit le fichier. Informatif. |
| `format` | chaîne | Version du format. `"2.0"` aujourd'hui. |
| `created` | ISO 8601 | Reprend le `createdAt` du livre. |
| `saved` | ISO 8601 | Horodatage de cette écriture. |

---

## 6. `book.json`

Le livre **complet, privé de deux choses** : la liste `chapters` (qui vit dans
`chapters/`) et le champ `clioStatus` (qui ne décrit qu'une session en cours et
n'a aucun sens dans un fichier).

```jsonc
{
  "id": "m9x2ab3cd",                          // identifiant, immuable
  "title": "L'Ombre du Clocher",              // obligatoire, non vide
  "author": "",
  "genre": "Roman",                           // un des 12 genres, cf. §7.1
  "desc": "",                                 // résumé
  "goal": 80000,                              // objectif de mots, défaut 80000
  "locked": false,                            // œuvre achevée, en lecture seule
  "bookFormat": "roman",                      // format de pagination, défaut "roman"
  "createdAt": "2026-04-27T10:00:00.000Z",
  "updatedAt": "2026-08-30T09:41:12.512Z",
  "clioFilename": "L'Ombre du Clocher.clio",  // absent si jamais enregistré
  "characters": [ /* Entité, cf. §7.5 */ ],
  "places":     [ /* Entité, cf. §7.5 */ ]
}
```

---

## 7. Modèle de données

### 7.1 Livre

| Champ | Type | Défaut | Note |
|---|---|---|---|
| `id` | chaîne | — | Unique et stable pour la durée de vie de l'objet |
| `title` | chaîne | — | Obligatoire, non vide |
| `author` | chaîne | `""` | |
| `genre` | chaîne | `"Roman"` | Roman · Nouvelle · Science-Fiction · Fantasy · Thriller · Policier · Horreur · Romance · Biographie · Essai · Conte · Poésie |
| `desc` | chaîne | `""` | |
| `goal` | entier | `80000` | Objectif de mots |
| `locked` | booléen | `false` | Un livre verrouillé ne peut être modifié par aucun chemin |
| `bookFormat` | chaîne | `"roman"` | Détermine la pagination estimée |
| `createdAt` | ISO 8601 | — | |
| `updatedAt` | ISO 8601 | — | Rafraîchi à chaque écriture |
| `clioFilename` | chaîne | absent | Nom du dernier fichier écrit |
| `characters` | Entité[] | `[]` | |
| `places` | Entité[] | `[]` | |
| `chapters` | Chapitre[] | — | **Jamais dans `book.json`** — un fichier par chapitre |

### 7.2 Chapitre — `chapters/ch-NNN.json`

```jsonc
{
  "id": "m9x2ef4gh",
  "title": "Chapitre 1",
  "notes": "",                  // notes de travail du chapitre
  "sectionType": "chapter",     // cf. §7.6, défaut "chapter"
  "specialData": { },           // uniquement pour glossaire, index, répertoire, registre
  "scenes": [ /* Scène */ ]     // toujours ≥ 1
}
```

Un chapitre écrit en format 2.0 porte **toujours** `scenes` et **jamais**
`blocks`. Le champ `blocks` est un héritage du format 1.0 — cf. §10.

### 7.3 Scène

```jsonc
{
  "id": "m9x2ij5kl",
  "title": "",                  // facultatif
  "note": "",                   // note de scène
  "blocks": [ /* Bloc */ ]      // toujours ≥ 1
}
```

### 7.4 Bloc

Le bloc est l'unité de pensée : une scène, une réplique, une idée.

```jsonc
{
  "id": "m9x2mn6op",
  "title": "",                  // facultatif
  "text": "",                   // le texte, sauts de ligne \n préservés
  "note": "",                   // note en marge
  "accentIdx": 0,               // 0..7, couleur d'accent
  "images": [ /* Image */ ]     // absent si aucune image
}
```

`accentIdx` indexe la palette : or · cramoisi · sauge · bleu · violet · rose ·
orange · gris. Une valeur hors bornes est ramenée dans `0..7`.

### 7.5 Image

```jsonc
{
  "id": "m9x2qr7st",
  "file": "m9x2qr7st.jpeg",     // référence vers images/ — état DANS l'archive
  "data": "data:image/jpeg;base64,…",  // contenu intégré — état EN MÉMOIRE
  "mime": "image/jpeg",
  "name": "photo.jpg",          // nom d'origine
  "caption": ""                 // légende
}
```

**`data` et `file` s'excluent.** Dans l'archive, une image porte `file` et son
binaire vit dans `images/` ; `data` est retiré. En mémoire, c'est l'inverse.

### 7.6 Entité — personnage ou lieu

```jsonc
{ "name": "Marie", "note": "", "open": false }
```

`note` est la fiche descriptive libre. `open` n'est qu'un état d'affichage
(fiche dépliée ou non) : il est enregistré mais ne porte aucune information.

**Format hérité accepté :** une simple chaîne `"Marie"`, à convertir à la lecture.

### 7.7 Types de section

`sectionType` vaut `"chapter"` par défaut. Le format admet 21 types — parmi
lesquels `preface`, `prologue`, `epilogue`, `dedicace`, `remerciements`,
`glossaire`, `index`, `repertoire`, `registre`, `annexe`, `note`. Un type
inconnu doit être traité comme `"chapter"` plutôt que rejeté.

`specialData` n'est renseigné que pour les sections dynamiques (glossaire,
index, répertoire, registre) et son contenu leur est propre.

---

## 8. Convention d'appel des personnages et des lieux

**C'est la seule convention du format qui porte sur le contenu de `text`.** Un
outil tiers qui l'ignore affichera des `@` et des `#` parasites dans le manuscrit.

| Signe | Désigne | Exemple |
|---|---|---|
| `@` | un personnage de `book.characters` | `@Camille` |
| `#` | un lieu de `book.places` | `#Le champ` |

Le champ `text` contient littéralement `@Camille m'attendait près du #Le champ.`

**Règles de résolution :**

1. Le signe ne compte que s'il est précédé d'un **début de chaîne ou d'un
   séparateur** (espace, `(`, `«`, `"`, `'`, tiret). `contact@site.fr` n'est
   donc jamais une mention.
2. Le nom qui suit doit correspondre **exactement** à un `name` déclaré dans
   `characters` (pour `@`) ou `places` (pour `#`). Un nom inconnu reste du texte
   ordinaire.
3. En cas de préfixe commun, **le nom le plus long l'emporte** : `#Le champ de
   blé` prime sur `#Le champ`.
4. La mention se termine à la première frontière non alphanumérique (unicode).

**Rendu :** le signe est **retiré** à la lecture et à l'export. Le manuscrit
final n'affiche jamais `@` ni `#`.

Ce choix est délibéré : renommer une entité ne casse aucune référence, puisqu'il
n'en existe aucune — seulement du texte.

---

## 9. Règles de lecture

Un lecteur conforme applique, dans cet ordre :

1. **Valider le manifeste.** Si `manifest.json` est absent ou si `app ≠ "Clio"`,
   rejeter l'archive. Message d'usage : *« Ce fichier ne semble pas être un
   fichier Clio valide. »*
2. **Ne pas regarder l'extension.** `.clio` et `.clio.zip` sont équivalents.
3. **Lire `book.json`** pour les métadonnées, les personnages et les lieux.
4. **Lire les chapitres par tri alphabétique** des noms `chapters/ch-*.json`.
   C'est ce tri, et non un index, qui fixe l'ordre du livre — d'où la
   numérotation à largeur fixe.
5. **Appliquer la migration 1.0 → 2.0** à chaque chapitre qui en a besoin (§10).
6. **Réintégrer les images** : pour chaque image portant `file`, charger
   `images/<file>` et reconstituer `data`. Une image introuvable est **conservée
   telle quelle**, référence morte, sans erreur ni message.
7. **Rétablir les invariants** : ≥ 1 chapitre, ≥ 1 scène par chapitre, ≥ 1 bloc
   par scène. Compléter par des éléments vides plutôt que rejeter.

---

## 10. Migration du format 1.0 vers 2.0

Le format 1.0 ne connaissait pas les scènes : un chapitre portait directement
`blocks`. Un chapitre est donc en 1.0 s'il a `blocks` et pas de `scenes` — les
deux champs sont **mutuellement exclusifs**.

```
scenes ← [ {
    id:     <id du chapitre> + "_s0",
    title:  "",
    note:   "",
    blocks: copie de blocks   (ou [ bloc vierge ] si la liste est vide)
} ]
supprimer blocks
```

La migration s'applique **à la lecture**, sans condition et sans demander.
Un producteur en format 2.0 n'écrit jamais `blocks`.

---

## 11. Règles d'écriture

1. Rafraîchir `updatedAt` du livre, et renseigner `manifest.saved`.
2. Écrire `book.json` **sans** `chapters` ni `clioStatus`.
3. Écrire un fichier par chapitre, numéroté à trois chiffres dans l'ordre du livre.
4. Convertir chaque chapitre en format 2.0 s'il ne l'est pas déjà.
5. Pour chaque image portant `data` : écrire le binaire dans `images/`, poser
   `file`, retirer `data`.
6. Nommer le fichier `<Titre>.clio`, ou `<Titre>.clio.zip` sur Android.

---

## 12. Sécurité

Un `.clio` est un fichier **reçu**, donc non fiable. Un lecteur doit :

- **Valider les données d'image.** Le champ `data` doit commencer par
  `data:image/<type>;base64,`. Toute autre valeur est rejetée. Sans ce contrôle,
  une archive forgée peut injecter du contenu actif dans une application web.
- **Traiter tout champ textuel comme du texte**, jamais comme du balisage.
  Cela vaut pour `title`, `note`, `notes`, `caption`, `name` et `text`.
- **Ne rien exécuter.** Le format ne contient ni script, ni feuille de style, ni
  référence externe. Une archive qui en contiendrait est hors norme.
- **Se méfier des chemins.** Refuser toute entrée dont le chemin remonte hors de
  l'archive (`../`) ou est absolu.

---

## 13. Ce qui n'entre jamais dans l'archive

| Élément | Pourquoi |
|---|---|
| `clioStatus` | Décrit le lien entre un livre et son fichier dans la session en cours |
| Les réglages de l'application | Thème, police, mode focus — ils suivent l'installation, pas l'œuvre |
| La corbeille | Propre à l'installation |
| L'écriture suivie | Historique et objectifs quotidiens, propres à l'auteur et à l'appareil |
| Les instantanés automatiques | Sauvegardes locales, hors format |

Un `.clio` contient **l'œuvre**, rien de l'environnement de travail.

---

## 14. Versions du format

| Version | Changement |
|---|---|
| **1.0** | Chapitre → blocs. Pas de scènes. |
| **2.0** | Introduction de la scène : chapitre → scènes → blocs. Migration automatique et sans perte depuis 1.0. |

Un lecteur de 2.0 lit les archives 1.0. Un lecteur de 1.0 ne lit pas les
archives 2.0.

---

## 15. Exemple minimal complet

**`manifest.json`**
```json
{
  "app": "Clio",
  "version": "1.1.0",
  "format": "2.0",
  "created": "2026-08-30T07:55:00.000Z",
  "saved": "2026-08-30T07:55:00.000Z"
}
```

**`book.json`**
```json
{
  "id": "m9x2ab3cd",
  "title": "Le Test",
  "author": "Yoann CRAMATTE",
  "genre": "Roman",
  "desc": "",
  "goal": 80000,
  "locked": false,
  "bookFormat": "roman",
  "createdAt": "2026-08-30T07:55:00.000Z",
  "updatedAt": "2026-08-30T07:55:00.000Z",
  "characters": [{ "name": "Camille", "note": "", "open": false }],
  "places": [{ "name": "Le champ", "note": "", "open": false }]
}
```

**`chapters/ch-001.json`**
```json
{
  "id": "m9x2ef4gh",
  "title": "Chapitre I",
  "notes": "",
  "sectionType": "chapter",
  "scenes": [
    {
      "id": "m9x2ij5kl",
      "title": "Ouverture",
      "note": "",
      "blocks": [
        {
          "id": "m9x2mn6op",
          "title": "",
          "text": "@Camille m'attendait près du #Le champ.",
          "note": "",
          "accentIdx": 0
        }
      ]
    }
  ]
}
```

Rendu de ce bloc à la lecture : *Camille m'attendait près du Le champ.*

---

*Clio est un logiciel d'EuropaSoft — https://www.europasoft.eu*
