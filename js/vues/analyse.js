// Analyse : bilan du mois, volume, progression de la force, prédictions expliquées, régularité, fréquence,
// équilibre poussée/tirage, zones de reps, proximité de l'échec (spec §4.5, §6).
import { volumeSemaine, volumePrevu, ciblesVolume, alerteEpaules, fatigue, stagnation, prediction, verifierPrediction, sessionsDe,
  volumeParSemaine, progressionMuscles, progressionExercicesMuscle, records, regularite, frequenceMuscles, equilibre,
  repartitionReps, repartitionRir, bilanMois, lundis } from '../moteur.js';
import { MUSCLES, NOM_MUSCLE } from '../profils.js';
import { liensSources, explicationPrediction } from './exercices.js';
import { barres, courbes, legende } from '../graph.js';
import { esc, icon, fmtNum, fmtKg, fmtDate } from '../ui.js';

let mode = 'semaine', muscleChoisi = null;
const signe = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n))}`;
const carte = (titre, contenu, extra = '') => `<section class="card"><div class="card-tete"><h2 class="card-title">${titre}</h2>${extra}</div>${contenu}</section>`;
const vide = texte => `<p class="muted" style="margin:0;font-size:14px">${texte}</p>`;

let reelDemo = false;
export function render(el, ctx) {
  const { state } = ctx, now = new Date();
  reelDemo = ctx.demo;
  const prio = state.settings.musclesPrioritaires;
  const ordre = [...MUSCLES.filter(m => prio.includes(m)), ...MUSCLES.filter(m => !prio.includes(m))];
  const cibles = ciblesVolume(state);
  muscleChoisi ??= ordre[0];
  const puces = `<div class="puces" role="group" aria-label="Muscle">${ordre.map(m =>
    `<button data-muscle="${m}" aria-pressed="${m === muscleChoisi}">${esc(NOM_MUSCLE[m])}</button>`).join('')}</div>`;

  el.innerHTML = `<div class="page-header"><h1 class="page-title">Analyse</h1></div>
    ${bilan(state, now)}
    ${alertes(state, now)}
    ${volume(state, ordre, cibles, prio)}
    ${carte('Volume par semaine', `${puces}${barres(volumeParSemaine(state, muscleChoisi, now, 12), { cible: cibles[muscleChoisi], titre: 'Séries par semaine' })}
      <div class="legende"><span>Séries de ${esc(NOM_MUSCLE[muscleChoisi])} par semaine, 12 semaines</span><span><i class="pred" style="border-color:var(--muted)"></i>Cible : ${cibles[muscleChoisi]}</span></div>`)}
    ${force(state, now, ordre)}
    ${predictions(state)}
    ${stagnations(state)}
    ${frise(state, now)}
    ${regu(state, now)}
    ${frequence(state, now, ordre)}
    ${balance(state, now)}
    ${zones(state, now)}
    ${rir(state, now)}`;

  el.onclick = e => {
    const b = e.target.closest('[data-mode], [data-muscle]');
    if (!b) return;
    if (b.dataset.mode) mode = b.dataset.mode;
    if (b.dataset.muscle) muscleChoisi = b.dataset.muscle;
    const y = window.scrollY; render(el, ctx); window.scrollTo(0, y);
  };
}

function bilan(state, now) {
  const b = bilanMois(state, now);
  if (!b.seances) return carte('Bilan du mois', `${vide('Aucune séance sur les 30 derniers jours.')}${!state.workouts.length && !reelDemo ? `
    <button class="btn btn-secondary btn-bloc" style="margin-top:12px" data-lancer-demo>Voir l’analyse avec la démo</button>` : ''}`);
  const cibles = ciblesVolume(state);
  return carte('Bilan du mois', `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Séances</div><div class="kpi-value">${b.seances}</div></div>
      <div class="kpi"><div class="kpi-label">Records</div><div class="kpi-value">${b.records}</div></div>
      <div class="kpi"><div class="kpi-label">Séries</div><div class="kpi-value">${b.series}</div></div>
      <div class="kpi"><div class="kpi-label">Force moyenne</div><div class="kpi-value">${b.progressionForce == null ? '—' : `${signe(b.progressionForce)} <small>%</small>`}</div></div>
    </div>
    <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6">
      ${b.retard ? `<li>Muscle le plus en retard : <b>${esc(NOM_MUSCLE[b.retard.muscle])}</b>, ${fmtNum(b.retard.ratio * cibles[b.retard.muscle])} séries par semaine pour une cible de ${cibles[b.retard.muscle]}. Ajoute-lui des séries.</li>` : ''}
      ${b.stagnations.length ? `<li>Stagnation sur ${b.stagnations.map(esc).join(', ')} : suis le conseil de décharge de chaque exercice.</li>` : '<li>Aucune stagnation.</li>'}
      <li>${fmtNum(b.volume, 0)} kg soulevés sur les 30 derniers jours.</li>
    </ul>`, '<span class="faint">30 derniers jours</span>');
}

function alertes(state, now) {
  const epaules = alerteEpaules(state), fat = fatigue(state, now);
  return `${epaules ? `<div class="alert alert-warn"><b>Épaules dominantes</b> : ton programme donne ${fmtNum(epaules.deltAnt)} séries de deltoïde antérieur pour ${fmtNum(epaules.pecs)} de pectoraux.
      Privilégie l’isolation des pecs et garde les développés inclinés vers 30°.${liensSources(['S11', 'S12'])}</div>` : ''}
    ${fat ? `<div class="alert alert-warn"><b>Fatigue</b> : performance en baisse cette semaine sur ${fat.exercices.map(esc).join(', ')}. Envisage une semaine à volume réduit.</div>` : ''}`;
}

function volume(state, ordre, cibles, prio) {
  const v = mode === 'semaine' ? volumeSemaine(state, new Date(Date.now() - 7 * 864e5).toISOString()) : volumePrevu(state);
  return carte('Séries par muscle', `
    <div class="seg" role="group" aria-label="Période" style="margin-bottom:16px">
      <button data-mode="semaine" aria-pressed="${mode === 'semaine'}">7 derniers jours</button>
      <button data-mode="prevu" aria-pressed="${mode === 'prevu'}">Programme prévu</button></div>
    ${ordre.map(m => {
      const c = cibles[m], max = Math.max(c * 1.5, v[m]), p = prio.includes(m);
      return `<div class="jauge"><div class="jauge-tete"><span>${esc(NOM_MUSCLE[m])} ${p ? '<span class="badge acc">PRIORITAIRE</span>' : ''}</span>
        <span class="${v[m] >= c ? '' : 'muted'}">${fmtNum(v[m])} / ${c}</span></div>
        <div class="jauge-rail"><div class="jauge-plein ${v[m] >= c ? 'pos' : p ? 'warn' : ''}" style="width:${v[m] / max * 100}%"></div>
        <div class="jauge-cible" style="left:${c / max * 100}%" title="Cible"></div></div></div>`;
    }).join('')}
    <p class="faint" style="margin:4px 0 0">Une série compte 1 pour le muscle principal et 0,5 pour chaque muscle secondaire. Cible : au moins 10 séries par semaine, 14 pour un muscle prioritaire ; au-delà, les gains continuent mais diminuent.</p>
    ${liensSources(['S4', 'S5'])}`);
}

function force(state, now, ordre) {
  const p = progressionMuscles(state, now);
  const lignes = ordre.filter(m => p[m] != null);
  const max = Math.max(5, ...lignes.map(m => Math.abs(p[m])));
  const ex = progressionExercicesMuscle(state, muscleChoisi, now);
  return carte('Progression de la force', `
    ${lignes.length ? `<div class="classement">${lignes.map(m => {
      const l = Math.abs(p[m]) / max * 50;
      return `<span>${esc(NOM_MUSCLE[m])}</span><div class="axe0"><div class="val ${p[m] < 0 ? 'neg' : ''}" style="${p[m] < 0 ? `right:50%` : `left:50%`};width:${l}%"></div></div>
        <span class="num ${p[m] < 0 ? '' : 'muted'}">${signe(p[m])} %</span>`;
    }).join('')}</div>` : vide('Il faut au moins 2 séances d’un exercice sur les 8 dernières semaines.')}
    <h3 class="label" style="margin:18px 0 8px">Exercices de ${esc(NOM_MUSCLE[muscleChoisi])} (base 100)</h3>
    ${ex.length ? `${courbes(ex, { reference: 100, titre: `Progression des exercices de ${NOM_MUSCLE[muscleChoisi]}` })}${legende(ex)}`
      : vide('Pas assez de séances pour ce muscle sur 8 semaines.')}
    <details class="explication"><summary>Comment lire la base 100 ?</summary>
      <p>Pour chaque séance, l’app calcule un indice de force sur ta meilleure série : charge × (1 + reps ÷ 30). Exemple : 30 kg × 8 → 38.</p>
      <p>La première séance des 8 dernières semaines vaut <b>100</b>, les suivantes sont comparées à elle : 32 kg × 8 → 40,5, soit 40,5 ÷ 38 × 100 = <b>106,6</b>, donc <b>+6,6 %</b>.</p>
      <p>Ça permet de mettre sur le même graphique un développé à 30 kg et un pec deck à 45 kg : au-dessus de 100 l’exercice progresse, à 100 il stagne, en dessous tu as perdu de la force.</p>
      <p>Le pourcentage d’un muscle, en haut, est la moyenne de ses exercices. C’est une tendance, pas ta vraie charge maximale. Le muscle se choisit dans la carte « Volume par semaine ».</p></details>`,
    '<span class="faint">8 semaines</span>');
}

function predictions(state) {
  const liste = state.exercises.filter(e => !e.archive).map(e => {
    const s = sessionsDe(state, e.id);
    return { e, p: prediction(s), v: verifierPrediction(s) };
  }).filter(x => x.p);
  return carte('Prédictions <span class="badge">INDICATIF</span>', `
    ${liste.length ? `<ul class="liste">${liste.map(({ e, p, v }) => `<li><a class="liste-ligne" href="#/exercices/${encodeURIComponent(e.id)}">
      <div style="min-width:0"><b>${esc(e.nom)}</b><div class="faint">${p.type === 'e1rm'
        ? `1RM estimé ${fmtNum(p.maintenant)} kg → ${fmtNum(p.s4)} kg (± ${fmtNum(p.m4)}) dans 4 semaines`
        : `${fmtNum(p.s4, 0)} reps (± ${fmtNum(p.m4, 0)}) à ${fmtKg(p.kg)} kg dans 4 semaines`}
        ${v ? `<br>Vérification : prévu ${fmtNum(v.prevu)} kg il y a ${Math.round(v.jours / 7)} sem., réel ${fmtNum(v.reel)} kg ${v.dansFourchette ? '<span class="badge pos">dans la fourchette</span>' : '<span class="badge warn">hors fourchette</span>'}` : ''}</div></div>
      <span class="badge ${p.parSemaine > 0 ? 'pos' : ''}" style="flex:none">${signe(p.parSemaine)}/sem.</span></a></li>`).join('')}</ul>`
      : vide('Il faut au moins 4 séances d’un exercice sur 8 semaines.')}
    ${explicationPrediction()}`);
}

function stagnations(state) {
  const stag = state.exercises.filter(e => !e.archive).map(e => ({ e, st: stagnation(e, sessionsDe(state, e.id)) })).filter(x => x.st);
  return carte('Stagnations', stag.length ? `<ul class="liste">${stag.map(({ e, st }) => `<li><a class="liste-ligne" href="#/exercices/${encodeURIComponent(e.id)}">
    <div><b>${esc(e.nom)}</b><div class="faint">Depuis ${st.depuis} séances · décharge à ${fmtKg(st.kgDecharge)} kg</div></div>${icon('chevron', 'icone chevron')}</a></li>`).join('')}</ul>`
    : vide('Aucune stagnation : tout progresse.'));
}

function frise(state, now) {
  const r = records(state);
  const semaines = lundis(now, 12).map(d => d.getTime()).map(x => ({ x, y: r.filter(e => Date.parse(e.date) >= x && Date.parse(e.date) < x + 7 * 864e5).length }));
  return carte('Records', r.length ? `${barres(semaines, { titre: 'Records par semaine' })}
    <div class="legende"><span>Records battus par semaine, 12 semaines</span></div>
    <ul class="liste" style="margin-top:8px">${r.slice(-5).reverse().map(x => `<li class="liste-ligne" style="cursor:default">
      <span>${esc(x.nom)}</span><span class="faint">${fmtDate(x.date)}</span></li>`).join('')}</ul>`
    : vide('Aucun record pour l’instant : il faut au moins 2 séances d’un exercice.'));
}

function regu(state, now) {
  const r = regularite(state, now);
  return carte('Régularité', `${barres(r.semaines, { cible: r.prevu, titre: 'Séances par semaine' })}
    <div class="legende"><span>Jours d’entraînement par semaine</span><span><i class="pred" style="border-color:var(--muted)"></i>Prévu : ${r.prevu}</span></div>
    <p style="margin:10px 0 0;font-size:14px">${r.serie ? `<b>${r.serie} semaine${r.serie > 1 ? 's' : ''} complète${r.serie > 1 ? 's' : ''}</b> d’affilée.` : 'La semaine dernière n’était pas complète.'}
      S’entraîner régulièrement est ce qui compte le plus.</p>${liensSources(['S19'])}`, '<span class="faint">8 semaines</span>');
}

function frequence(state, now, ordre) {
  const f = frequenceMuscles(state, now);
  const lignes = ordre.filter(m => f[m].prevu > 0 || f[m].reel > 0);
  return carte('Fréquence par muscle', `${lignes.length ? `<ul class="liste">${lignes.map(m => `<li class="liste-ligne" style="cursor:default">
      <span>${esc(NOM_MUSCLE[m])}</span><span>${f[m].prevu < 2 ? '<span class="badge warn">1×/sem.</span> ' : ''}<span class="faint">prévu ${f[m].prevu}×, fait ${fmtNum(f[m].reel)}×/sem.</span></span></li>`).join('')}</ul>` : vide('Aucun programme.')}
    <p class="faint" style="margin:8px 0 0">Travailler chaque muscle au moins 2 fois par semaine est recommandé. À volume égal, la fréquence change peu la prise de muscle, mais aide la force : tes séances Upper / Lower permettront de passer à 2×.</p>
    ${liensSources(['S18', 'S5'])}`, '<span class="faint">4 semaines</span>');
}

function balance(state, now) {
  const prevu = equilibre(volumePrevu(state));
  const moy = {}; // moyenne hebdomadaire réelle des 4 dernières semaines
  lundis(now, 4).forEach(d => Object.entries(volumeSemaine(state, d.toISOString())).forEach(([m, v]) => { moy[m] = (moy[m] ?? 0) + v / 4; }));
  const reel = equilibre(moy);
  const ligne = (nom, e) => `<li class="liste-ligne" style="cursor:default"><span>${nom}</span><span>${e.ratio == null ? '—' : `<b>${fmtNum(e.ratio)}</b> <span class="faint">(${fmtNum(e.tirage)} tirage / ${fmtNum(e.poussee)} poussée)</span>`}</span></li>`;
  return carte('Équilibre tirage / poussée <span class="badge">REPÈRE</span>', `<ul class="liste">${ligne('Programme', prevu)}${ligne('Réel, 4 semaines', reel)}</ul>
    <p class="faint" style="margin:8px 0 0">Séries de tirage (dos, deltoïde postérieur, biceps) divisées par séries de poussée (pectoraux, deltoïde antérieur, triceps). Les coachs conseillent entre 1 et 2, surtout avec des épaules dominantes. <b>Aucune étude ne valide un ratio précis</b> : prends-le comme un repère.</p>
    ${liensSources(['S21'])}`);
}

function empile(parts) {
  const total = parts.reduce((t, p) => t + p.n, 0) || 1;
  return `<div class="empile">${parts.map(p => `<span style="width:${p.n / total * 100}%;background:var(${p.c})" title="${esc(p.nom)}"></span>`).join('')}</div>
    <div class="cles">${parts.map(p => `<span><i style="background:var(${p.c})"></i>${esc(p.nom)} : ${p.n} (${Math.round(p.n / total * 100)} %)</span>`).join('')}</div>`;
}

function zones(state, now) {
  const z = repartitionReps(state, now);
  return carte('Zones de répétitions', z.total ? `${empile([{ nom: 'Lourd (≤ 8)', n: z.lourd, c: '--dv-1' }, { nom: 'Moyen (9–15)', n: z.moyen, c: '--dv-2' }, { nom: 'Léger (> 15)', n: z.leger, c: '--dv-3' }])}
    <p class="faint" style="margin:8px 0 0">Le muscle grossit autant en lourd qu’en léger si tu vas près de l’échec. La force, elle, progresse mieux avec des séries lourdes : garde-en sur tes polyarticulaires.</p>${liensSources(['S7'])}`
    : vide('Aucune série sur les 4 dernières semaines.'), '<span class="faint">4 semaines</span>');
}

function rir(state, now) {
  const r = repartitionRir(state, now);
  return carte('Proximité de l’échec (RIR)', r.total ? `${empile([0, 1, 2, 3, 4].map((k, i) => ({ nom: k === 4 ? '4+ RIR' : `${k} RIR`, n: r.parRir[k], c: `--dv-${i + 1}` })))}
    <p class="faint" style="margin:8px 0 0">${r.total} séries avec RIR, ${r.sansRir} sans. La prise de muscle augmente quand on finit plus près de l’échec (0 à 2 reps en réserve) ; la force y est peu sensible.</p>${liensSources(['S6'])}`
    : vide('Pour activer cette section, affiche la colonne RIR en séance (menu ⋯ d’un exercice) et note combien de reps tu aurais encore pu faire.'), '<span class="faint">4 semaines</span>');
}
