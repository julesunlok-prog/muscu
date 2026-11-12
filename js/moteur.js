// Moteur d'analyse (spec §6) : fonctions pures sur l'état.
import { incrementPour, MUSCLES } from './profils.js';

const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');

// Epley ; au-delà de 12 reps l'estimation n'est plus fiable.
export function e1rm(kg, reps) {
  if (!(kg > 0) || reps > 12) return null; // poids du corps (0 kg) : pas de 1RM, on suit les reps
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

const serieValide = s => s.faite && !s.echauffement && s.kg != null && s.kg >= 0 && s.reps > 0;

// Séances d'un exercice, de la plus ancienne à la plus récente, avec seulement les séries de travail faites.
export function sessionsDe(state, exerciseId) {
  return state.workouts
    .flatMap(w => w.entrees.filter(e => e.exerciseId === exerciseId)
      .map(e => ({ date: w.debut, series: e.series.filter(serieValide).map(({ kg, reps }) => ({ kg, reps })) })))
    .filter(s => s.series.length)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const SAUT_MAX = 0.10; // au-delà, on étend la fourchette avant d'augmenter (spec §6.2 point 3)

// Double progression sur la dernière séance (spec §6.2).
export function conseil(ex, sessions) {
  const { repMin: lo, repMax: hi } = ex;
  if (!sessions.length)
    return { action: 'premiere', kg: null, reps: lo, sources: ['S6', 'S7'],
      texte: `Première fois : choisis une charge pour ${lo}–${hi} reps en gardant ${ex.rirCible} rep(s) en réserve` };
  const st = stagnation(ex, sessions);
  if (st)
    return { action: 'decharger', kg: st.kgDecharge, reps: hi, sources: ['S9', 'S3'],
      texte: `Stagnation depuis ${st.depuis} séances : décharge à ${fmt(st.kgDecharge)} kg, vise ${hi} reps, puis remonte en double progression` };
  const last = sessions[sessions.length - 1];
  const top = Math.max(...last.series.map(s => s.kg));
  const reps = last.series.filter(s => s.kg === top).map(s => s.reps);
  const faible = Math.min(...reps);
  const inc = incrementPour(ex, top);
  const saut = inc / top > SAUT_MAX;
  const plafond = saut ? hi + 3 : hi;
  if (faible >= plafond)
    return { action: 'augmenter', kg: top + inc, reps: lo, sources: saut ? ['S1', 'S3'] : ['S1', 'S2'],
      texte: `+${fmt(inc)} kg → ${fmt(top + inc)} kg, vise ${lo} reps` };
  const cible = Math.min(plafond, faible + 1);
  if (saut && faible >= hi)
    return { action: 'etendre', kg: top, reps: cible, sources: ['S3'],
      texte: `Garde ${fmt(top)} kg, vise ${cible} reps : ${top > 0 ? `le prochain palier (+${fmt(inc)} kg) fait +${Math.round(inc / top * 100)} %` : 'avant d’ajouter du lest'}, monte d’abord en reps` };
  return { action: 'maintenir', kg: top, reps: cible, sources: ['S1', 'S3'],
    texte: `Garde ${fmt(top)} kg, vise ${cible} reps sur chaque série (objectif ${plafond})` };
}

const JOUR = 86400000;
const meilleurE1 = s => Math.max(...s.series.map(x => e1rm(x.kg, x.reps) ?? -Infinity));
const kgMax = s => Math.max(...s.series.map(x => x.kg));
const repsA = (s, kg) => Math.max(...s.series.filter(x => x.kg >= kg).map(x => x.reps), -Infinity);

// Progrès = nouveau record de 1RM estimé, ou plus de reps qu'avant à une charge égale ou supérieure (spec §6.3).
function progres(sessions, i) {
  const avant = sessions.slice(0, i), s = sessions[i];
  const e = meilleurE1(s);
  if (e > -Infinity && e > Math.max(...avant.map(meilleurE1), -Infinity) + 1e-9) return true;
  // Double progression : une rep gagnée sur n'importe quelle série compte (total des reps à charge égale ou supérieure).
  const k = kgMax(s), total = x => x.series.filter(r => r.kg >= k).reduce((t, r) => t + r.reps, 0);
  return total(s) > Math.max(...avant.map(total), -Infinity);
}

export function stagnation(ex, sessions) {
  if (sessions.length < 4) return null;
  let dernier = 0;
  for (let i = 1; i < sessions.length; i++) if (progres(sessions, i)) dernier = i;
  const depuis = sessions.length - 1 - dernier;
  if (depuis < 3) return null;
  const top = kgMax(sessions[sessions.length - 1]), pas = ex.pasMateriel;
  // Charge déjà baissée depuis le dernier progrès : décharge en cours, on laisse remonter (pas de décharge en boucle).
  if (top < Math.max(...sessions.slice(dernier, -1).map(kgMax))) return null;
  const kgDecharge = Math.max(0, Math.min(top - pas, Math.round(top * 0.925 / pas) * pas));
  return { depuis, dateRecord: sessions[dernier].date, kgDecharge };
}

export function lundiDe(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.toISOString();
}

// Performance en baisse : moins de reps à la même charge, sinon 1RM estimé plus bas.
function enBaisse(a, b) {
  if (kgMax(a) === kgMax(b)) return repsA(b, kgMax(b)) < repsA(a, kgMax(a));
  const ea = meilleurE1(a), eb = meilleurE1(b);
  return ea > -Infinity && eb > -Infinity && eb < ea;
}

export function fatigue(state, now = new Date()) {
  const lundi = lundiDe(now);
  const exercices = state.exercises.filter(ex => {
    const s = sessionsDe(state, ex.id);
    return s.length >= 2 && s[s.length - 1].date >= lundi && enBaisse(s[s.length - 2], s[s.length - 1]);
  }).map(ex => ex.nom);
  return exercices.length >= 3 ? { exercices } : null;
}

function ajouterVolume(v, ex, n) {
  if (!ex) return;
  v[ex.musclePrincipal] += n;
  for (const m of ex.musclesSecondaires) v[m] += n / 2;
}
const zero = () => Object.fromEntries(MUSCLES.map(m => [m, 0]));
const exDe = state => Object.fromEntries(state.exercises.map(e => [e.id, e]));

// Comptage fractionnaire (S5) : 1 pour le muscle principal, 0,5 par muscle secondaire.
export function volumePrevu(state) {
  const v = zero(), E = exDe(state);
  for (const t of state.templates) for (const it of t.items) ajouterVolume(v, E[it.exerciseId], it.series);
  return v;
}

export function volumeSemaine(state, lundiISO) {
  const v = zero(), E = exDe(state);
  const fin = new Date(Date.parse(lundiISO) + 7 * JOUR).toISOString();
  for (const w of state.workouts) {
    if (w.debut < lundiISO || w.debut >= fin) continue;
    for (const e of w.entrees) ajouterVolume(v, E[e.exerciseId], e.series.filter(serieValide).length);
  }
  return v;
}

export function ciblesVolume(state) {
  const { musclesPrioritaires, ciblesVolume: c } = state.settings;
  return Object.fromEntries(MUSCLES.map(m => [m, c[m] ?? (musclesPrioritaires.includes(m) ? 14 : 10)]));
}

export function alerteEpaules(state) {
  const v = volumePrevu(state);
  return v.pectoraux > 0 && v.delt_ant >= 0.75 * v.pectoraux ? { pecs: v.pectoraux, deltAnt: v.delt_ant } : null;
}

// Droite des moindres carrés (pente négative ramenée à 0) et marge d'incertitude :
// ±2 écarts-types résiduels, élargie quand on s'éloigne des données (intervalle de prédiction classique).
function regression(pts) {
  const n = pts.length, mx = pts.reduce((t, p) => t + p[0], 0) / n, my = pts.reduce((t, p) => t + p[1], 0) / n;
  const sxx = pts.reduce((t, p) => t + (p[0] - mx) ** 2, 0);
  const pente = Math.max(0, sxx ? pts.reduce((t, p) => t + (p[0] - mx) * (p[1] - my), 0) / sxx : 0);
  const f = d => my + pente * (d - mx);
  const se = n > 2 ? Math.sqrt(pts.reduce((t, p) => t + (p[1] - f(p[0])) ** 2, 0) / (n - 2)) : 0;
  const marge = d => 2 * se * Math.sqrt(1 + 1 / n + (sxx ? (d - mx) ** 2 / sxx : 0));
  return { f, marge };
}

// Tendance sur 8 semaines, au moins 4 séances ; pente négative ramenée à 0 (spec §6.5).
export function prediction(sessions) {
  if (!sessions.length) return null;
  const fin = Date.parse(sessions[sessions.length - 1].date);
  const recentes = sessions.filter(s => fin - Date.parse(s.date) <= 56 * JOUR);
  const x = s => (Date.parse(s.date) - fin) / JOUR;
  const avecE = recentes.filter(s => meilleurE1(s) > -Infinity);
  if (avecE.length >= 4) {
    const { f, marge } = regression(avecE.map(s => [x(s), meilleurE1(s)]));
    return { type: 'e1rm', parSemaine: f(7) - f(0), maintenant: f(0), s4: f(28), s8: f(56), s12: f(84),
      m4: marge(28), m8: marge(56), m12: marge(84), depuisJours: x(avecE[0]), n: avecE.length, a: f, marge };
  }
  if (avecE.length) return null;
  const kg = kgMax(sessions[sessions.length - 1]);
  const aKg = recentes.filter(s => s.series.some(r => r.kg === kg));
  if (aKg.length < 4) return null;
  const { f, marge } = regression(aKg.map(s => [x(s), Math.max(...s.series.filter(r => r.kg === kg).map(r => r.reps))]));
  return { type: 'reps', kg, parSemaine: f(7) - f(0), s4: f(28), m4: marge(28), n: aKg.length };
}

// Ce que l'app aurait prédit il y a `jours` jours, comparé à la dernière séance réelle.
export function verifierPrediction(sessions, jours = 28) {
  if (!sessions.length) return null;
  const der = sessions[sessions.length - 1], fin = Date.parse(der.date);
  const passe = sessions.filter(s => Date.parse(s.date) <= fin - jours * JOUR);
  const p = prediction(passe), reel = meilleurE1(der);
  if (p?.type !== 'e1rm' || reel === -Infinity) return null;
  const d = (fin - Date.parse(passe[passe.length - 1].date)) / JOUR, prevu = p.a(d);
  return { prevu, reel, ecart: reel - prevu, dansFourchette: Math.abs(reel - prevu) <= p.marge(d) + 1e-6, jours: d };
}

// ---------- Statistiques de l'onglet Analyse ----------
// Indice de force relatif (Epley sans plafond) : sert seulement à comparer des séances du même exercice entre elles.
const indice = s => { const v = Math.max(...s.series.filter(x => x.kg > 0).map(x => x.kg * (1 + x.reps / 30))); return v > 0 ? v : null; };
function debutJour(now, jours) { const d = new Date(now.getTime() - jours * JOUR); d.setHours(0, 0, 0, 0); return d.getTime(); }
const dans = (iso, debut, now) => { const t = Date.parse(iso); return t >= debut && t <= now.getTime(); };
const actifs = state => state.exercises.filter(e => !e.archive);
const jourLocal = iso => new Date(iso).toDateString();

function progressionExercice(sessions, debut, now) {
  const pts = sessions.filter(s => dans(s.date, debut, now) && indice(s)).map(s => ({ x: Date.parse(s.date), v: indice(s) }));
  return pts.length < 2 ? null : pts.map(p => ({ x: p.x, y: p.v / pts[0].v * 100 }));
}

export function progressionExercicesMuscle(state, muscle, now = new Date(), jours = 56) {
  const debut = debutJour(now, jours);
  return actifs(state).filter(e => e.musclePrincipal === muscle)
    .map(e => ({ nom: e.nom, id: e.id, points: progressionExercice(sessionsDe(state, e.id), debut, now) })).filter(e => e.points);
}

export function progressionMuscles(state, now = new Date(), jours = 56) {
  return Object.fromEntries(MUSCLES.map(m => {
    const ex = progressionExercicesMuscle(state, m, now, jours);
    return [m, ex.length ? ex.reduce((t, e) => t + e.points[e.points.length - 1].y - 100, 0) / ex.length : null];
  }));
}

export function lundis(now, semaines) {
  const l = new Date(lundiDe(now));
  return Array.from({ length: semaines }, (_, i) => { const d = new Date(l); d.setDate(d.getDate() - 7 * (semaines - 1 - i)); return d; });
}

export function volumeParSemaine(state, muscle, now = new Date(), semaines = 12) {
  return lundis(now, semaines).map(d => ({ x: d.getTime(), y: volumeSemaine(state, d.toISOString())[muscle] }));
}

export function records(state) {
  const out = [];
  for (const ex of state.exercises) {
    let max = -Infinity;
    sessionsDe(state, ex.id).forEach((s, i) => {
      const v = indice(s);
      if (v == null) return;
      if (i > 0 && v > max + 1e-9) out.push({ date: s.date, nom: ex.nom, exerciseId: ex.id });
      max = Math.max(max, v);
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function regularite(state, now = new Date(), semaines = 8) {
  const prevu = state.templates.length;
  const liste = lundis(now, semaines).map(d => {
    const fin = new Date(d); fin.setDate(fin.getDate() + 7);
    const ws = state.workouts.filter(w => dans(w.debut, d.getTime(), now) && Date.parse(w.debut) < fin.getTime());
    return { x: d.getTime(), y: new Set(ws.map(w => jourLocal(w.debut))).size };
  });
  let serie = 0; // semaines complètes consécutives, en partant de la dernière semaine terminée
  for (let i = liste.length - 2; i >= 0 && prevu > 0 && liste[i].y >= prevu; i--) serie++;
  return { prevu, semaines: liste, serie };
}

const seriesValides = (state, debut, now) => state.workouts.filter(w => dans(w.debut, debut, now))
  .flatMap(w => w.entrees.flatMap(e => e.series.filter(serieValide)));

export function frequenceMuscles(state, now = new Date(), semaines = 4) {
  const E = exDe(state), debut = now.getTime() - semaines * 7 * JOUR;
  const ws = state.workouts.filter(w => dans(w.debut, debut, now));
  return Object.fromEntries(MUSCLES.map(m => {
    const touche = e => E[e.exerciseId]?.musclePrincipal === m && e.series.some(serieValide);
    return [m, {
      prevu: state.templates.filter(t => t.items.some(i => E[i.exerciseId]?.musclePrincipal === m)).length,
      reel: new Set(ws.filter(w => w.entrees.some(touche)).map(w => jourLocal(w.debut))).size / semaines,
    }];
  }));
}

export function equilibre(v) {
  const poussee = v.pectoraux + v.delt_ant + v.triceps, tirage = v.dos + v.delt_post + v.biceps;
  return { poussee, tirage, ratio: poussee ? tirage / poussee : null };
}

export function repartitionReps(state, now = new Date(), jours = 28) {
  const s = seriesValides(state, now.getTime() - jours * JOUR, now);
  return { lourd: s.filter(x => x.reps <= 8).length, moyen: s.filter(x => x.reps > 8 && x.reps <= 15).length,
    leger: s.filter(x => x.reps > 15).length, total: s.length };
}

export function repartitionRir(state, now = new Date(), jours = 28) {
  const s = seriesValides(state, now.getTime() - jours * JOUR, now);
  const avec = s.filter(x => x.rir != null), parRir = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const x of avec) parRir[Math.min(4, Math.round(x.rir))]++;
  return { parRir, total: avec.length, sansRir: s.length - avec.length };
}

export function bilanMois(state, now = new Date()) {
  const debut = now.getTime() - 30 * JOUR;
  const ws = state.workouts.filter(w => dans(w.debut, debut, now));
  const series = seriesValides(state, debut, now);
  const E = exDe(state), cibles = ciblesVolume(state), moy = {};
  // Seuls les muscles ciblés en principal par un exercice des programmes (le deltoïde antérieur ne travaille qu'en secondaire).
  const vises = new Set(state.templates.flatMap(t => t.items.map(i => E[i.exerciseId]?.musclePrincipal)));
  for (const d of lundis(now, 4)) for (const [m, v] of Object.entries(volumeSemaine(state, d.toISOString()))) moy[m] = (moy[m] ?? 0) + v / 4;
  const prio = m => state.settings.musclesPrioritaires.includes(m) ? 1 : 0;
  const retard = MUSCLES.filter(m => vises.has(m)).map(m => ({ muscle: m, ratio: moy[m] / cibles[m] }))
    .sort((a, b) => a.ratio - b.ratio || prio(b.muscle) - prio(a.muscle))[0] ?? null;
  const prog = Object.values(progressionMuscles(state, now, 30)).filter(x => x != null);
  return {
    seances: new Set(ws.map(w => jourLocal(w.debut))).size, series: series.length,
    volume: series.reduce((t, x) => t + x.kg * x.reps, 0),
    records: records(state).filter(r => dans(r.date, debut, now)).length,
    stagnations: actifs(state).filter(e => stagnation(e, sessionsDe(state, e.id))).map(e => e.nom),
    retard, progressionForce: prog.length ? prog.reduce((t, x) => t + x, 0) / prog.length : null,
  };
}
