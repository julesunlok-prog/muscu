// Montre Garmin : la séance en cours part vers la montre (via le Worker), les séries validées au poignet reviennent.
// Partie pure : mise à plat de la séance dans l'ordre de la montre, et application des événements reçus.
// Spec : docs/superpowers/specs/2026-11-15-montre-garmin-design.md
import { alternatives, remplacerExercice } from './seance.js';
import { conseil, sessionsDe } from './moteur.js';
import { SERVEUR, idAppareil } from './alarme.js';

const hex8 = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), o => o.toString(16).padStart(2, '0')).join('');

// Identifiant stable de chaque série (sid), pour qu'une validation retrouve sa série même si la séance a bougé.
export function avecIds(w) {
  if (w.entrees.every(e => e.series.every(s => s.sid))) return w;
  return { ...w, entrees: w.entrees.map(e => ({ ...e, series: e.series.map(s => s.sid ? s : { ...s, sid: hex8() }) })) };
}

// Noms courts pour l'écran rond de la montre (« Dév. inc. Smith ») ; l'app garde les noms complets.
const ABREVIATIONS = [[/Développé/g, 'Dév.'], [/inclinée?/g, 'inc.'], [/Extension/g, 'Ext.'], [/Élévations/g, 'Élév.'],
  [/latérales/g, 'lat.'], [/haltères/g, 'halt.'], [/Soulevé de terre roumain/g, 'SDT roumain'],
  [/ au-dessus de la tête/g, ' nuque'], [/Hammer Strength/g, 'Hammer'], [/ à la poulie haute/g, ' poulie haute'], [/ iso-latéral/g, ' iso']];
export function abreger(nom) {
  const court = ABREVIATIONS.reduce((n, [motif, abr]) => n.replace(motif, abr), nom);
  return court.length > 20 ? court.replace(/\s*\([^)]*\)/g, '') : court; // précision entre parenthèses retirée si trop long
}

const reposDe = (state, id) => state.exercises.find(e => e.id === id)?.reposSec ?? 90;

// Les exercices d'un même superset qui se suivent forment un bloc (même découpage que vues/seance.js).
function blocs(w) {
  const b = [];
  w.entrees.forEach((e, ei) => {
    const der = b.at(-1);
    if (e.supersetGroupe && der && w.entrees[der.at(-1)].supersetGroupe === e.supersetGroupe) der.push(ei); else b.push([ei]);
  });
  return b;
}

// Séance mise à plat dans l'ordre où la montre la déroule : un superset alterne ses exercices tour par tour,
// et le repos ne vient qu'après la dernière ligne du tour (le plus long du groupe, comme cocherTour).
export function versMontre(w, state, v = Date.now()) {
  const series = [];
  for (const b of blocs(w)) {
    const tours = Math.max(...b.map(ei => w.entrees[ei].series.length));
    const reposTour = Math.max(...b.map(ei => reposDe(state, w.entrees[ei].exerciseId)));
    for (let si = 0; si < tours; si++) {
      const lignes = b.filter(ei => w.entrees[ei].series[si]);
      lignes.forEach((ei, k) => {
        const e = w.entrees[ei], s = e.series[si];
        series.push({ sid: s.sid, ex: e.exerciseId, nom: abreger(e.nomExercice), n: si + 1, total: e.series.length,
          kg: s.kg, reps: s.reps, ech: s.echauffement, faite: s.faite, repos: k === lignes.length - 1 ? reposTour : 0, ss: b.length > 1 });
      });
    }
  }
  const alts = {};
  for (const e of w.entrees) {
    if (e.series.every(s => s.faite)) continue;
    alts[e.exerciseId] = alternatives(state, e.exerciseId, w).slice(0, 10).map(x => {
      const c = conseil(x, sessionsDe(state, x.id));
      return { ex: x.id, nom: abreger(x.nom), kg: c.kg, reps: c.reps, repos: x.reposSec ?? 90 };
    });
  }
  return { wid: w.id, v, series, alts };
}

function trouver(w, sid) {
  for (const [ei, e] of w.entrees.entries()) {
    const si = e.series.findIndex(s => s.sid === sid);
    if (si >= 0) return [ei, si];
  }
  return null;
}
const surSerie = (w, ei, si, fn) => ({ ...w, entrees: w.entrees.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : fn(s)) }) });

