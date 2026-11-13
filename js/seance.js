// Logique de la séance en cours (spec §4.2) : fonctions pures, sans mutation.
import { conseil, sessionsDe, e1rm } from './moteur.js';

const fmtKg = n => String(n).replace('.', ',');
const exDe = (state, id) => state.exercises.find(e => e.id === id);
const serie = (kg, reps) => ({ kg, reps, rir: null, faite: false, echauffement: false });

function entree(state, exerciseId, nb, supersetGroupe = null) {
  const ex = exDe(state, exerciseId);
  const c = conseil(ex, sessionsDe(state, exerciseId));
  return { exerciseId, nomExercice: ex.nom, supersetGroupe, note: '', series: Array.from({ length: nb }, () => serie(c.kg, c.reps)) };
}

export function demarrer(state, templateId, now = new Date()) {
  const t = state.templates.find(x => x.id === templateId) ?? null;
  return {
    id: 'w' + now.getTime(), templateId: t?.id ?? null, nom: t?.nom ?? 'Séance libre',
    debut: now.toISOString(), fin: null, repos: null,
    entrees: t ? t.items.map(it => entree(state, it.exerciseId, it.series, it.supersetGroupe)) : [],
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

export function cocher(w, ei, si, state, now = new Date()) {
  const s = w.entrees[ei].series[si];
  if (s.faite) return surSerie(w, ei, si, x => ({ ...x, faite: false }));
  if (!valide(s, state, w.entrees[ei])) return w;
  const suivant = surSerie(w, ei, si, x => ({ ...x, faite: true }));
  const e = w.entrees[ei];
  // Superset : le repos ne démarre qu'après le dernier exercice du groupe.
  if (e.supersetGroupe) {
    const dernier = w.entrees.reduce((m, x, i) => x.supersetGroupe === e.supersetGroupe ? i : m, -1);
    if (ei !== dernier) return suivant;
  }
  const duree = exDe(state, e.exerciseId)?.reposSec ?? 90;
  // ei / si : série sous laquelle s'affiche la barre de repos.
  return { ...suivant, repos: { fin: now.getTime() + duree * 1000, duree, ei, si } };
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

export const programmeDepuisSeance = w =>
  w.entrees.map(e => ({ exerciseId: e.exerciseId, series: e.series.filter(s => !s.echauffement).length, supersetGroupe: e.supersetGroupe }));

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
  const programmeModifie = !!t && JSON.stringify(programmeDepuisSeance(w)) !== JSON.stringify(t.items.map(({ exerciseId, series, supersetGroupe }) => ({ exerciseId, series, supersetGroupe })));
  return { workout, records, programmeModifie };
}
