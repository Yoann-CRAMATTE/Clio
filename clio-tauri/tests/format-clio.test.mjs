/* Aller-retour du format .clio avec le vrai code d'index.html :
   livre riche → bookToClioBlob → clioToBook → égalité, puis archives piégées.
   Lancement : npm test (depuis clio-tauri/). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chargerFormatClio, APP_INFO } from './charger-index.mjs';

const clio = chargerFormatClio();

/* Les objets rendus par le bac à sable ont les prototypes d'un autre royaume :
   on les ramène à de simples données avant toute comparaison. */
const donnees = o => JSON.parse(JSON.stringify(o));

/* Contenus d'image : un vrai PNG 1×1, et des octets quelconques (les 256
   valeurs) pour vérifier que le binaire traverse l'archive sans altération. */
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const OCTETS  = Buffer.concat([Buffer.from([...Array(256).keys()]), randomBytes(3000)]).toString('base64');

const SPECIAUX = `<b>gras</b> & « guillemets » "doubles" 'simples' — ½ œ Æ ß ñ 漢字 🌙 \\ / \t tab\nligne 2\r\nCRLF`;

function livreRiche() {
  return {
    id: 'lq3x9k2abcd',
    title: `L'Été « brûlant » <de> & "Zoé"`,
    author: 'Hélène Dupré-Ørsted',
    genre: 'Fantasy',
    desc: `Résumé : ${SPECIAUX}`,
    bookFormat: 'a5',
    goal: 95000,
    locked: false,
    status: 'brouillon',
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    clioFilename: 'L’Été brûlant.clio',
    clioStatus: 'linked',                       // propre à la session : jamais écrit
    characters: [
      { name: 'Zoé <la rouge>', note: `Fiche : ${SPECIAUX}`, open: true },
      { name: "Jean-Michel O'Brien", note: '', open: false },
      'Ancien format',                          // entité héritée (§7.6), tolérée
    ],
    places: [{ name: 'Château d’Éclair & Cie', note: '"Lieu" <secret>', open: false }],
    chapters: [
      {
        id: 'chcouv1', title: 'Première de couverture', sectionType: 'cover1', notes: '',
        scenes: [{ id: 'sccouv1', title: '', note: '',
          blocks: [{ id: 'blcouv1', title: '', text: 'Titre\nAuteur', accentIdx: 0 }] }],
      },
      {
        id: 'chprol', title: 'Prologue <ombre>', sectionType: 'prologue', notes: `Notes : ${SPECIAUX}`,
        scenes: [{ id: 'scprol', title: 'Avant', note: 'n',
          blocks: [{ id: 'blprol', title: '« Ouverture »', text: SPECIAUX, note: '<i>note</i> & co', accentIdx: 5 }] }],
      },
      {
        id: 'ch1', title: 'Chapitre 1', sectionType: 'chapter', notes: '',
        scenes: [
          { id: 'sc1a', title: 'Scène A', note: 'Note de scène',
            blocks: [
              { id: 'bl1', title: 'Bloc 1', text: 'Il était une fois…', note: '', accentIdx: 0,
                images: [
                  { id: 'img1', data: `data:image/png;base64,${PNG_1PX}`, mime: 'image/png',
                    name: 'pixel <1>.png', caption: 'Légende « 1 » & "2"' },
                  { id: 'img2', data: `data:image/jpeg;base64,${OCTETS}`, mime: 'image/jpeg',
                    name: 'photo.jpg', caption: '' },
                ] },
              { id: 'bl2', title: '', text: '', note: 'vide', accentIdx: 7 },
            ] },
          { id: 'sc1b', title: '', note: '',
            blocks: [{ id: 'bl3', title: 'Seul', text: 'Fin.', accentIdx: 3,
              images: [{ id: 'img3', data: `data:image/svg+xml;base64,${PNG_1PX}`, mime: 'image/svg+xml',
                         name: 'figure.svg', caption: 'SVG' }] }] },
        ],
      },
      {
        id: 'chgloss', title: 'Glossaire', sectionType: 'glossaire', notes: '',
        specialData: { entries: [{ term: 'Éther', def: 'Fluide <subtil> & "invisible"' }] },
        scenes: [{ id: 'scgloss', title: '', note: '', blocks: [{ id: 'blgloss', title: '', text: '', accentIdx: 0 }] }],
      },
      {
        id: 'chindex', title: 'Index', sectionType: 'index', notes: '',
        specialData: { indexEntries: [{ term: 'Zoé', pages: [3, 7, 12] }, { term: 'Éclair', pages: [1, 2] }] },
        scenes: [{ id: 'scindex', title: '', note: '', blocks: [{ id: 'blindex', title: '', text: '', accentIdx: 0 }] }],
      },
      {
        id: 'chrep', title: 'Répertoire', sectionType: 'repertoire', notes: '',
        specialData: { entries: [{ name: 'Zoé', desc: 'Héroïne', type: 'personnage' }] },
        scenes: [{ id: 'screp', title: '', note: '', blocks: [{ id: 'blrep', title: '', text: '', accentIdx: 0 }] }],
      },
      {
        id: 'chreg', title: 'Registre', sectionType: 'registre', notes: '',
        specialData: { events: [{ date: '1789', title: 'Prise <de> la Bastille', desc: '"14 juillet"' }] },
        scenes: [{ id: 'screg', title: '', note: '', blocks: [{ id: 'blreg', title: '', text: '', accentIdx: 0 }] }],
      },
      // Section créée par le sélecteur de type : en mémoire, elle porte encore
      // `blocks` (format 1.0) ; l'écriture la convertit en scène (§11.4).
      {
        id: 'chepil', title: 'Épilogue', sectionType: 'epilogue', notes: '',
        blocks: [{ id: 'blepil', title: '', text: 'Et après…', accentIdx: 2 }],
      },
    ],
  };
}

