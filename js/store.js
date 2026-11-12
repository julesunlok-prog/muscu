// État de l'app : un seul objet, sauvegardé à chaque modification.
import { EXERCICES_INITIAUX, PROGRAMMES_INITIAUX } from './seed.js';

export const CLE = 'muscu:v1';

export function etatInitial() {
  return structuredClone({
    version: 1,
    exercises: EXERCICES_INITIAUX,
    templates: PROGRAMMES_INITIAUX,
    workouts: [],
    enCours: null,
    settings: { musclesPrioritaires: ['pectoraux'], ciblesVolume: {} },
  });
}

const valide = s => s && s.version === 1 && ['exercises', 'templates', 'workouts'].every(k => Array.isArray(s[k])) && s.settings;

export function chargerEtat(storage = globalThis.localStorage) {
  let brut = null;
  try { brut = storage.getItem(CLE); } catch { /* stockage indisponible : on repart de l'état initial */ }
  if (!brut) return etatInitial();
  const s = JSON.parse(brut);
  if (!valide(s)) throw new Error('Données locales illisibles.');
  return s;
}

export function sauver(state, storage = globalThis.localStorage) {
  try { storage.setItem(CLE, JSON.stringify(state)); }
  catch { throw new Error('Stockage plein ou indisponible.'); }
}

export const exporterJSON = state => JSON.stringify(state, null, 2);

export function importerJSON(text) {
  let s;
  try { s = JSON.parse(text); } catch { s = null; }
  if (!valide(s)) throw new Error('Fichier de sauvegarde invalide.');
  return s;
}

// Un exercice déjà utilisé (historique, programme ou séance en cours) est archivé, pas effacé.
export function supprimerExercice(state, id) {
  const utilise = state.workouts.some(w => w.entrees.some(e => e.exerciseId === id))
    || state.templates.some(t => t.items.some(i => i.exerciseId === id))
    || state.enCours?.entrees.some(e => e.exerciseId === id);
  const exercises = utilise
    ? state.exercises.map(e => e.id === id ? { ...e, archive: true } : e)
    : state.exercises.filter(e => e.id !== id);
  return { ...state, exercises };
}

export async function demanderPersistance() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* pas critique */ }
}
