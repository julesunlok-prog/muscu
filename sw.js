// Hors ligne : tout le code de l'app est pré-caché ; les polices Google sont mises en cache au premier chargement.
const VERSION = 'muscu-v40';
const FICHIERS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/apple-touch-icon.png',
  'js/app.js', 'js/store.js', 'js/seed.js', 'js/profils.js', 'js/moteur.js', 'js/seance.js', 'js/strong-import.js',
  'js/ui.js', 'js/graph.js', 'js/demo.js', 'js/alarme.js', 'js/montre.js', 'js/bibliotheque.js',
  'js/vues/programmes.js', 'js/vues/seance.js', 'js/vues/historique.js', 'js/vues/exercices.js', 'js/vues/analyse.js', 'js/vues/reglages.js',
];

self.addEventListener('install', e => {
  // cache: 'reload' : GitHub Pages garde les fichiers 10 min en cache HTTP ; sans ça, une nouvelle version peut embarquer d'anciens fichiers.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Alarme de repos (serveur/) : iOS exige d'afficher une notification pour chaque push reçu.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data?.json() ?? {}; } catch { /* texte par défaut */ }
  // On ferme l'ancienne avant d'afficher : une notification qui en remplace une autre (même tag) ne sonne pas sur iOS.
  e.waitUntil(self.registration.getNotifications({ tag: 'repos' }).then(ns => ns.forEach(n => n.close()))
    .then(() => self.registration.showNotification(d.titre || 'Repos terminé', { body: d.corps || 'Série suivante', tag: 'repos', icon: 'icones/icone-192.png' })));
});

// Toucher la notification : rouvre l'app sur la séance.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./#/seance', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(fenetres => {
    const f = fenetres[0];
    return f ? f.focus().then(x => (x ?? f).navigate?.(url)) : self.clients.openWindow(url);
  }));
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
