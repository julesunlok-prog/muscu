// Logique de la séance en cours (spec §4.2) : fonctions pures, sans mutation.
import { conseil, sessionsDe, e1rm } from './moteur.js';

const fmtKg = n => String(n).replace('.', ',');
const exDe = (state, id) => state.exercises.find(e => e.id === id);
const serie = (kg, reps) => ({ kg, reps, rir: null, faite: false, echauffement: false });

function entree(state, exerciseId, nb, supersetGroupe = null, transition = null) {
  const ex = exDe(state, exerciseId);
  const c = conseil(ex, sessionsDe(state, exerciseId));
  return { exerciseId, nomExercice: ex.nom, supersetGroupe, note: '', series: Array.from({ length: nb }, () => serie(c.kg, c.reps)),
    ...(transition ? { transition } : {}) };
}

// Transition (facultative, en secondes) : repos en plus après la dernière série d'un exercice (ou le dernier tour d'un superset),
// quand un autre exercice suit. Elle s'ajoute au repos de cette série. eis : l'exercice, ou les exercices du superset.
export function transitionApres(w, eis, si) {
  const dernierTour = si >= Math.max(...eis.map(ei => w.entrees[ei].series.length)) - 1;
  return dernierTour && Math.max(...eis) < w.entrees.length - 1 ? Math.max(0, ...eis.map(ei => w.entrees[ei].transition ?? 0)) : 0;
}

export function demarrer(state, templateId, now = new Date()) {
  const t = state.templates.find(x => x.id === templateId) ?? null;
  return {
    id: 'w' + now.getTime(), templateId: t?.id ?? null, nom: t?.nom ?? 'Séance libre',
    debut: now.toISOString(), fin: null, repos: null,
    entrees: t ? t.items.map(it => entree(state, it.exerciseId, it.series, it.supersetGroupe, it.transition)) : [],
  };
}

// Même série de la dernière séance terminée qui contient cet exercice.
export function precedent(state, exerciseId, index) {
  const w = [...state.workouts].sort((a, b) => b.debut.localeCompare(a.debut))
    .find(x => x.entrees.some(e => e.exerciseId === exerciseId));
  const s = w?.entrees.find(e => e.exerciseId === exerciseId).series.filter(x => x.faite)[index];
  return s ? `${fmtKg(s.kg)} kg × ${s.reps}` : null;
}

