// Démarrage : état, routeur, barre d'onglets, barre du minuteur, service worker.
import { chargerEtat, sauver, etatInitial, demanderPersistance, importerJSON, CLE } from './store.js';
import { resteRepos, ajusterRepos, passerRepos } from './seance.js';
import { genererDemo } from './demo.js';
import { icon, toast, fmtChrono, esc, confirmer, telecharger } from './ui.js';
import * as programmes from './vues/programmes.js';
import * as seance from './vues/seance.js';
import * as historique from './vues/historique.js';
import * as exercices from './vues/exercices.js';
import * as analyse from './vues/analyse.js';
import * as reglages from './vues/reglages.js';

const VUES = { programmes, seance, historique, exercices, analyse, reglages };
const ONGLETS = [
  ['programmes', 'haltere', 'Entraînement'], ['historique', 'historique', 'Historique'],
  ['exercices', 'liste', 'Exercices'], ['analyse', 'graphique', 'Analyse'], ['reglages', 'reglages', 'Réglages'],
];

let state, lectureEchouee = false, reel = null; // reel : tes vraies données, mises de côté pendant la démo
try { state = chargerEtat(); }
catch {
  // Données locales illisibles : on ne les écrase pas tant qu'une sauvegarde n'est pas importée.
  state = etatInitial(); lectureEchouee = true;
}

function enregistrer() {
  if (lectureEchouee || reel) return; // la démo n'est jamais enregistrée
  try { sauver(state); } catch (e) { toast(e.message, 'error'); }
}

const vue = document.getElementById('vue');
const route = () => {
  const [nom = 'programmes', id] = location.hash.replace(/^#\/?/, '').split('/');
  return { nom: VUES[nom] ? nom : 'programmes', params: { id: id && decodeURIComponent(id) } };
};

export const ctx = {
  get state() { return state; },
  maj(fn, { rendre = true } = {}) {
    const suivant = fn(state);
    if (suivant) state = suivant;
    enregistrer();
    if (rendre) afficher();
    majMinuteur();
  },
  remplacerEtat(s) { state = s; lectureEchouee = false; reel = null; enregistrer(); appliquerTheme(); afficher(); },
  get demo() { return !!reel; },
  lancerDemo() { reel = state; state = { ...genererDemo(), settings: { ...state.settings } }; ctx.aller('#/programmes'); toast('Mode démo : 12 semaines de séances fictives.', 'info'); },
  quitterDemo() { state = reel; reel = null; ctx.aller('#/programmes'); majMinuteur(); toast('Démo quittée : tes données sont revenues.'); },
  aller(hash) { if (location.hash === hash) afficher(); else location.hash = hash; },
  rendre: () => afficher(),
};

function appliquerTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// Données locales illisibles : écran bloquant tant que Jules n'a pas choisi (rien n'est écrasé avant).
function ecranDonneesIllisibles() {
  vue.dataset.vue = 'illisible';
  vue.innerHTML = `<div class="page-header"><h1 class="page-title">Données illisibles</h1></div>
    <div class="alert alert-danger">Les données enregistrées sur ce téléphone ne peuvent pas être lues. Rien n’a été effacé.
      Exporte-les pour les garder, puis importe une sauvegarde ou repars de zéro.</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-secondary" data-brut>${icon('telecharger')}Exporter les données brutes</button>
      <label class="btn btn-secondary" style="margin:0">${icon('importer')}Importer une sauvegarde<input type="file" accept=".json,application/json" class="hidden" data-import></label>
      <button class="btn btn-danger" data-zero>Repartir de zéro</button></div>`;
  vue.onclick = async e => {
    if (e.target.closest('[data-brut]')) {
      let brut = ''; try { brut = localStorage.getItem(CLE) ?? ''; } catch { /* rien à exporter */ }
      if (await telecharger('muscu-donnees-brutes.txt', brut, 'text/plain')) toast('Données brutes exportées.');
    }
    if (e.target.closest('[data-zero]') && await confirmer('Les données illisibles seront remplacées par une app vide. Exporte-les d’abord si tu veux les garder.', { titre: 'Repartir de zéro ?', ok: 'Repartir de zéro', danger: true })) {
      ctx.remplacerEtat(etatInitial()); ctx.aller('#/programmes'); toast('App réinitialisée.');
    }
  };
  vue.onchange = async e => {
    const f = e.target.closest('[data-import]')?.files[0];
    if (!f) return;
    try { ctx.remplacerEtat(importerJSON(await f.text())); toast('Sauvegarde importée.'); }
    catch (err) { toast(err.message, 'error'); }
  };
}

function afficher() {
  if (lectureEchouee) return ecranDonneesIllisibles();
  vue.onclick = vue.onchange = null;
  let { nom, params } = route();
  if (nom === 'seance' && !state.enCours) { nom = 'programmes'; history.replaceState(null, '', '#/programmes'); }
  const y = window.scrollY, meme = vue.dataset.vue === nom + (params.id ?? '');
  vue.dataset.vue = nom + (params.id ?? '');
  vue.style.animation = meme ? 'none' : '';
  VUES[nom].render(vue, ctx, params);
  if (reel) vue.insertAdjacentHTML('afterbegin', `<div class="bandeau-demo" role="status"><span><b>Mode démo</b> · données fictives, rien n’est enregistré.</span>
    <button class="btn btn-secondary btn-sm" data-quitter-demo>Quitter</button></div>`);
  if (meme) window.scrollTo(0, y); else window.scrollTo(0, 0);
  document.querySelectorAll('.onglets a').forEach(a => a.toggleAttribute('aria-current', a.dataset.nom === (nom === 'seance' ? 'programmes' : nom)));
  document.querySelectorAll('.onglets a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
  const reprise = document.getElementById('reprise');
  reprise.classList.toggle('hidden', !state.enCours || nom === 'seance' || !!state.enCours.repos);
  if (state.enCours) reprise.querySelector('span').textContent = `${state.enCours.nom} en cours`;
}

// ---------- Minuteur de repos ----------
const barre = document.getElementById('minuteur');
let audio = null, dejaSonne = null;
document.addEventListener('pointerdown', () => {
  // iOS n'autorise le son qu'après un geste : on prépare le contexte audio au premier toucher.
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { /* pas de son */ }
}, { passive: true });

function bip() {
  if (!audio || document.visibilityState !== 'visible') return;
  [0, 0.25].forEach(t => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.25, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.18);
    o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.2);
  });
}

