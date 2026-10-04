/* Charge le VRAI code de src/index.html dans un bac à sable node:vm.

   Aucune logique n'est recopiée ici : on découpe index.html entre des
   repères (commentaires de section ou débuts de déclaration) et on évalue
   les morceaux tels quels, dans un contexte neuf à chaque appel. Si un
   repère disparaît ou se déplace, le chargement échoue bruyamment plutôt
   que de tester autre chose que l'application.

   Le contexte imite un navigateur juste assez pour ces morceaux : Blob vient
   de Node, FileReader est réduit à readAsArrayBuffer (seul usage de JSZip),
   et JSZip est le fichier vendor/jszip.min.js livré avec l'application. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
export const INDEX_HTML = readFileSync(SRC + 'index.html', 'utf8');
const JSZIP_SRC = readFileSync(SRC + 'vendor/jszip.min.js', 'utf8');
export const APP_INFO = JSON.parse(readFileSync(SRC + 'AppInfo.json', 'utf8'));

/* Texte compris entre deux repères (le premier inclus, le second exclu). */
export function extraireEntre(debut, fin) {
  const i = INDEX_HTML.indexOf(debut);
  if (i < 0) throw new Error(`Repère introuvable dans index.html : ${debut}`);
  const j = INDEX_HTML.indexOf(fin, i + debut.length);
  if (j < 0) throw new Error(`Repère de fin introuvable dans index.html : ${fin}`);
  return INDEX_HTML.slice(i, j);
}

/* Une déclaration tenant sur une seule ligne, repérée par son début. */
export function extraireLigne(debut) {
  const ligne = INDEX_HTML.split('\n').find(l => l.startsWith(debut));
  if (!ligne) throw new Error(`Ligne introuvable dans index.html : ${debut}`);
  return ligne;
}

/* Minuterie qui ne retient pas le processus (le délai de garde de 5 s
   d'ouvrirBaseLivres() resterait sinon pendant après chaque test). */
const minuterie = (f, ms, ...a) => { const t = setTimeout(f, ms, ...a); t.unref?.(); return t; };

/* FileReader minimal. Défini DANS le contexte : JSZip y teste
   `instanceof ArrayBuffer` contre l'ArrayBuffer du contexte, pas celui de Node. */
const FILEREADER_SRC = `
class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(b => {
      const copie = new ArrayBuffer(b.byteLength);
      new Uint8Array(copie).set(new Uint8Array(b));
      this.result = copie;
      this.onload && this.onload({ target: this });
    }, e => { this.error = e; this.onerror && this.onerror({ target: this }); });
  }
}`;

/* Crée un contexte, y charge JSZip puis `code`, et renvoie la valeur de la
   dernière expression de `code` (les const/let du script n'étant pas des
   propriétés du global, c'est par elle qu'on les expose). */
export function evaluer(code, globaux = {}) {
  const ctx = vm.createContext({
    Blob, console,
    setTimeout: minuterie, clearTimeout, setImmediate, clearImmediate, queueMicrotask,
    ...globaux,
  });
  ctx.window = ctx;
  vm.runInContext(FILEREADER_SRC + '\nthis.FileReader = FileReader;', ctx);
  vm.runInContext(JSZIP_SRC, ctx, { filename: 'vendor/jszip.min.js' });
  return { ctx, exporte: vm.runInContext(code, ctx, { filename: 'index.html (extraits)' }) };
}

/* Le format .clio : écriture (bookToClioBlob), lecture (clioToBook),
   assainissement et garde des images, avec leurs aides. */
export function chargerFormatClio() {
  const code = [
    // APP_CONFIG réel se remplit depuis AppInfo.json au démarrage : on en
    // reprend le seul champ que lit l'écriture.
    `const APP_CONFIG = { version: ${JSON.stringify(APP_INFO.version)} };`,
    extraireLigne('const ACCENTS = '),
    extraireLigne('const esc='),
    extraireLigne('const uid='),
    extraireEntre('/* ── Sérialiser un livre → Blob .clio ── */',
                  '/* ── Écrire un blob dans un FileHandle ── */'),
    `({ bookToClioBlob, clioToBook, assainirLivreImporte, srcImage, esc,
        ID_SUR, DATA_IMAGE_SURE, MIME_IMAGE_SUR, nomImageSur, JSZip })`,
  ].join('\n');
  return evaluer(code).exporte;
}

/* Le stockage des livres et de la corbeille (IndexedDB, repli localStorage),
   avec la séquence de démarrage réelle. Chaque appel repart d'un contexte
   neuf : `globaux` fournit indexedDB (fake-indexeddb, ou rien pour simuler
   son absence) et localStorage. Le DOM et les dialogues sont des bouchons ;
   showAlert consigne ses appels dans `alertes`. */
export function chargerStockage({ indexedDB, localStorage }) {
  const alertes = [];
  const code = [
    extraireLigne('let books=[]'),
    extraireLigne('const esc='),
    extraireLigne('const uid='),
    `const document = { getElementById: () => null, addEventListener() {} };
     function renderBooks() {} function updateTrashBadge() {} function scheduleSave() {}`,
    extraireEntre('/* ═══════════════════ PERSIST ═══════════════════ */', 'function scheduleSave(){'),
    extraireLigne('let trash = [];'),
    extraireEntre('/* Même stockage que les livres', 'function trashAdd('),
    extraireEntre('// Chargement asynchrone : la page', '// Mise en arrière-plan'),
    `({ get books() { return books; }, set books(v) { books = v; },
        get trash() { return trash; }, set trash(v) { trash = v; },
        saveBooks, saveTrash, LIVRES_PRETS,
        etat: () => ({ indexedDB: !!_livresDb, secours: _livresSecours, bloquee: !!_ecritureBloquee }) })`,
  ].join('\n');
  // Les avertissements prévus (repli, migration) ne polluent pas la sortie des tests.
  const globaux = { localStorage, showAlert: a => alertes.push(a), console: { ...console, warn() {} } };
  if (indexedDB) globaux.indexedDB = indexedDB;
  return { ...evaluer(code, globaux), alertes };
}

/* localStorage en mémoire, avec quota facultatif (en caractères). */
export function fauxLocalStorage(initial = {}, quota = Infinity) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      const total = [...m].reduce((s, [c, x]) => s + (c === k ? 0 : c.length + x.length), 0);
      if (total + k.length + String(v).length > quota) {
        const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
      }
      m.set(k, String(v));
    },
    removeItem: k => { m.delete(k); },
    get length() { return m.size; },
    _map: m,
  };
}
