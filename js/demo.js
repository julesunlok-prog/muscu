// Données de démonstration : 12 semaines de Push/Pull/Legs d'un pratiquant intermédiaire.
// Chaque exercice a une « vraie » force qui progresse à son rythme ; à chaque séance, le pratiquant suit le conseil
// de l'app et fait autant de reps que sa force le permet (moins sa marge RIR). Les analyses ont ainsi une histoire à raconter :
// pecs qui avancent lentement, incliné Smith qui plafonne (stagnation puis décharge), élévations latérales bloquées
// par le saut de 2 kg, dos et jambes qui progressent bien, une séance manquée, du RIR saisi sur les premiers exercices.
import { etatInitial } from './store.js';
import { demarrer, modifierSerie, cocher, terminer } from './seance.js';
import { conseil, sessionsDe } from './moteur.js';

// Charge de départ (kg) et progression de la vraie force par semaine (en fraction).
const PROFIL = {
  'developpe-halteres': [24, 0.009], 'incline-smith': [50, 0.009], 'pec-deck': [45, 0.006], 'ecarte-arriere': [30, 0.008],
  'extension-nuque': [20, 0.01], pushdown: [25, 0.009], 'elevations-laterales': [8, 0.005],
  'rowing-barre': [55, 0.011], 'tirage-vertical': [55, 0.01], 'rowing-iso': [40, 0.01], 'curl-marteau': [14, 0.008], 'curl-incline': [10, 0.006],
  presse: [140, 0.013], 'rdl-barre': [70, 0.011], 'leg-extension': [45, 0.009],
};
const PLATEAU = { 'incline-smith': [3, 9] }; // semaines où la force s'effrite un peu (fatigue) avant de repartir

export function genererDemo(now = new Date()) {
  let graine = 42;
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  let s = etatInitial();
  const E = Object.fromEntries(s.exercises.map(e => [e.id, e]));
  const rirDe = ex => Number(String(ex.rirCible).split('–')[0]);
  // Force de départ calibrée pour faire repMin + 1 reps à la charge de départ, à la marge RIR près.
  const force0 = Object.fromEntries(Object.entries(PROFIL).map(([id, [kg]]) => [id, kg * (1 + (E[id].repMin + 1 + rirDe(E[id])) / 30)]));
  const forceA = (id, sem) => {
    const [, taux] = PROFIL[id], [p0, p1] = PLATEAU[id] ?? [99, 99];
    const semainesUtiles = Math.min(sem, p0) + Math.max(0, sem - p1);
    return force0[id] * (1 + taux * semainesUtiles - 0.005 * Math.max(0, Math.min(sem, p1) - p0));
  };

  const debut = new Date(now); debut.setHours(18, 0, 0, 0);
  debut.setDate(debut.getDate() - (debut.getDay() + 6) % 7 - 7 * 11); // lundi d'il y a 11 semaines
  for (let sem = 0; sem < 12; sem++) for (const [jour, prog] of [[0, 'push'], [2, 'pull'], [4, 'legs']]) {
    const d = new Date(debut); d.setDate(debut.getDate() + sem * 7 + jour);
    if (d >= now || (sem === 6 && prog === 'legs')) continue; // une séance manquée
    let w = demarrer(s, prog, d);
    w.entrees.forEach((e, ei) => {
      const ex = E[e.exerciseId], f = forceA(e.exerciseId, sem + jour / 7);
      const decharge = conseil(ex, sessionsDe(s, ex.id)).action === 'decharger'; // séance légère : reps conseillées, pas l'échec
      e.series.forEach((x, si) => {
        const kg = x.kg ?? PROFIL[e.exerciseId][0];
        const possible = 30 * (f / kg - 1) - rirDe(ex) - 0.4 * si + (hasard() - 0.5) * 1.2;
        const reps = decharge ? x.reps : Math.max(1, Math.min(ex.repMax + 3, Math.round(possible)));
        w = modifierSerie(modifierSerie(w, ei, si, 'kg', kg), ei, si, 'reps', reps);
        if (ei < 2) w = modifierSerie(w, ei, si, 'rir', Math.max(0, rirDe(ex) + Math.round((hasard() - 0.5) * 2)));
        w = cocher(w, ei, si, s, d);
      });
    });
    s = { ...s, enCours: w };
    const r = terminer(s, new Date(d.getTime() + (55 + Math.round(hasard() * 20)) * 60000));
    s = { ...s, enCours: null, workouts: [...s.workouts, r.workout] };
  }
  return s;
}