function majMinuteur() {
  const w = state.enCours;
  if (!w?.repos) { barre.classList.add('hidden'); return; }
  const reste = resteRepos(w);
  if (reste <= 0) {
    if (dejaSonne !== w.repos.fin) { dejaSonne = w.repos.fin; bip(); navigator.vibrate?.(200); }
    barre.classList.add('hidden');
    ctx.maj(s => ({ ...s, enCours: passerRepos(s.enCours) }), { rendre: false });
    document.getElementById('reprise').classList.toggle('hidden', route().nom === 'seance');
    return;
  }
  barre.classList.remove('hidden');
  barre.querySelector('.temps').innerHTML = `${fmtChrono(reste)}<small>repos</small>`;
  barre.querySelector('.rail').style.width = `${Math.min(100, (1 - reste / w.repos.duree) * 100)}%`;
}
barre.addEventListener('click', e => {
  const a = e.target.closest('[data-repos]')?.dataset.repos;
  if (!a) return;
  ctx.maj(w => ({ ...w, enCours: a === 'passer' ? passerRepos(w.enCours) : ajusterRepos(w.enCours, Number(a)) }), { rendre: false });
  if (a === 'passer') afficher();
});
setInterval(majMinuteur, 250);
document.addEventListener('visibilitychange', majMinuteur);

// ---------- Coquille ----------
document.getElementById('onglets').innerHTML = ONGLETS.map(([nom, ic, libelle]) =>
  `<a href="#/${nom}" data-nom="${nom}">${icon(ic)}<span>${esc(libelle)}</span></a>`).join('');
document.getElementById('reprise').querySelector('button').onclick = () => ctx.aller('#/seance');
window.addEventListener('hashchange', afficher);
document.addEventListener('click', e => {
  if (e.target.closest('[data-lancer-demo]')) ctx.lancerDemo();
  if (e.target.closest('[data-quitter-demo]')) ctx.quitterDemo();
});
appliquerTheme();
afficher();
majMinuteur();
demanderPersistance();
if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
  navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible, l'app marche quand même */ });
