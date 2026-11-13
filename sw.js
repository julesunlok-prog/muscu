// Hors ligne : tout le code de l'app est pré-caché ; les polices Google sont mises en cache au premier chargement.
const VERSION = 'muscu-v10';
const FICHIERS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/apple-touch-icon.png',
  'js/app.js', 'js/store.js', 'js/seed.js', 'js/profils.js', 'js/moteur.js', 'js/seance.js', 'js/strong-import.js',
  'js/ui.js', 'js/graph.js', 'js/demo.js',
  'js/vues/programmes.js', 'js/vues/seance.js', 'js/vues/historique.js', 'js/vues/exercices.js', 'js/vues/analyse.js', 'js/vues/reglages.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const police = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !police) return;
  e.respondWith(caches.match(req, { ignoreSearch: !police }).then(enCache => enCache || fetch(req).then(rep => {
    if (rep.ok || rep.type === 'opaque') {
      const copie = rep.clone();
      caches.open(VERSION).then(c => c.put(req, copie));
    }
    return rep;
  })));
});
