// Exercices : liste, création, fiche (conseil, graphiques, preuves, réglages).
import { conseil, sessionsDe, stagnation, prediction, verifierPrediction, e1rm } from '../moteur.js';
import { PROFILS, MUSCLES, NOM_MUSCLE, MATERIELS, defautsProfil } from '../profils.js';
import { supprimerExercice } from '../store.js';
import { lireNombre } from '../seance.js';
import { SOURCES } from '../seed.js';
import { courbe, barres } from '../graph.js';
import { esc, icon, fmtKg, fmtNum, fmtDate, ouvrirFeuille, fermerFeuille, confirmer, toast, champErreur, champDuree, lireDuree, valeurDuree } from '../ui.js';

export const liensSources = ids => ids.length ? `<div class="sources">Sources : ${ids.map(s =>
  `<a href="${esc(SOURCES[s].url)}" target="_blank" rel="noopener" title="${esc(SOURCES[s].titre)}">${s}</a>`).join(', ')}</div>` : '';

// Explication des prédictions, partagée avec l'onglet Analyse.
export const explicationPrediction = () => `<details class="explication"><summary>Comment c’est calculé ?</summary>
  <ul style="padding-left:18px">
    <li>Pour chaque séance, l’app estime ton 1RM (la charge que tu soulèverais une seule fois) avec la formule d’Epley : charge × (1 + reps / 30), seulement jusqu’à 12 reps. Au-delà, elle suit les reps à charge égale.</li>
    <li>Elle trace la droite qui passe au plus près de tes séances des 8 dernières semaines (au moins 4 séances), puis la prolonge.</li>
    <li>La <b>fourchette</b> (±, zone colorée) vient de tes propres données : plus tes séances s’écartent de la droite, plus elle est large, et elle s’élargit avec le temps.</li>
    <li>Une baisse n’est jamais prolongée : elle s’affiche comme une stagnation (0 kg/sem.).</li>
    <li>La <b>vérification</b> refait le calcul comme il y a 4 semaines et le compare à ta dernière séance : c’est ce qui te dit si tu peux te fier aux prédictions.</li>
  </ul>
  <p>Limite : la progression ralentit avec l’expérience. Un débutant gagne souvent 15 à 30 % sur son 1RM en 12 semaines, un pratiquant entraîné plutôt 2 à 6 % par an (chiffres de coachs, pas d’une méta-analyse). Au-delà de 4 semaines, prends la prédiction comme un ordre de grandeur.</p>
  ${liensSources(['S20'])}</details>`;