/* Ce que doit rendre la relecture : le même livre, sans clioStatus, avec
   updatedAt rafraîchi et les chapitres 1.0 convertis (§10). */
function attendu(livre, updatedAt) {
  const l = donnees(livre);
  delete l.clioStatus;
  l.updatedAt = updatedAt;
  l.chapters = l.chapters.map(ch => {
    if (ch.scenes) return ch;
    const { blocks, ...reste } = ch;
    return { ...reste, scenes: [{ id: ch.id + '_s0', title: '', note: '', blocks }] };
  });
  return l;
}

const lireArchive = async blob => clio.JSZip.loadAsync(blob);

test('aller-retour : un livre riche revient identique', async () => {
  const livre = livreRiche();
  const avant = donnees(livre);
  const blob  = await clio.bookToClioBlob(livre);
  assert.deepEqual(donnees(livre), avant, "l'écriture ne doit pas modifier le livre en mémoire");

  const relu = donnees(await clio.clioToBook(blob));
  assert.match(relu.updatedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.ok(relu.updatedAt > livre.updatedAt, 'updatedAt rafraîchi à l’écriture');
  assert.deepEqual(relu, attendu(livre, relu.updatedAt));
});

test('statut (§7.1) : conservé, et le verrou fait foi', async () => {
  const relire = async champs => donnees(await clio.clioToBook(
    await clio.bookToClioBlob({ ...livreRiche(), ...champs })));
  assert.equal((await relire({ status: 'brouillon' })).status, 'brouillon');
  assert.equal((await relire({ status: 'encours' })).status, 'encours');
  assert.equal((await relire({ status: 'termine', locked: true })).status, 'termine');
  assert.equal((await relire({ status: 'brouillon', locked: true })).status, 'termine', 'verrouillé = terminé');
  assert.equal((await relire({ status: 'termine', locked: false })).status, 'encours', 'terminé sans verrou = en cours');
  assert.equal((await relire({ status: '<b>pirate</b>' })).status, undefined, 'valeur inconnue ignorée');
});

test('aller-retour : relire puis réécrire est stable', async () => {
  const une  = donnees(await clio.clioToBook(await clio.bookToClioBlob(livreRiche())));
  const deux = donnees(await clio.clioToBook(await clio.bookToClioBlob(une)));
  assert.deepEqual(deux, { ...une, updatedAt: deux.updatedAt });
});

test("l'archive suit FORMAT-CLIO (§4, §5, §11)", async () => {
  const zip = await lireArchive(await clio.bookToClioBlob(livreRiche()));
  const noms = Object.keys(zip.files).filter(n => !zip.files[n].dir).sort();
  assert.deepEqual(noms, [
    'book.json',
    ...Array.from({ length: 8 }, (_, i) => `chapters/ch-${String(i + 1).padStart(3, '0')}.json`),
    'images/img1.png', 'images/img2.jpeg', 'images/img3.svg+xml',
    'manifest.json',
  ]);

  const manifeste = JSON.parse(await zip.file('manifest.json').async('string'));
  assert.equal(manifeste.app, 'Clio');
  assert.equal(manifeste.format, '2.0');
  assert.equal(manifeste.version, APP_INFO.version);

  const livre = JSON.parse(await zip.file('book.json').async('string'));
  assert.ok(!('chapters' in livre), 'book.json sans chapters');
  assert.ok(!('clioStatus' in livre), 'book.json sans clioStatus');

  for (const n of noms.filter(n => n.startsWith('chapters/'))) {
    const ch = JSON.parse(await zip.file(n).async('string'));
    assert.ok(Array.isArray(ch.scenes) && ch.scenes.length, `${n} : scenes présent`);
    assert.ok(!('blocks' in ch), `${n} : jamais de blocks en 2.0`);
    for (const sc of ch.scenes) for (const b of sc.blocks) for (const img of b.images || []) {
      assert.ok(!('data' in img), `${n} : data retiré de l'image ${img.id}`);
      assert.ok(zip.file(`images/${img.file}`), `${n} : images/${img.file} présent`);
    }
  }
  assert.equal(await zip.file('images/img2.jpeg').async('base64'), OCTETS, 'binaire intact');
});

test('image sans type (sélecteur Android) : relue comme image, contenu intact', async () => {
  const livre = livreRiche();
  livre.chapters[2].scenes[0].blocks[0].images = [{
    id: 'imgandroid', data: `data:application/octet-stream;base64,${PNG_1PX}`, mime: '', name: 'x', caption: '',
  }];
  const img = donnees(await clio.clioToBook(await clio.bookToClioBlob(livre))).chapters[2].scenes[0].blocks[0].images[0];
  assert.match(img.data, clio.DATA_IMAGE_SURE);
  assert.match(img.mime, clio.MIME_IMAGE_SUR);
  assert.equal(img.data, `${'data:' + img.mime};base64,${PNG_1PX}`);
});

test('invariants de lecture (§9.7) : ≥ 1 chapitre, ≥ 1 scène, ≥ 1 bloc', async () => {
  const zip = new clio.JSZip();
  zip.file('manifest.json', JSON.stringify({ app: 'Clio', format: '2.0' }));
  zip.file('book.json', JSON.stringify({ id: 'vide', title: 'Sans chapitre' }));
  let livre = donnees(await clio.clioToBook(await zip.generateAsync({ type: 'blob' })));
  assert.equal(livre.chapters.length, 1, 'un chapitre vierge est ajouté');
  assert.equal(livre.chapters[0].scenes.length, 1);
  assert.equal(livre.chapters[0].scenes[0].blocks.length, 1);

  zip.file('chapters/ch-001.json', JSON.stringify({ id: 'c1', title: 'Sans scène', scenes: [] }));
  zip.file('chapters/ch-002.json', JSON.stringify({ id: 'c2', title: 'Scène vide', scenes: [{ id: 's', blocks: [] }] }));
  zip.file('chapters/ch-003.json', JSON.stringify({ id: 'c3', title: '1.0 vide', blocks: [] }));
  livre = donnees(await clio.clioToBook(await zip.generateAsync({ type: 'blob' })));
  assert.deepEqual(livre.chapters.map(c => c.title), ['Sans scène', 'Scène vide', '1.0 vide']);
  for (const ch of livre.chapters) {
    assert.ok(ch.scenes.length >= 1, `${ch.title} : au moins une scène`);
    for (const sc of ch.scenes) {
      assert.ok(sc.blocks.length >= 1, `${ch.title} : au moins un bloc`);
      for (const b of sc.blocks) assert.match(b.id, clio.ID_SUR);
    }
  }
  assert.equal(livre.chapters[1].scenes[0].id, 's', 'la scène existante est gardée');
});

test('archive non Clio : rejetée', async () => {
  const zip = new clio.JSZip();
  zip.file('manifest.json', JSON.stringify({ app: 'Autre' }));
  zip.file('book.json', '{}');
  await assert.rejects(clio.clioToBook(await zip.generateAsync({ type: 'blob' })), /pas être un fichier Clio valide/);

  const sansManifeste = new clio.JSZip();
  sansManifeste.file('book.json', '{}');
  await assert.rejects(clio.clioToBook(await sansManifeste.generateAsync({ type: 'blob' })));
});

/* ── Archive piégée ── */
const CHARGE = '"><img src=x onerror=alert(1)>';

async function archivePiegee() {
  const zip = new clio.JSZip();
  zip.file('manifest.json', JSON.stringify({ app: 'Clio', format: '2.0' }));
  // "__proto__" écrit en clé JSON : JSON.parse en fait une propriété propre,
  // qui ne doit polluer aucun prototype en traversant l'import.
  zip.file('book.json', `{"__proto__": {"pollue": true}, ${JSON.stringify({
    id: CHARGE, title: `<script>alert("titre")</script>${CHARGE}`,
    author: ['<b>pas une chaîne</b>'], genre: '__proto__', goal: CHARGE, locked: 'true',
    characters: ['<i>Hérité</i>', { name: CHARGE, note: 42, open: 'oui' }, 7, null],
    places: 'pas une liste',
  }).slice(1)}`);
  zip.file('chapters/ch-001.json', JSON.stringify({
    id: '../x', title: `<h1>${CHARGE}</h1>`, sectionType: 'index',
    specialData: {
      indexEntries: [{ term: '<b>terme</b>', pages: [CHARGE, 3] }, { term: '' }, 'x'],
      entries: [{ term: { x: 1 }, def: '<i>' }],
    },
    scenes: [{ id: 'a b', title: CHARGE, blocks: [{
      id: 'x" onmouseover="alert(1)', title: '<svg/onload=alert(1)>', text: CHARGE, accentIdx: '99',
      images: [
        { id: '../../evil', file: '../book.json', mime: 'image/png' },          // remontée : refusée
        { id: 'abs', file: '/etc/passwd' },                                    // chemin absolu : refusé
        { id: 'antislash', file: '..\\..\\book.json' },                        // séparateur Windows : refusé
        { id: 'ok1', file: 'ok1.png', mime: 'text/html' },                      // vraie image, faux type
        { id: 'ok2', file: 'ok1.png', mime: 'image/png";x="' },
        { id: 'attr', data: `data:image/png;base64,AAA${CHARGE}` },              // sort de l'attribut src
        { id: 'js', data: 'javascript:alert(1)' },
        { id: 'html', data: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' },
        { id: 'distant', data: 'https://exemple.invalid/pixel.png' },           // fuite réseau
        { id: '../../../tmp/evil', data: `data:image/png;base64,${PNG_1PX}` },   // contenu sain, id piégé
        'pas un objet', null,
      ] }] }],
  }));
  zip.file('images/ok1.png', PNG_1PX, { base64: true });
  // Entrées qui sortent de l'archive. JSZip 3.10 résout « .. » à la lecture
  // (le nom d'origine ne survit que dans unsafeOriginalName) : aucune ne peut
  // être atteinte sous son nom piégé.
  zip.file('../evil.png', PNG_1PX, { base64: true });
  zip.file('images/../../evil2.png', PNG_1PX, { base64: true });
  return zip.generateAsync({ type: 'blob' });
}

test('archive piégée : JSZip ne garde aucun nom en « .. »', async () => {
  const zip = await lireArchive(await archivePiegee());
  for (const nom of Object.keys(zip.files)) assert.ok(!nom.split('/').includes('..'), nom);
});

/* Parcourt toutes les images d'un livre. */
const images = livre => livre.chapters.flatMap(ch => (ch.scenes || []).flatMap(sc => sc.blocks.flatMap(b => b.images || [])));

test('archive piégée : import assaini, aucun prototype pollué', async () => {
  const brut  = await clio.clioToBook(await archivePiegee());
  const livre = donnees(brut);

  assert.equal(({}).pollue, undefined, 'Object.prototype (Node) intact');
  assert.equal(clio.esc.constructor('return ({}).pollue')(), undefined, 'Object.prototype (bac à sable) intact');

  // Identifiants : tous réécrits au format sûr
  const ids = [livre.id, ...livre.chapters.flatMap(ch => [ch.id, ...ch.scenes.flatMap(sc =>
    [sc.id, ...sc.blocks.flatMap(b => [b.id, ...(b.images || []).map(i => i.id)])])])];
  for (const id of ids) assert.match(String(id), clio.ID_SUR);

  // Le texte reste du texte : conservé tel quel, échappé à l'affichage
  assert.equal(livre.title, `<script>alert("titre")</script>${CHARGE}`);
  assert.doesNotMatch(clio.esc(livre.title), /[<>"]/);
  assert.equal(livre.author, '', 'un auteur qui n’est pas une chaîne est vidé');
  assert.equal(livre.goal, 80000);
  assert.equal(livre.locked, false);
  assert.deepEqual(livre.characters, ['<i>Hérité</i>', { name: CHARGE, note: '42', open: false }]);
  assert.deepEqual(livre.places, []);

  const ch = livre.chapters[0];
  assert.deepEqual(ch.specialData.indexEntries, [{ term: '<b>terme</b>', pages: [3] }]);
  assert.equal(ch.specialData.entries[0].term, '');
  const bloc = ch.scenes[0].blocks[0];
  assert.equal(bloc.accentIdx, 7);

  // Images : seules restent les vraies images, et aucun chemin hors de images/
  const imgs = images(livre);
  assert.equal(imgs.length, 3, JSON.stringify(imgs.map(i => i.id)));
  for (const img of imgs) {
    assert.match(img.data, clio.DATA_IMAGE_SURE);
    assert.match(img.data, /^data:image\//);
    assert.match(img.mime, clio.MIME_IMAGE_SUR);
    assert.equal(img.mime, img.data.slice(5, img.data.indexOf(';')));
    if (img.file !== undefined) assert.ok(clio.nomImageSur(img.file), img.file);
  }
  assert.deepEqual(imgs.map(i => i.mime), ['image/png', 'image/png', 'image/png']);
});

test('srcImage : rien ne sort de l’attribut src, rien ne part sur le réseau', () => {
  const sain = `data:image/png;base64,${PNG_1PX}`;
  assert.equal(clio.srcImage({ data: sain }), sain);
  assert.equal(clio.srcImage({ data: `data:application/octet-stream;base64,${PNG_1PX}` }).startsWith('data:'), true);
  for (const data of [`data:image/png;base64,AAA${CHARGE}`]) assert.doesNotMatch(clio.srcImage({ data }), /["<>]/);
  for (const data of ['javascript:alert(1)', 'https://exemple.invalid/x.png', '//exemple.invalid/x.png',
                      'data:text/html;base64,AAAA', ' data:image/png;base64,AAAA', 42, undefined])
    assert.equal(clio.srcImage({ data }), '', String(data));
  assert.equal(clio.srcImage(null), '');
});

/* Un livre piégé importé AVANT l'assainissement est resté tel quel en stockage :
   son export ne doit pas produire d'entrée qui sorte de l'archive (« zip slip »)
   ni échouer sur une image qui n'en est pas une. */
test('export d’un livre piégé non assaini : aucune entrée hors de l’archive', async () => {
  const livre = livreRiche();
  livre.chapters[2].scenes[0].blocks[0].images = [
    { id: '../../../evil', data: `data:image/png;base64,${PNG_1PX}`, mime: 'image/png' },
    { id: 'mimepiege', data: `data:image/png;base64,${PNG_1PX}`, mime: 'image/..\\..\\evil' },
    { id: 'slash', data: `data:image/png;base64,${PNG_1PX}`, mime: 'x/y/../../z' },
    { id: 'html', data: 'data:text/html,<script>alert(1)</script>', mime: 'text/html' },
  ];
  const zip = await lireArchive(await clio.bookToClioBlob(livre));
  for (const nom of Object.keys(zip.files)) {
    assert.match(nom, /^(manifest\.json|book\.json|chapters\/(ch-\d{3}\.json)?|images\/([A-Za-z0-9_-]+\.[a-z0-9.+-]+)?)$/i, nom);
    assert.ok(!nom.split('/').includes('..'), nom);
  }
  // Et la relecture retrouve le contenu des trois vraies images (sous un type
  // d'image sûr) ; la fausse, sans contenu ni fichier, disparaît.
  const relu = donnees(await clio.clioToBook(await zip.generateAsync({ type: 'blob' })));
  const imgs = relu.chapters[2].scenes[0].blocks[0].images;
  assert.equal(imgs.length, 3);
  for (const img of imgs) {
    assert.match(img.data, /^data:image\/[a-z0-9.+-]+;base64,/);
    assert.ok(img.data.endsWith(`;base64,${PNG_1PX}`));
  }
  assert.equal(imgs[0].data, `data:image/png;base64,${PNG_1PX}`, 'type sûr conservé');
});
