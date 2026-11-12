// Import de l'export CSV de Strong (Réglages → Export Strong Data).

// CSV avec guillemets ; séparateur détecté sur la ligne d'en-tête ("," ou ";" selon la langue).
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const fin = text.indexOf('\n');
  const head = fin < 0 ? text : text.slice(0, fin);
  const sep = (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const num = s => { const n = parseFloat(String(s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
export const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function col(header, ...noms) {
  const h = header.map(norm);
  for (const n of noms) { const i = h.findIndex(x => x.startsWith(n)); if (i >= 0) return i; }
  return -1;
}

// "2026-01-05 18:00:00" ou "05/01/2026 18:00" → date locale.
function versDate(s) {
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{1,2})?:?(\d{2})?/);
  if (m) return new Date(+m[1], m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})[ ,]*(\d{1,2})?:?(\d{2})?/);
  if (m) return new Date(+m[3], m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function lireStrong(text) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('Fichier vide.');
  const H = rows[0];
  const c = {
    date: col(H, 'date'),
    seance: col(H, 'workout name', "nom de l'entrainement", 'nom de la seance', 'entrainement'),
    exercice: col(H, 'exercise name', "nom de l'exercice", 'exercice'),
    ordre: col(H, 'set order', 'ordre'),
    kg: col(H, 'weight', 'poids'),
    reps: col(H, 'reps', 'repetitions'),
    rpe: col(H, 'rpe'),
  };
  if (c.date < 0 || c.exercice < 0 || c.kg < 0 || c.reps < 0)
    throw new Error('Colonnes introuvables : est-ce bien l’export CSV de Strong ?');
  const lignes = [];
  for (const r of rows.slice(1)) {
    const kg = num(r[c.kg]), reps = num(r[c.reps]), date = String(r[c.date] ?? '').trim();
    if (kg == null || !reps || !versDate(date)) continue; // cardio (0 rep) et lignes vides ; 0 kg = poids du corps
    lignes.push({
      date, seance: c.seance >= 0 ? String(r[c.seance]).trim() : 'Séance', exercice: String(r[c.exercice]).trim(),
      kg, reps, rpe: c.rpe >= 0 ? num(r[c.rpe]) : null,
      echauffement: c.ordre >= 0 && String(r[c.ordre]).trim().toUpperCase() === 'W',
    });
  }
  return { lignes };
}

export const nomsExercicesStrong = lignes => [...new Set(lignes.map(l => l.exercice))].sort((a, b) => a.localeCompare(b));

export function correspondanceAuto(noms, state) {
  return Object.fromEntries(noms.map(n => [n, state.exercises.find(e => !e.archive && norm(e.nom) === norm(n))?.id ?? null]));
}

export function versWorkouts(lignes, correspondance, state) {
  const groupes = new Map();
  for (const l of lignes) {
    const cle = l.date + '|' + l.seance;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(l);
  }
  const existants = new Set(state.workouts.map(w => w.debut));
  const out = [];
  for (const ls of groupes.values()) {
    const debut = versDate(ls[0].date).toISOString();
    if (existants.has(debut)) continue;
    const entrees = [];
    for (const l of ls) {
      const id = correspondance[l.exercice];
      if (!id) continue;
      let e = entrees.find(x => x.exerciseId === id);
      if (!e) {
        e = { exerciseId: id, nomExercice: state.exercises.find(x => x.id === id).nom, supersetGroupe: null, note: '', series: [] };
        entrees.push(e);
      }
      e.series.push({ kg: l.kg, reps: l.reps, rir: l.rpe != null ? Math.max(0, 10 - l.rpe) : null, faite: true, echauffement: l.echauffement });
    }
    if (!entrees.length) continue;
    const t = state.templates.find(x => norm(x.nom) === norm(ls[0].seance));
    out.push({ id: 'strong-' + debut, templateId: t?.id ?? null, nom: ls[0].seance, debut, fin: debut, entrees });
  }
  return out;
}