export function render(el, ctx, params) {
  const ex = params.id && ctx.state.exercises.find(e => e.id === params.id);
  if (ex) return fiche(el, ctx, ex);
  const liste = ctx.state.exercises.filter(e => !e.archive).sort((a, b) => a.nom.localeCompare(b.nom));
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Exercices</h1>
      <button class="btn btn-secondary btn-sm" data-act="nouveau">${icon('plus')}Nouvel exercice</button></div>
    <section class="card" style="padding:4px 8px"><ul class="liste">${liste.map(e => {
      const st = stagnation(e, sessionsDe(ctx.state, e.id));
      return `<li><a class="liste-ligne" href="#/exercices/${encodeURIComponent(e.id)}">
        <div style="min-width:0"><b>${esc(e.nom)}</b><div class="faint">${esc(NOM_MUSCLE[e.musclePrincipal])} · ${e.repMin}–${e.repMax} reps</div></div>
        ${st ? '<span class="badge warn">Stagne</span>' : ''}${icon('chevron', 'icone chevron')}</a></li>`;
    }).join('')}</ul></section>`;
  el.onclick = e => { if (e.target.closest('[data-act="nouveau"]')) creer(ctx); };
}

function creer(ctx) {
  const f = ouvrirFeuille({ titre: 'Nouvel exercice', corps: formulaire({
    nom: '', materiel: 'halteres', type: 'iso', musclePrincipal: 'pectoraux', musclesSecondaires: [] }, true),
    pied: '<button class="btn btn-texte" data-fermer>Annuler</button><button class="btn btn-primary" data-p="ok">Créer</button>' });
  brancherSeg(f);
  f.querySelector('[data-p="ok"]').onclick = () => {
    const v = lire(f);
    if (!v.nom) return champErreur(f.querySelector('#f-nom'), 'Donne un nom à l’exercice.');
    const id = v.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    const ex = { id, ...v, ...defautsProfil(v.type), series: 3, pasMateriel: MATERIELS[v.materiel].pas, parMain: v.materiel === 'halteres',
      increment: null, note: '', sources: [], archive: false };
    ctx.maj(s => ({ ...s, exercises: [...s.exercises, ex] }), { rendre: false });
    fermerFeuille(f); toast('Exercice créé.');
    ctx.aller('#/exercices/' + encodeURIComponent(id));
  };
}

const options = (obj, choisi, lib = x => x) => Object.keys(obj).map(k => `<option value="${k}" ${k === choisi ? 'selected' : ''}>${esc(lib(obj[k], k))}</option>`).join('');

function formulaire(ex, court = false) {
  return `
    <div class="form-group"><label for="f-nom">Nom</label><input id="f-nom" class="form-control" value="${esc(ex.nom)}" maxlength="60" autocomplete="off"></div>
    <div class="form-group"><div class="label">Type</div><div class="seg" role="group" aria-label="Type">${Object.entries(PROFILS).map(([k, p]) =>
      `<button type="button" data-type="${k}" aria-pressed="${k === ex.type}">${esc(p.nom.replace('Polyarticulaire', 'Poly.').replace(' du corps', ''))}</button>`).join('')}</div></div>
    <div class="form-row">
      <div class="form-group"><label for="f-mat">Matériel</label><select id="f-mat" class="form-control">${options(MATERIELS, ex.materiel, m => m.nom)}</select></div>
      <div class="form-group"><label for="f-muscle">Muscle principal</label><select id="f-muscle" class="form-control">${options(NOM_MUSCLE, ex.musclePrincipal)}</select></div>
    </div>
    <div class="form-group"><div class="label">Muscles secondaires (comptent pour moitié dans le volume)</div>
      <div class="form-row" style="gap:0 12px">${MUSCLES.map(m => `<label class="case"><input type="checkbox" data-sec="${m}" ${ex.musclesSecondaires.includes(m) ? 'checked' : ''}>${esc(NOM_MUSCLE[m])}</label>`).join('')}</div></div>
    ${court ? '' : `
    <div class="form-row">
      <div class="form-group"><label for="f-min">Reps min</label><input id="f-min" class="form-control" inputmode="numeric" value="${ex.repMin}"></div>
      <div class="form-group"><label for="f-max">Reps max</label><input id="f-max" class="form-control" inputmode="numeric" value="${ex.repMax}"></div>
      <div class="form-group"><label for="f-series">Séries</label><input id="f-series" class="form-control" inputmode="numeric" value="${ex.series}"></div>
      <div class="form-group"><label for="f-rir">RIR cible</label><input id="f-rir" class="form-control" value="${esc(ex.rirCible)}" maxlength="5"></div>
      <div class="form-group"><label for="f-pas">Pas du matériel (kg)</label><input id="f-pas" class="form-control" inputmode="decimal" value="${fmtKg(ex.pasMateriel)}"></div>
    </div>
    <div class="form-group"><label for="f-repos">Repos entre les séries <span class="faint">(min : s)</span></label>${champDuree('f-repos', ex.reposSec)}</div>
    <div class="form-group"><label for="f-inc">Incrément forcé (kg) <span class="faint">facultatif, sinon calculé</span></label>
      <input id="f-inc" class="form-control" inputmode="decimal" value="${fmtKg(ex.increment)}" placeholder="Automatique"></div>
    <label class="case"><input type="checkbox" id="f-main" ${ex.parMain ? 'checked' : ''}> Charge par main (haltères)</label>`}`;
}

function brancherSeg(racine) {
  racine.querySelector('.seg').onclick = e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    racine.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', x === b));
    const d = defautsProfil(b.dataset.type);
    const set = (id, v) => { const i = racine.querySelector(id); if (i) i.value = v; };
    set('#f-min', d.repMin); set('#f-max', d.repMax); set('#f-rir', d.rirCible);
    set('#f-repos', valeurDuree(d.reposSec));
  };
}

function lire(r) {
  const val = id => r.querySelector(id)?.value;
  const v = {
    nom: val('#f-nom').trim(), type: r.querySelector('[data-type][aria-pressed="true"]').dataset.type,
    materiel: val('#f-mat'), musclePrincipal: val('#f-muscle'),
    musclesSecondaires: [...r.querySelectorAll('[data-sec]:checked')].map(c => c.dataset.sec).filter(m => m !== val('#f-muscle')),
  };
  if (r.querySelector('#f-min')) Object.assign(v, {
    repMin: lireNombre(val('#f-min')), repMax: lireNombre(val('#f-max')), series: lireNombre(val('#f-series')),
    reposSec: lireDuree(r.querySelector('#f-repos')), rirCible: val('#f-rir').trim(), pasMateriel: lireNombre(val('#f-pas')),
    increment: lireNombre(val('#f-inc')), parMain: r.querySelector('#f-main').checked,
  });
  return v;
}

function fiche(el, ctx, ex) {
  const sessions = sessionsDe(ctx.state, ex.id);
  const c = conseil(ex, sessions), st = stagnation(ex, sessions), p = prediction(sessions);
  const e1 = sessions.map(s => ({ x: Date.parse(s.date), y: Math.max(...s.series.map(r => e1rm(r.kg, r.reps) ?? -Infinity)) })).filter(q => q.y > -Infinity);
  const derE1 = e1.at(-1)?.y, record = e1.length ? Math.max(...e1.map(q => q.y)) : null;
  const kgMax = sessions.length ? Math.max(...sessions.flatMap(s => s.series.map(r => r.kg))) : null;
  const fin = sessions.length ? Date.parse(sessions.at(-1).date) : 0, J = 864e5;
  // Au-delà de 12 reps le 1RM estimé n'est pas fiable (spec §6.5) : on trace alors la charge de travail.
  const parE1 = ex.repMax <= 12;
  const pts = parE1 ? e1 : sessions.map(s => ({ x: Date.parse(s.date), y: Math.max(...s.series.map(r => r.kg)) }));
  const avecPred = parE1 && p?.type === 'e1rm';
  const pred = avecPred ? [p.depuisJours, 0, 28].map(d => ({ x: fin + d * J, y: p.a(d) })) : [];
  const bande = avecPred ? [p.depuisJours, 0, 7, 14, 21, 28].map(d => ({ x: fin + d * J, lo: p.a(d) - p.marge(d), hi: p.a(d) + p.marge(d) })) : [];
  const v = verifierPrediction(sessions);

  el.innerHTML = `
    <a class="crumb" href="#/exercices">${icon('retour')} Exercices</a>
    <div class="page-header" style="margin-bottom:12px"><h1 class="page-title" style="font-size:24px;font-weight:400">${esc(ex.nom)}</h1></div>
    <div class="conseil ${c.action === 'augmenter' ? 'pos' : ''}"><b>Prochaine séance :</b> ${esc(c.texte)}${liensSources(c.sources)}</div>
    ${st ? `<div class="alert alert-warn"><b>Stagnation</b> : pas de progrès depuis ${st.depuis} séances (dernier progrès le ${fmtDate(st.dateRecord)}).
      Fais une séance à <b>${fmtKg(st.kgDecharge)} kg</b> (−5 à 10 %) puis remonte en double progression. Si ça revient, change de fourchette de reps ou de variante.
      Une semaine complète sans entraînement n’apporte rien pour le muscle.${liensSources(['S9'])}</div>` : ''}
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">1RM estimé</div><div class="kpi-value">${fmtNum(derE1)} <small>kg</small></div></div>
      <div class="kpi"><div class="kpi-label">Record 1RM estimé</div><div class="kpi-value">${fmtNum(record)} <small>kg</small></div></div>
      <div class="kpi"><div class="kpi-label">Charge max</div><div class="kpi-value">${fmtNum(kgMax)} <small>kg</small></div></div>
      <div class="kpi"><div class="kpi-label">Tendance <span class="badge">Indicatif</span></div><div class="kpi-value">${p ? `+${fmtNum(p.parSemaine)}` : '—'} <small>${p?.type === 'reps' ? 'rep/sem.' : 'kg/sem.'}</small></div></div>
    </div>
    ${p?.type === 'e1rm' ? `<p class="faint" style="margin-top:-6px">1RM estimé prévu : ${fmtNum(p.s4)} kg (± ${fmtNum(p.m4)}) à 4 sem. · ${fmtNum(p.s8)} kg (± ${fmtNum(p.m8)}) à 8 sem. · ${fmtNum(p.s12)} kg (± ${fmtNum(p.m12)}) à 12 sem., calculé sur ${p.n} séances.</p>`
      : p?.type === 'reps' ? `<p class="faint" style="margin-top:-6px">≈ ${fmtNum(p.s4, 0)} reps (± ${fmtNum(p.m4, 0)}) à ${fmtKg(p.kg)} kg dans 4 semaines (au-delà de 12 reps, le 1RM estimé n’est pas fiable).</p>`
      : `<p class="faint" style="margin-top:-6px">Prédiction disponible après 4 séances sur 8 semaines.</p>`}
    ${v ? `<div class="alert"><b>Vérification</b> : il y a ${Math.round(v.jours / 7)} semaines, l’app prévoyait ${fmtNum(v.prevu)} kg pour aujourd’hui ; tu es à ${fmtNum(v.reel)} kg
      (${v.ecart >= 0 ? '+' : '−'}${fmtNum(Math.abs(v.ecart))} kg, ${v.dansFourchette ? 'dans la fourchette' : 'hors de la fourchette'}).</div>` : ''}
    ${pts.length ? `<section class="card"><h2 class="card-title" style="margin-bottom:8px">${parE1 ? '1RM estimé' : 'Charge de travail'}</h2>${courbe(pts, { prediction: pred, bande, titre: parE1 ? '1RM estimé par séance' : 'Charge de travail par séance' })}
      <div class="legende"><span><i></i>Séances</span>${pred.length ? '<span><i class="pred"></i>Tendance, projetée à 4 semaines</span><span><i class="bande"></i>Fourchette probable</span>' : ''}</div>
      ${p ? explicationPrediction() : ''}</section>` : ''}
    ${sessions.length ? `<section class="card"><h2 class="card-title" style="margin-bottom:8px">Volume par séance</h2>${barres(sessions.map(s => ({ x: Date.parse(s.date), y: s.series.reduce((t, r) => t + r.kg * r.reps, 0) })), { titre: 'Volume par séance' })}
      <div class="legende"><span>kg × reps, séries de travail</span></div></section>` : ''}
    ${ex.note ? `<section class="card"><h2 class="card-title" style="margin-bottom:6px">Pourquoi cet exercice</h2><p style="margin:0;font-size:14px">${esc(ex.note)}</p>${liensSources(ex.sources)}</section>` : ''}
    ${sessions.length ? `<section class="card" style="padding:4px 8px"><ul class="liste">${[...sessions].reverse().slice(0, 12).map(s =>
      `<li class="liste-ligne" style="cursor:default"><span class="faint">${fmtDate(s.date)}</span><span>${s.series.map(r => `${fmtKg(r.kg)}×${r.reps}`).join('  ')}</span></li>`).join('')}</ul></section>` : ''}
    <h2 class="section-titre">Réglages</h2>
    <section class="card" data-form>${formulaire(ex)}
      <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-danger" data-act="suppr">Supprimer</button>
      <button class="btn btn-primary" style="flex:1" data-act="ok">Enregistrer</button></div></section>`;
  const form = el.querySelector('[data-form]');
  brancherSeg(form);
  el.onclick = async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'ok') {
      const v = lire(form);
      if (!v.nom) return champErreur(form.querySelector('#f-nom'), 'Donne un nom à l’exercice.');
      if (!(v.repMin > 0 && v.repMax >= v.repMin)) return champErreur(form.querySelector('#f-max'), 'Reps max doit être supérieur ou égal à reps min.');
      if (!(v.series >= 1)) return champErreur(form.querySelector('#f-series'), 'Au moins une série.');
      if (v.reposSec == null) return champErreur(form.querySelector('#f-repos'), 'Indique un temps de repos.');
      if (!(v.pasMateriel > 0)) return champErreur(form.querySelector('#f-pas'), 'Le pas du matériel doit être supérieur à 0.');
      ctx.maj(s => ({ ...s, exercises: s.exercises.map(x => x.id === ex.id ? { ...x, ...v } : x) }));
      toast('Exercice enregistré.');
    }
    if (a === 'suppr' && await confirmer(`« ${ex.nom} » sera retiré de ta liste. S’il a déjà servi, ton historique le garde.`, { titre: 'Supprimer l’exercice ?', ok: 'Supprimer', danger: true })) {
      ctx.maj(s => supprimerExercice(s, ex.id), { rendre: false });
      toast('Exercice supprimé.');
      ctx.aller('#/exercices');
    }
  };
}
