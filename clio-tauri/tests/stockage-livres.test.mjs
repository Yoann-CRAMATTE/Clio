/* Stockage des livres et de la corbeille avec le vrai code d'index.html :
   migration localStorage → IndexedDB, persistance, écritures regroupées,
   repli localStorage, protections contre l'écrasement de la bibliothèque.
   IndexedDB est fournie par fake-indexeddb (pur JS, sans dépendance). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { chargerStockage, fauxLocalStorage } from './charger-index.mjs';

const donnees = o => JSON.parse(JSON.stringify(o));
const ids = liste => donnees(liste.map(o => o.id));
const livre = (id, titre = id) => ({
  id, title: titre, chapters: [{ id: id + 'c', title: 'Chapitre 1', notes: '',
    scenes: [{ id: id + 's', title: '', note: '', blocks: [{ id: id + 'b', title: '', text: 'Texte', note: '', accentIdx: 0 }] }] }],
});

/* Lecture directe dans la base, hors de Clio, pour vérifier ce qui est écrit. */
function lireBase(idb, store, cle) {
  return new Promise((res, rej) => {
    const req = idb.open('clio-livres', 1);
    req.onerror = () => rej(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(store, 'readonly');
      const get = cle === undefined ? tx.objectStore(store).getAllKeys() : tx.objectStore(store).get(cle);
      tx.oncomplete = () => { db.close(); res(get.result); };
      tx.onerror = () => rej(tx.error);
    };
  });
}

/* Démarre Clio et attend la fin du chargement (LIVRES_PRETS). */
async function demarrer(globaux) {
  const clio = chargerStockage(globaux);
  await clio.exporte.LIVRES_PRETS;
  return clio;
}

/* Compte les écritures put() sur une clé, le temps d'une fonction. */
async function compterEcritures(cle, agir) {
  const put = IDBObjectStore.prototype.put;
  let n = 0;
  IDBObjectStore.prototype.put = function (val, k) { if (k === cle) n++; return put.call(this, val, k); };
  try { await agir(); } finally { IDBObjectStore.prototype.put = put; }
  return n;
}

test('première installation : écriture dans IndexedDB, rien dans localStorage', async () => {
  const idb = new IDBFactory(), ls = fauxLocalStorage();
  const { exporte: c } = await demarrer({ indexedDB: idb, localStorage: ls });
  assert.deepEqual(donnees(c.etat()), { indexedDB: true, secours: false, bloquee: false });
  assert.deepEqual(donnees(c.books), []);

  c.books.push(livre('a', 'Été « 1 » <&>'));
  await c.saveBooks();
  assert.deepEqual(JSON.parse(await lireBase(idb, 'donnees', 'clio-books')), [livre('a', 'Été « 1 » <&>')]);
  assert.ok((await lireBase(idb, 'meta', 'migration')).date, 'migration marquée');
  assert.equal(ls.getItem('clio-books'), null, 'localStorage ne reçoit plus les livres');
  assert.equal(ls.getItem('clio-stockage'), 'indexeddb', 'témoin posé');

  // Relance : même base, nouveau contexte
  const { exporte: c2 } = await demarrer({ indexedDB: idb, localStorage: ls });
  assert.deepEqual(donnees(c2.books), [livre('a', 'Été « 1 » <&>')]);
});

test('migration : livres et corbeille repris de localStorage, anciennes clés gardées', async () => {
  const idb = new IDBFactory();
  const avecNoteEncodee = livre('m');
  avecNoteEncodee.chapters[0].scenes[0].blocks[0].note = 'a &amp; b &lt;c&gt;';   // note stockée encodée par erreur
  const anciens = JSON.stringify([avecNoteEncodee, livre('n')]);
  const corbeille = JSON.stringify([{ id: 't1', type: 'book', name: 'Jeté', data: livre('x') }]);
  const ls = fauxLocalStorage({ 'clio-books': anciens, 'clio-trash': corbeille });

  const { exporte: c } = await demarrer({ indexedDB: idb, localStorage: ls });
  assert.equal(c.etat().indexedDB, true);
  assert.deepEqual(ids(c.books), ['m', 'n']);
  assert.equal(c.books[0].chapters[0].scenes[0].blocks[0].note, 'a & b <c>', 'notes décodées au chargement');
  assert.deepEqual(ids(c.trash), ['t1']);

  assert.equal(await lireBase(idb, 'donnees', 'clio-books'), anciens, 'copie identique au texte d’origine');
  assert.equal(await lireBase(idb, 'donnees', 'clio-trash'), corbeille);
  assert.equal(ls.getItem('clio-books'), anciens, 'ancienne clé conservée (filet de sécurité)');
  assert.equal(ls.getItem('clio-trash'), corbeille);

  // Après migration, l'ancienne clé reste figée : les écritures vont dans IndexedDB.
  c.books.push(livre('o'));
  await c.saveBooks();
  assert.equal(ls.getItem('clio-books'), anciens);
  assert.deepEqual(JSON.parse(await lireBase(idb, 'donnees', 'clio-books')).map(b => b.id), ['m', 'n', 'o']);
});

test('migration déjà faite : localStorage n’est plus relu', async () => {
  const idb = new IDBFactory(), ls = fauxLocalStorage();
  const { exporte: c } = await demarrer({ indexedDB: idb, localStorage: ls });
  c.books.push(livre('a'));
  await c.saveBooks();
  ls.setItem('clio-books', JSON.stringify([livre('perime')]));     // copie figée, différente
  const { exporte: c2 } = await demarrer({ indexedDB: idb, localStorage: ls });
  assert.deepEqual(ids(c2.books), ['a']);
});

