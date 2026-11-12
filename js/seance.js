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
  const poidsDuCorps = exDe(state, w.entrees[ei].exerciseId)?.materiel === 'poids_du_corps';
  if (!(s.reps > 0 && (s.kg > 0 || (poidsDuCorps && s.kg === 0)))) return w;
  const suivant = surSerie(w, ei, si, x => ({ ...x, faite: true }));
  const e = w.entrees[ei];
  // Superset : le repos ne démarre qu'après le dernier exercice du groupe.
  if (e.supersetGroupe) {
    const dernier = w.entrees.reduce((m, x, i) => x.supersetGroupe === e.supersetGroupe ? i : m, -1);
    if (ei !== dernier) return suivant;
  }
  const duree = exDe(state, e.exerciseId)?.reposSec ?? 90;
  return { ...suivant, repos: { fin: now.getTime() + duree * 1000, duree } };
}

export function ajouterSerie(w, ei) {
  const der = w.entrees[ei].series.at(-1);
  return { ...w, entrees: w.entrees.map((e, i) => i !== ei ? e : { ...e, series: [...e.series, serie(der?.kg ?? null, der?.reps ?? null)] }) };
}

export function supprimerSerie(w, ei, si) {
  return { ...w, entrees: w.entrees.map((e, i) => i !== ei ? e : { ...e, series: e.series.filter((_, j) => j !== si) }) };
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

export const resteRepos = (w, now = new Date()) => w.repos ? Math.max(0, Math.ceil((w.repos.fin - now.getTime()) / 1000)) : 0;
export const ajusterRepos = (w, delta) => w.repos ? { ...w, repos: { fin: w.repos.fin + delta * 1000, duree: w.repos.duree + delta } } : w;
export const passerRepos = w => ({ ...w, repos: null });

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
