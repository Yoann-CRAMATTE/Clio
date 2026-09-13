/* ══════════════════════════════════════════════════════════════
   Clio — service worker

   Rôle unique : permettre à Clio de démarrer sans réseau une fois
   installée. Il ne collecte rien, n'envoie rien, et ne met en cache
   que les fichiers de l'application elle-même. Les livres de l'auteur
   ne passent jamais par ici : ils vivent dans le stockage local du
   navigateur et dans les fichiers .clio qu'il enregistre lui-même.

   Stratégie : cache d'abord, réseau en secours.
   L'application est un ensemble figé de fichiers versionnés ; servir
   le cache donne un démarrage instantané et un fonctionnement hors
   ligne. Une nouvelle version arrive par changement de VERSION, ce
   qui écarte l'ancien cache en entier — pas de mélange possible
   entre deux versions.
   ══════════════════════════════════════════════════════════════ */

/* Remplacé à chaque déploiement par build-web.sh, d'après AppInfo.json.
   Changer cette valeur suffit à forcer la mise à jour chez tous les
   utilisateurs, au prochain lancement. */
const VERSION = '__VERSION__';
const CACHE = 'clio-' + VERSION;

/* Le strict nécessaire au démarrage. Les polices sont volontairement
   absentes : elles se mettent en cache à la première utilisation, ce
   qui évite de faire échouer l'installation entière si l'une d'elles
   venait à manquer. */
const ESSENTIEL = [
  './',
  './index.html',
  './fonts.css',
  './vendor/jszip.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ESSENTIEL))
      // Une version fraîche prend la main sans attendre la fermeture
      // de tous les onglets ouverts.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(
        noms.filter(n => n.startsWith('clio-') && n !== CACHE)
            .map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // On ne touche ni aux écritures, ni à ce qui vient d'ailleurs :
  // le service worker ne s'occupe que des fichiers de l'application.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(enCache => {
      if (enCache) return enCache;

      return fetch(req).then(reponse => {
        // Ne mettre en cache que ce qui a réellement abouti. Une page
        // d'erreur mise en cache resterait servie hors ligne.
        if (reponse && reponse.ok && reponse.type === 'basic') {
          const copie = reponse.clone();
          caches.open(CACHE).then(c => c.put(req, copie));
        }
        return reponse;
      }).catch(() => {
        // Hors ligne et rien en cache : pour une navigation, on rend
        // la page d'accueil, qui est toujours présente.
        if (req.mode === 'navigate') return caches.match('./index.html');
        throw new Error('ressource indisponible hors ligne');
      });
    })
  );
});