test('écritures rapprochées : regroupées, état final écrit', async () => {
  const idb = new IDBFactory();
  const { exporte: c } = await demarrer({ indexedDB: idb, localStorage: fauxLocalStorage() });
  const n = await compterEcritures('clio-books', async () => {
    c.books.push(livre('a')); const p1 = c.saveBooks();
    c.books.push(livre('b')); const p2 = c.saveBooks();
    c.books.push(livre('c')); const p3 = c.saveBooks();
    await Promise.all([p1, p2, p3]);
  });
  assert.ok(n <= 2, `au plus deux écritures (la première, puis une pour les suivantes) : ${n}`);
  assert.deepEqual(JSON.parse(await lireBase(idb, 'donnees', 'clio-books')).map(b => b.id), ['a', 'b', 'c']);
});

test('livre créé pendant le chargement : gardé en tête, rien écrit avant LIVRES_PRETS', async () => {
  const idb = new IDBFactory();
  const ls = fauxLocalStorage({ 'clio-books': JSON.stringify([livre('ancien')]) });
  const { exporte: c } = chargerStockage({ indexedDB: idb, localStorage: ls });
  // Le chargement est asynchrone : la bibliothèque est encore vide ici.
  assert.deepEqual(donnees(c.books), []);
  c.books.unshift(livre('nouveau'));
  const ecriture = c.saveBooks();          // ne doit pas écraser la base avec ['nouveau'] seul
  await c.LIVRES_PRETS;
  await ecriture;
  assert.deepEqual(ids(c.books), ['nouveau', 'ancien']);
  assert.deepEqual(JSON.parse(await lireBase(idb, 'donnees', 'clio-books')).map(b => b.id), ['nouveau', 'ancien']);
});

test('JSON illisible en base : mis de côté avant d’être écrasé', async () => {
  const idb = new IDBFactory(), ls = fauxLocalStorage({ 'clio-books': '{pas du json' });
  const { exporte: c } = await demarrer({ indexedDB: idb, localStorage: ls });
  assert.deepEqual(donnees(c.books), []);
  await new Promise(r => setTimeout(r, 20));      // la mise de côté n'est pas attendue par loadBooks
  const cles = await lireBase(idb, 'donnees');
  const cote = cles.find(k => String(k).startsWith('clio-books-illisible-'));
  assert.ok(cote, `copie de côté présente : ${cles}`);
  assert.equal(await lireBase(idb, 'donnees', cote), '{pas du json');
});

test('lecture impossible : aucune écriture, alerte à l’auteur', async () => {
  const idb = new IDBFactory();
  const ls = fauxLocalStorage({ 'clio-books': JSON.stringify([livre('precieux')]) });
  await demarrer({ indexedDB: idb, localStorage: ls });            // migration faite
  const get = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function (cle) {
    if (cle === 'clio-books') { const e = new Error('lecture'); e.name = 'UnknownError'; throw e; }
    return get.call(this, cle);
  };
  let clio;
  try { clio = await demarrer({ indexedDB: idb, localStorage: ls }); }
  finally { IDBObjectStore.prototype.get = get; }
  const { exporte: c, alertes } = clio;
  assert.equal(c.etat().bloquee, true);
  assert.ok(alertes.some(a => a.title === 'Bibliothèque illisible'));
  c.books.push(livre('intrus'));
  await c.saveBooks();
  assert.deepEqual(JSON.parse(await lireBase(idb, 'donnees', 'clio-books')).map(b => b.id), ['precieux'],
    'la base n’a pas été écrasée');
  assert.ok(alertes.some(a => a.title === 'Sauvegarde impossible'));
});

test('sans IndexedDB : repli localStorage, comme avant 1.0.2', async () => {
  const ls = fauxLocalStorage({ 'clio-books': JSON.stringify([livre('a')]) });
  const { exporte: c, alertes } = await demarrer({ localStorage: ls });
  assert.deepEqual(donnees(c.etat()), { indexedDB: false, secours: false, bloquee: false });
  assert.deepEqual(ids(c.books), ['a']);
  assert.equal(alertes.length, 0);
  c.books.push(livre('b'));
  await c.saveBooks();
  assert.deepEqual(JSON.parse(ls.getItem('clio-books')).map(b => b.id), ['a', 'b']);
  c.trash.push({ id: 't', type: 'book', name: 'x' });
  await c.saveTrash();
  assert.deepEqual(JSON.parse(ls.getItem('clio-trash')).map(t => t.id), ['t']);
});

test('sans IndexedDB après une migration : copie de sécurité signalée', async () => {
  const ls = fauxLocalStorage({ 'clio-books': JSON.stringify([livre('fige')]), 'clio-stockage': 'indexeddb' });
  const { exporte: c, alertes } = await demarrer({ localStorage: ls });
  assert.equal(c.etat().secours, true);
  assert.deepEqual(ids(c.books), ['fige']);
  assert.ok(alertes.some(a => a.title === 'Stockage principal inaccessible'));
});

test('quota localStorage dépassé (repli) : échec signalé une seule fois', async () => {
  const ls = fauxLocalStorage({}, 2000);
  const { exporte: c, alertes } = await demarrer({ localStorage: ls });
  c.books.push({ ...livre('gros'), desc: 'x'.repeat(5000) });
  await c.saveBooks();
  await c.saveBooks();
  assert.equal(alertes.filter(a => a.title === 'Sauvegarde impossible').length, 1);
  assert.equal(ls.getItem('clio-books'), null);
});