// Validation arrivée après « Terminer » pour une série non cochée (donc retirée) : ajoutée à son exercice.
function ajouterEnRetard(w, state, ev) {
  let entrees = w.entrees, ei = entrees.findIndex(e => e.exerciseId === ev.ex);
  if (ei < 0) {
    const nom = state.exercises.find(e => e.id === ev.ex)?.nom ?? ev.ex;
    entrees = [...entrees, { exerciseId: ev.ex, nomExercice: nom, supersetGroupe: null, note: '', series: [] }];
    ei = entrees.length - 1;
  }
  entrees = entrees.map((e, i) => i !== ei ? e : { ...e, series: [...e.series, { kg: ev.kg, reps: ev.reps, rir: null, faite: true, echauffement: false, sid: ev.sid }] });
  return [{ ...w, entrees }, [ei, entrees[ei].series.length - 1]];
}

function un(state, ev, now) {
  const enCours = state.enCours?.id === ev.wid;
  const w = enCours ? state.enCours : state.workouts.find(x => x.id === ev.wid);
  if (!w) return state;
  let w2;
  if (ev.type === 'fin') w2 = { ...w, montre: ev.resume };
  else if (ev.type === 'remplacer') {
    if (!Array.isArray(ev.sids) || !state.exercises.some(e => e.id === ev.ex)) return state; // exercice supprimé entre-temps
    const p = enCours && !ev.sids.some(sid => trouver(w, sid)) && trouver(w, ev.sid);
    if (!p) return state; // déjà appliqué, ou séance terminée entre-temps
    w2 = remplacerExercice(w, state, p[0], ev.ex, ev.sids);
  } else {
    let p = trouver(w, ev.sid), base = w;
    if (!p && ev.type === 'serie' && !enCours) [base, p] = ajouterEnRetard(w, state, ev);
    if (!p) return state; // série supprimée sur le téléphone : ignorée
    const [ei, si] = p;
    if (ev.type === 'repos') w2 = surSerie(base, ei, si, s => ({ ...s, montre: { ...s.montre, fcFinRepos: ev.fc } }));
    else {
      w2 = surSerie(base, ei, si, s => ({ ...s, kg: ev.kg, reps: ev.reps, faite: true, montre: { ...s.montre, fcMoy: ev.fcMoy, fcMax: ev.fcMax },
        ...(Array.isArray(ev.deg) ? { degressive: { reps: ev.deg[0], kgFin: ev.deg[1] ?? null } } : {}) }));
      const fin = ev.t + ev.repos * 1000;
      if (enCours && ev.repos > 0 && fin > now) w2 = { ...w2, repos: { fin, duree: ev.repos, ei, si, montre: true } };
    }
  }
  return enCours ? { ...state, enCours: w2 } : { ...state, workouts: state.workouts.map(x => x.id === w.id ? w2 : x) };
}

// Applique les événements de la montre (dans l'ordre du serveur) ; rejouer les mêmes ne change rien.
// Un événement mal formé est ignoré : sinon il serait relu et rejeté à chaque synchro, et bloquerait tous les suivants.
export const appliquer = (state, evenements, now) => [...evenements].sort((a, b) => a.n - b.n).reduce((s, ev) => {
  try { return un(s, ev, now); } catch { return s; }
}, state);

// ---------- Synchro avec le serveur ----------
// Réglage dans localStorage : { code, apres, attente: [{ wid, depuis }] } ; absent = montre désactivée.
// apres : dernier événement appliqué ; attente : séances terminées sur le téléphone dont la montre n'a pas encore fini.
const K = 'muscu:montre', DOUZE_HEURES = 43_200_000;
const IO = { fetch: (...a) => globalThis.fetch(...a), get storage() { return globalThis.localStorage; } };
function lireCfg(io) { try { return JSON.parse(io.storage.getItem(K)); } catch { return null; } }
function ecrireCfg(io, cfg) { try { cfg ? io.storage.setItem(K, JSON.stringify(cfg)) : io.storage.removeItem(K); } catch { /* stockage indisponible */ } }

