// État de l'app : un seul objet, sauvegardé à chaque modification.
import { EXERCICES_INITIAUX, PROGRAMMES_INITIAUX, CATALOGUE } from './seed.js';

export const CLE = 'muscu:v1';

export function etatInitial() {
  return structuredClone({
    version: 1,
    exercises: EXERCICES_INITIAUX,
    templates: PROGRAMMES_INITIAUX,
    workouts: [],
    enCours: null,
    settings: { musclesPrioritaires: ['pectoraux'], ciblesVolume: {}, catalogue: CATALOGUE },
  });
}

const valide = s => s && s.version === 1 && ['exercises', 'templates', 'workouts'].every(k => Array.isArray(s[k])) && s.settings;

// Notes et sources des exercices de départ : toujours celles du code (elles ne se modifient pas dans l'app),
// pour que les corrections de sources arrivent aussi dans les données déjà enregistrées.
// Exercices ajoutés au catalogue depuis le dernier chargement : ajoutés une seule fois (un exercice supprimé ne revient pas).
const SEED = Object.fromEntries(EXERCICES_INITIAUX.map(e => [e.id, e]));
// Fiche du catalogue corrigée après publication (seed : corrige = numéro du catalogue de la correction) :
// nom et matériel remis à jour une seule fois ; un renommage fait ensuite par l'utilisateur est gardé.
const corrections = (seed, vu) => (seed.corrige ?? 0) > vu
  ? { nom: seed.nom, materiel: seed.materiel, pasMateriel: seed.pasMateriel, parMain: seed.parMain, type: seed.type } : {};
function notesAJour(s) {
  const vu = s.settings.catalogue ?? 1, ids = new Set(s.exercises.map(e => e.id));
  const nouveaux = EXERCICES_INITIAUX.filter(e => (e.catalogue ?? 1) > vu && !ids.has(e.id));
  return { ...s, settings: { ...s.settings, catalogue: CATALOGUE },
    exercises: [...s.exercises.map(e => SEED[e.id] ? { ...e, ...corrections(SEED[e.id], vu), note: SEED[e.id].note, sources: SEED[e.id].sources } : e), ...structuredClone(nouveaux)] };
}

export function chargerEtat(storage = globalThis.localStorage) {
  let brut = null;
  try { brut = storage.getItem(CLE); } catch { /* stockage indisponible : on repart de l'état initial */ }
  if (!brut) return etatInitial();
  const s = JSON.parse(brut);
  if (!valide(s)) throw new Error('Données locales illisibles.');
  return notesAJour(s);
}

export function sauver(state, storage = globalThis.localStorage) {
  try { storage.setItem(CLE, JSON.stringify(state)); }
  catch { throw new Error('Stockage plein ou indisponible.'); }
}

export const exporterJSON = state => JSON.stringify(state, null, 2);

// Rappel de sauvegarde (iOS efface tout quand l'app est retirée de l'écran d'accueil) : 15 jours après la dernière
// sauvegarde, ou après la première séance s'il n'y en a jamais eu ; « Plus tard » le repousse (rappelReporte).
export function rappelSauvegarde(state, now = Date.now()) {
  const { derniereSauvegarde, rappelReporte } = state.settings;
  const depuis = derniereSauvegarde ?? state.workouts.map(w => w.debut).sort()[0];
  return !!depuis && now - Date.parse(depuis) >= 15 * 864e5 && !(rappelReporte && Date.parse(rappelReporte) > now);
}

export function importerJSON(text) {
  let s;
  try { s = JSON.parse(text); } catch { s = null; }
  if (!valide(s)) throw new Error('Fichier de sauvegarde invalide.');
  return notesAJour(s);
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