export function lireNombre(str) {
  const t = String(str ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Copie la séance et applique fn à la série visée.
function surSerie(w, ei, si, fn) {
  return { ...w, entrees: w.entrees.map((e, i) => i !== ei ? e : { ...e, series: e.series.map((s, j) => j !== si ? s : fn(s)) }) };
}

export const modifierSerie = (w, ei, si, champ, valeur) => surSerie(w, ei, si, s => ({ ...s, [champ]: valeur }));
export const basculerEchauffement = (w, ei, si) => surSerie(w, ei, si, s => ({ ...s, echauffement: !s.echauffement }));
// Dégressive : { reps : reps faites après la première charge, toutes baisses additionnées ; kgFin : dernière charge, facultative }.
export const basculerDegressive = (w, ei, si) => surSerie(w, ei, si, ({ degressive, ...s }) => degressive ? s : { ...s, degressive: { reps: null, kgFin: null } });
export const modifierDegressive = (w, ei, si, champ, valeur) => surSerie(w, ei, si, s => ({ ...s, degressive: { ...s.degressive, [champ]: valeur } }));

export function cocher(w, ei, si, state, now = new Date()) {
  const s = w.entrees[ei].series[si];
  if (s.faite) return surSerie(w, ei, si, x => ({ ...x, faite: false }));
  if (!valide(s, state, w.entrees[ei])) return w;
  const suivant = surSerie(w, ei, si, x => ({ ...x, faite: true }));
  const duree = (exDe(state, w.entrees[ei].exerciseId)?.reposSec ?? 90) + transitionApres(w, [ei], si);
  // ei / si : série sous laquelle s'affiche la barre de repos.
  return { ...suivant, repos: { fin: now.getTime() + duree * 1000, duree, ei, si } };
}

// Superset : un tour = la série si de chaque exercice du groupe (eis). Une coche valide tout le tour,
// puis lance le plus long repos du groupe. Rien n'est coché si une ligne du tour est incomplète.
export function cocherTour(w, eis, si, state, now = new Date()) {
  const lignes = eis.filter(ei => w.entrees[ei].series[si]);
  if (lignes.every(ei => w.entrees[ei].series[si].faite)) return lignes.reduce((x, ei) => surSerie(x, ei, si, s => ({ ...s, faite: false })), w);
  if (!lignes.every(ei => w.entrees[ei].series[si].faite || valide(w.entrees[ei].series[si], state, w.entrees[ei]))) return w;
  const suivant = lignes.reduce((x, ei) => surSerie(x, ei, si, s => ({ ...s, faite: true })), w);
  const duree = Math.max(...eis.map(ei => exDe(state, w.entrees[ei].exerciseId)?.reposSec ?? 90)) + transitionApres(w, eis, si);
  return { ...suivant, repos: { fin: now.getTime() + duree * 1000, duree, ei: lignes[0], si } };
}

// Série prête à être validée : reps et charge saisies (charge 0 permise au poids du corps).
const valide = (s, state, e) => s.reps > 0 && (s.kg > 0 || (exDe(state, e.exerciseId)?.materiel === 'poids_du_corps' && s.kg === 0));

// « Valider les séries restantes » à la fin : coche toutes les séries remplies.
export const cocherRestantes = (w, state) =>
  ({ ...w, entrees: w.entrees.map(e => ({ ...e, series: e.series.map(s => s.faite || !valide(s, state, e) ? s : { ...s, faite: true }) })) });

export function ajouterSerie(w, ei) {
  const der = w.entrees[ei].series.at(-1);
  return { ...w, entrees: w.entrees.map((e, i) => i !== ei ? e : { ...e, series: [...e.series, serie(der?.kg ?? null, der?.reps ?? null)] }) };
}

export function supprimerSerie(w, ei, si) {
  // La barre de repos suit sa série : elle disparaît avec elle, ou remonte d'un cran si une série au-dessus est supprimée.
  const r = w.repos, ancre = r && r.ei === ei && r.si != null;
  const repos = !ancre || r.si < si ? r : r.si === si ? { ...r, ei: null, si: null } : { ...r, si: r.si - 1 };
  return { ...w, repos, entrees: w.entrees.map((e, i) => i !== ei ? e : { ...e, series: e.series.filter((_, j) => j !== si) }) };
}

export function ajouterExercice(w, state, exerciseId) {
  const ex = exDe(state, exerciseId);
  return { ...w, entrees: [...w.entrees, entree(state, exerciseId, ex.series)] };
}

// Remplaçants d'un exercice, du plus proche au moins proche (spec montre §Remplacer) : même muscle principal
// (même famille polyarticulaire / isolation d'abord), ce muscle en secondaire, ses muscles secondaires en principal,
// puis même groupe de mouvement (pousser / tirer / jambes), puis le reste de la même moitié du corps.
const famille = type => type.split('_')[0];
export const GROUPE = { pectoraux: 'pousser', delt_ant: 'pousser', delt_lat: 'pousser', triceps: 'pousser',
  dos: 'tirer', delt_post: 'tirer', biceps: 'tirer', quadriceps: 'jambes', ischios: 'jambes', fessiers: 'jambes', mollets: 'jambes',
  trapezes: 'tirer', avant_bras: 'tirer', adducteurs: 'jambes', abdos: 'tronc', lombaires: 'tronc' };
const moitie = m => GROUPE[m] === 'jambes' ? 'bas' : 'haut';
export function alternatives(state, exerciseId, w) {
  const a = exDe(state, exerciseId);
  if (!a) return [];
  const dans = new Set([exerciseId, ...w.entrees.map(e => e.exerciseId)]);
  const rang = e => e.musclePrincipal === a.musclePrincipal ? (famille(e.type) === famille(a.type) ? 0 : 1)
    : e.musclesSecondaires?.includes(a.musclePrincipal) ? 2
    : a.musclesSecondaires?.includes(e.musclePrincipal) ? 3
    : GROUPE[e.musclePrincipal] === GROUPE[a.musclePrincipal] ? (famille(e.type) === famille(a.type) ? 4 : 5)
    : moitie(e.musclePrincipal) === moitie(a.musclePrincipal) ? 6 : null;
  return state.exercises.filter(e => !e.archive && !dans.has(e.id) && rang(e) != null)
    .sort((x, y) => rang(x) - rang(y) || x.nom.localeCompare(y.nom));
}

// Les séries faites restent sur A ; B reprend les séries restantes avec son propre conseil.
// Superset entamé : B est ajouté seul après le bloc, pour garder l'alignement des tours.
export function remplacerExercice(w, state, ei, nouvelId, sids = null) {
  const a = w.entrees[ei], faites = a.series.filter(s => s.faite), reste = a.series.length - faites.length;
  if (!reste) return w;
  const b = entree(state, nouvelId, reste, a.supersetGroupe, a.transition); // B prend la place de A, transition comprise
  if (sids) b.series = b.series.map((s, i) => sids[i] ? { ...s, sid: sids[i] } : s);
  const entrees = [...w.entrees];
  if (!faites.length) { entrees[ei] = b; return { ...w, entrees }; }
  const { transition, ...sansTransition } = a; // A est maintenant suivi de B : plus de transition après lui
  entrees[ei] = { ...sansTransition, series: faites };
  let j = ei;
  if (a.supersetGroupe) { b.supersetGroupe = null; while (entrees[j + 1]?.supersetGroupe === a.supersetGroupe) j++; }
  entrees.splice(j + 1, 0, b);
  // La barre de repos suit sa série : décalée si elle est plus bas, ramenée sur la dernière série faite de A.
  const r = w.repos;
  const repos = !r || r.ei == null ? r : r.ei > j ? { ...r, ei: r.ei + 1 } : r.ei === ei ? { ...r, si: faites.length - 1 } : r;
  return { ...w, entrees, repos };
}

// Saisies de la feuille Historique appliquées à la séance telle qu'elle est maintenant (les données de la montre
// arrivées pendant que la feuille était ouverte sont gardées). Séries sans charge ni reps retirées ; null si plus rien.
export function modifierSeanceHistorique(w, valeurs) {
  const copie = structuredClone(w);
  for (const { ei, si, champ, valeur } of valeurs) { const s = copie.entrees[ei]?.series[si]; if (s) s[champ] = valeur; }
  copie.entrees = copie.entrees.map(e => ({ ...e, series: e.series.filter(s => s.kg != null && s.kg >= 0 && s.reps > 0) })).filter(e => e.series.length);
  return copie.entrees.length ? copie : null;
}

export function supprimerExerciceSeance(w, ei) {
  return { ...w, entrees: w.entrees.filter((_, i) => i !== ei) };
}

export function deplacerExercice(w, ei, delta) {
  const j = ei + delta;
  if (j < 0 || j >= w.entrees.length) return w;
  const entrees = [...w.entrees];
  [entrees[ei], entrees[j]] = [entrees[j], entrees[ei]];
  return { ...w, entrees };
}

// En pause, repos.pause garde les millisecondes restantes et fin n'est plus utilisé.
export const resteRepos = (w, now = new Date()) => !w.repos ? 0
  : Math.max(0, Math.ceil((w.repos.pause ?? w.repos.fin - now.getTime()) / 1000));
export const ajusterRepos = (w, delta) => !w.repos ? w : { ...w, repos: { ...w.repos, duree: w.repos.duree + delta,
  ...(w.repos.pause != null ? { pause: Math.max(0, w.repos.pause + delta * 1000) } : { fin: w.repos.fin + delta * 1000 }) } };
export const passerRepos = w => ({ ...w, repos: null });
// Repos lancé à la main depuis le minuteur (sans série cochée : pas de barre entre les séries).
export const lancerRepos = (w, duree, now = new Date()) => ({ ...w, repos: { fin: now.getTime() + duree * 1000, duree, ei: null, si: null } });
export const pauserRepos = (w, now = new Date()) => !w.repos || w.repos.pause != null ? w
  : { ...w, repos: { ...w.repos, pause: Math.max(0, w.repos.fin - now.getTime()) } };
export function reprendreRepos(w, now = new Date()) {
  if (w.repos?.pause == null) return w;
  const { pause, ...r } = w.repos;
  return { ...w, repos: { ...r, fin: now.getTime() + pause } };
}
export function recommencerRepos(w, now = new Date()) {
  if (!w.repos) return w;
  const { pause, ...r } = w.repos;
  return { ...w, repos: { ...r, fin: now.getTime() + r.duree * 1000 } };
}

const item = ({ exerciseId, series, supersetGroupe, transition }) => ({ exerciseId, series, supersetGroupe, ...(transition ? { transition } : {}) });
export const programmeDepuisSeance = w =>
  w.entrees.map(e => item({ ...e, series: e.series.filter(s => !s.echauffement).length }));

const meilleur = (series, f) => Math.max(...series.map(f).filter(x => x != null), -Infinity);

export function terminer(state, now = new Date()) {
  const w = state.enCours;
  const { repos, ...reste } = w;
  const entrees = w.entrees.map(e => ({ ...e, series: e.series.filter(s => s.faite) })).filter(e => e.series.length);
  const workout = { ...reste, fin: now.toISOString(), entrees };
  const records = [];
  for (const e of entrees) {
    const avant = sessionsDe(state, e.exerciseId).flatMap(s => s.series);
    if (!avant.length) continue;
    const travail = e.series.filter(s => !s.echauffement);
    if (meilleur(travail, s => e1rm(s.kg, s.reps)) > meilleur(avant, s => e1rm(s.kg, s.reps)) + 1e-9) records.push({ nom: e.nomExercice, type: 'e1rm' });
    if (meilleur(travail, s => s.kg) > meilleur(avant, s => s.kg)) records.push({ nom: e.nomExercice, type: 'kg' });
  }
  const t = state.templates.find(x => x.id === w.templateId);
  const programmeModifie = !!t && JSON.stringify(programmeDepuisSeance(w)) !== JSON.stringify(t.items.map(item));
  return { workout, records, programmeModifie };
}