// Réponse, ou null si le réseau a échoué (jamais d'erreur : la séance ne doit pas en pâtir).
async function requete(io, methode, route, corps, code) {
  try {
    const r = await io.fetch(SERVEUR + route, { method: methode, body: JSON.stringify({ id: idAppareil(), ...corps }),
      headers: { Authorization: `Bearer ${code}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000) });
    return r;
  } catch { return null; }
}

export const etatMontre = (io = IO) => lireCfg(io) ? 'activee' : 'desactivee';
export const cleMontre = (io = IO) => `${lireCfg(io)?.code}.${idAppareil()}`;
export const montreEnAttente = (io = IO) => !!lireCfg(io)?.attente.length;

export async function activerMontre(code, io = IO) {
  const r = await requete(io, 'POST', '/evenements', { apres: 0 }, code);
  if (r?.status === 401) return 'code';
  if (!r?.ok) return 'reseau';
  ecrireCfg(io, { code, apres: 0, attente: [] });
  return 'ok';
}

export async function desactiverMontre(io = IO) {
  const cfg = lireCfg(io);
  if (cfg) await requete(io, 'DELETE', '/seance', {}, cfg.code);
  ecrireCfg(io, null);
  dernierEnvoi = null;
}

// Séance terminée sur le téléphone : on continue d'écouter la montre jusqu'à sa fin (ou 12 h).
export function attendreFin(wid, io = IO) {
  const cfg = lireCfg(io);
  if (cfg) ecrireCfg(io, { ...cfg, attente: [...cfg.attente, { wid, depuis: Date.now() }] });
}

let dernierEnvoi = null, enVol = null; // enVol : la synchro en cours (promesse), ou null
// Pousse la séance si elle a changé, puis (lire) récupère et applique les événements de la montre.
// ctx.maj rappelle cette fonction : pendant une synchro, les appels suivants ne font rien (la prochaine les rattrape).
export function synchroniserMontre(ctx, options = {}) {
  if (enVol) return Promise.resolve();
  enVol = synchro(ctx, options).finally(() => { enVol = null; });
  return enVol;
}

async function synchro(ctx, { io = IO, lire = true } = {}) {
  let cfg = lireCfg(io);
  if (!cfg || ctx.demo) return;
  {
    if (ctx.state.enCours && avecIds(ctx.state.enCours) !== ctx.state.enCours) ctx.maj(s => ({ ...s, enCours: avecIds(s.enCours) }), { rendre: false });
    const w = ctx.state.enCours;
    if (w) {
      const texte = JSON.stringify(versMontre(w, ctx.state, 0));
      if (texte !== dernierEnvoi) {
        const r = await requete(io, 'PUT', '/seance', { seance: { ...JSON.parse(texte), v: Date.now() } }, cfg.code);
        if (r?.ok) dernierEnvoi = texte;
      }
    }
    if (!w && !cfg.attente.length) { // séance abandonnée : plus rien à garder sur le serveur
      if (dernierEnvoi) { await requete(io, 'DELETE', '/seance', {}, cfg.code); dernierEnvoi = null; }
      return;
    }
    if (!lire) return;
    const r = await requete(io, 'POST', '/evenements', { apres: cfg.apres }, cfg.code);
    if (!r?.ok) return;
    let evenements;
    try { ({ evenements } = await r.json()); } catch { return; }
    if (evenements.length) ctx.maj(s => appliquer(s, evenements, Date.now()));
    // Le curseur n'avance qu'une fois l'état appliqué et enregistré (ctx.maj enregistre).
    cfg = lireCfg(io);
    if (!cfg) return;
    const finies = new Set(evenements.filter(e => e.type === 'fin').map(e => e.wid));
    const attente = cfg.attente.filter(a => !finies.has(a.wid) && Date.now() - a.depuis < DOUZE_HEURES);
    ecrireCfg(io, { ...cfg, apres: Math.max(cfg.apres, ...evenements.map(e => e.n)), attente });
    if (!ctx.state.enCours && !attente.length && cfg.attente.length) { // la montre a fini : rien ne reste sur le serveur
      await requete(io, 'DELETE', '/seance', {}, cfg.code);
      dernierEnvoi = null;
    }
  }
}

// Avant « Terminer » : une dernière récupération, abandonnée après 3 s pour ne pas faire attendre.
// Si une synchro tourne déjà (par exemple l'envoi lancé par ctx.maj), on l'attend puis on relit.
export const recupererAvantFin = (ctx, options = {}) => Promise.race([
  (async () => { if (enVol) await enVol.catch(() => {}); await synchroniserMontre(ctx, options); })(),
  new Promise(r => setTimeout(r, 3000)),
]);
