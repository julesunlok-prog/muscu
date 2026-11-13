// Séance en cours (spec §4.2) : l'écran le plus important. Une série conforme au conseil = un seul toucher (✓).
import { cocher, modifierSerie, lireNombre, precedent, ajouterSerie, supprimerSerie, basculerEchauffement, ajouterExercice,
  supprimerExerciceSeance, deplacerExercice, terminer, programmeDepuisSeance } from '../seance.js';
import { conseil, sessionsDe } from '../moteur.js';
import { esc, icon, fmtKg, fmtNum, fmtDuree, ouvrirFeuille, fermerFeuille, confirmer, toast, choixDuree, TIC, tic } from '../ui.js';

let horloge = null;

export function render(el, ctx) {
  const { state } = ctx, w = state.enCours;
  const E = Object.fromEntries(state.exercises.map(e => [e.id, e]));
  el.innerHTML = `
    <header class="seance-tete"><div><h1>${esc(w.nom)}</h1><div class="chrono" data-chrono></div></div>
      <button class="btn btn-primary btn-sm" data-act="terminer">Terminer</button></header>
    ${w.entrees.map((e, ei) => carte(state, E[e.exerciseId], e, ei)).join('')}
    <button class="ajouter" data-act="ajouter-ex" style="margin-bottom:12px">+ Exercice</button>
    <button class="btn btn-danger btn-bloc" data-act="annuler">Annuler la séance</button>`;

  clearInterval(horloge);
  const chrono = el.querySelector('[data-chrono]');
  const tic = () => { if (!chrono.isConnected) return clearInterval(horloge); chrono.textContent = fmtDuree(Date.now() - Date.parse(w.debut)); };
  tic(); horloge = setInterval(tic, 15000);

  // Saisie : on sauvegarde à chaque frappe sans réafficher, pour garder le clavier ouvert.
  el.oninput = e => {
    const i = e.target.closest('input[data-champ]');
    if (!i) return;
    const { ei, si, champ } = i.dataset;
    ctx.maj(s => ({ ...s, enCours: modifierSerie(s.enCours, +ei, +si, champ, lireNombre(i.value)) }), { rendre: false });
  };

  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const ei = +b.dataset.ei, si = +b.dataset.si, act = b.dataset.act;
    const majSeance = fn => ctx.maj(s => ({ ...s, enCours: fn(s.enCours, s) }));
    if (act === 'coche') {
      tic();
      const avant = ctx.state.enCours.entrees[ei].series[si];
      majSeance((w, s) => cocher(w, ei, si, s, new Date()));
      if (!avant.faite && !ctx.state.enCours.entrees[ei].series[si].faite) {
        toast('Indique la charge et les reps avant de cocher.', 'info');
        el.querySelector(`input[data-ei="${ei}"][data-si="${si}"][data-champ="${avant.kg > 0 ? 'reps' : 'kg'}"]`)?.focus();
      }
    }
    if (act === 'serie-plus') majSeance(w => ajouterSerie(w, ei));
    if (act === 'serie') menuSerie(ctx, ei, si);
    if (act === 'menu-ex') menuExercice(ctx, ei);
    if (act === 'ajouter-ex') choisirExercice(ctx);
    if (act === 'terminer') finir(ctx);
    if (act === 'annuler' && await confirmer('Les séries de cette séance ne seront pas enregistrées.', { titre: 'Annuler la séance ?', ok: 'Annuler la séance', danger: true })) {
      ctx.maj(s => ({ ...s, enCours: null }), { rendre: false });
      ctx.aller('#/programmes');
    }
  };
}

function carte(state, ex, e, ei) {
  const c = conseil(ex, sessionsDe(state, ex.id));
  let n = 0;
  return `<section class="card exo ${e.supersetGroupe ? 'superset' : ''}">
    <div class="card-tete" style="margin:0">
      <div style="min-width:0">${e.supersetGroupe ? `<div class="exo-groupe">Superset ${esc(e.supersetGroupe)}</div>` : ''}
        <h2 class="exo-nom"><a href="#/exercices/${encodeURIComponent(ex.id)}" style="color:inherit;text-decoration:none">${esc(e.nomExercice)}</a></h2>
        ${e.note ? `<div class="faint">${esc(e.note)}</div>` : ''}</div>
      <button class="btn btn-texte btn-sm btn-icone" data-act="menu-ex" data-ei="${ei}" aria-label="Options de ${esc(e.nomExercice)}">${icon('plusieurs')}</button>
    </div>
    <div class="conseil ${c.action === 'augmenter' ? 'pos' : c.action === 'decharger' ? 'warn' : ''}">${esc(c.texte)}</div>
    <table class="series"><thead><tr><th>Série</th><th>Précédent</th><th>kg</th><th>Reps</th>${e.afficherRir ? '<th>RIR</th>' : ''}<th><span class="hidden">Fait</span>${icon('check')}</th></tr></thead><tbody>
    ${e.series.map((s, si) => {
      const num = s.echauffement ? 'É' : ++n;
      const champ = (nom, mode) => `<input data-champ="${nom}" data-ei="${ei}" data-si="${si}" inputmode="${mode}" enterkeyhint="done" autocomplete="off"
        value="${s[nom] == null ? '' : fmtKg(s[nom])}" placeholder="${nom === 'rir' ? '–' : ''}" aria-label="${nom === 'kg' ? 'Charge' : nom === 'reps' ? 'Répétitions' : 'RIR'} série ${si + 1}">`;
      return `<tr class="${s.faite ? 'faite' : ''}">
        <td class="n ${s.echauffement ? 'echauf' : ''}"><button data-act="serie" data-ei="${ei}" data-si="${si}" aria-label="Options de la série ${si + 1}">${num}</button></td>
        <td class="prec">${esc(precedent(state, ex.id, si) ?? '—')}</td>
        <td>${champ('kg', 'decimal')}</td><td>${champ('reps', 'numeric')}</td>${e.afficherRir ? `<td>${champ('rir', 'numeric')}</td>` : ''}
        <td><button class="coche" data-act="coche" data-ei="${ei}" data-si="${si}" aria-pressed="${s.faite}" aria-label="Série ${si + 1} faite">${icon('check')}${TIC}</button></td></tr>`;
    }).join('')}</tbody></table>
    <div class="exo-actions"><button class="btn btn-secondary btn-sm" data-act="serie-plus" data-ei="${ei}">+ Série</button></div>
  </section>`;
}

function menuSerie(ctx, ei, si) {
  const s = ctx.state.enCours.entrees[ei].series[si];
  const f = ouvrirFeuille({ titre: `Série ${si + 1}`, corps: `
    <button class="btn btn-secondary btn-bloc" data-m="echauf" style="margin-bottom:8px">${s.echauffement ? 'Marquer comme série de travail' : 'Marquer comme échauffement'}</button>
    <button class="btn btn-danger btn-bloc" data-m="suppr">Supprimer la série</button>` });
  f.addEventListener('click', e => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    ctx.maj(st => ({ ...st, enCours: m === 'echauf' ? basculerEchauffement(st.enCours, ei, si) : supprimerSerie(st.enCours, ei, si) }));
    fermerFeuille(f);
  });
}

function menuExercice(ctx, ei) {
  const e = ctx.state.enCours.entrees[ei];
  const repos = ctx.state.exercises.find(x => x.id === e.exerciseId)?.reposSec ?? 90;
  const f = ouvrirFeuille({ titre: e.nomExercice, corps: `
    <div class="form-group"><label for="note-ex">Note</label><input id="note-ex" class="form-control" value="${esc(e.note)}" maxlength="120" placeholder="Réglage du siège, prise…"></div>
    <div class="form-group"><label for="repos-ex">Repos entre les séries</label>${choixDuree('repos-ex', repos)}</div>
    <label class="case"><input type="checkbox" id="rir-ex" ${e.afficherRir ? 'checked' : ''}> Afficher la colonne RIR (reps en réserve)</label>
    <div style="display:flex;gap:8px;margin:12px 0">
      <button class="btn btn-secondary" style="flex:1" data-m="haut">${icon('haut')}Monter</button>
      <button class="btn btn-secondary" style="flex:1" data-m="bas">${icon('bas')}Descendre</button></div>
    <button class="btn btn-danger btn-bloc" data-m="retirer">Retirer de la séance</button>`,
    pied: '<button class="btn btn-primary" data-m="ok">Enregistrer</button>' });
  f.addEventListener('click', ev => {
    const m = ev.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    ctx.maj(st => {
      let w = st.enCours;
      if (m === 'ok') w = { ...w, entrees: w.entrees.map((x, i) => i !== ei ? x : { ...x, note: f.querySelector('#note-ex').value.trim(), afficherRir: f.querySelector('#rir-ex').checked }) };
      if (m === 'haut' || m === 'bas') w = deplacerExercice(w, ei, m === 'haut' ? -1 : 1);
      if (m === 'retirer') w = supprimerExerciceSeance(w, ei);
      // Le repos est réglé sur l'exercice lui-même : il vaut pour les séances suivantes aussi.
      const exercises = m !== 'ok' ? st.exercises : st.exercises.map(x => x.id === e.exerciseId ? { ...x, reposSec: Number(f.querySelector('#repos-ex').value) } : x);
      return { ...st, exercises, enCours: w };
    });
    fermerFeuille(f);
  });
}

function choisirExercice(ctx) {
  const liste = ctx.state.exercises.filter(e => !e.archive).sort((a, b) => a.nom.localeCompare(b.nom));
  const f = ouvrirFeuille({ titre: 'Ajouter un exercice', corps: `<ul class="liste">${liste.map(e =>
    `<li><a class="liste-ligne" href="javascript:void 0" data-id="${esc(e.id)}"><b>${esc(e.nom)}</b>${icon('plus', 'icone chevron')}</a></li>`).join('')}</ul>
    <a class="btn btn-texte btn-bloc" href="#/exercices" data-fermer>Créer un exercice…</a>` });
  f.addEventListener('click', e => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    e.preventDefault();
    ctx.maj(s => ({ ...s, enCours: ajouterExercice(s.enCours, s, id) }));
    fermerFeuille(f);
    window.scrollTo({ top: document.body.scrollHeight });
  });
}

async function finir(ctx) {
  const w = ctx.state.enCours;
  const nonFaites = w.entrees.some(e => e.series.some(s => !s.faite));
  const r = terminer(ctx.state, new Date());
  if (!r.workout.entrees.length) {
    if (await confirmer('Aucune série n’est cochée : rien ne sera enregistré.', { titre: 'Abandonner la séance ?', ok: 'Abandonner', danger: true })) {
      ctx.maj(s => ({ ...s, enCours: null }), { rendre: false });
      ctx.aller('#/programmes');
    }
    return;
  }
  if (nonFaites && !await confirmer('Les séries non cochées ne seront pas enregistrées.', { titre: 'Terminer la séance ?', ok: 'Terminer' })) return;
  ctx.maj(s => ({ ...s, enCours: null, workouts: [...s.workouts, r.workout] }), { rendre: false });
  if (r.programmeModifie && await confirmer('Tu as changé le nombre de séries ou l’ordre des exercices pendant la séance.', { titre: 'Mettre à jour le programme ?', ok: 'Mettre à jour' }))
    ctx.maj(s => ({ ...s, templates: s.templates.map(t => t.id === w.templateId ? { ...t, items: programmeDepuisSeance(w) } : t) }), { rendre: false });
  ctx.aller('#/programmes');
  resume(r);
}

function resume({ workout, records }) {
  const series = workout.entrees.flatMap(e => e.series.filter(s => !s.echauffement));
  const volume = series.reduce((t, s) => t + s.kg * s.reps, 0);
  ouvrirFeuille({ titre: 'Séance terminée', corps: `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Durée</div><div class="kpi-value">${fmtDuree(Date.parse(workout.fin) - Date.parse(workout.debut))}</div></div>
      <div class="kpi"><div class="kpi-label">Séries</div><div class="kpi-value">${series.length}</div></div>
      <div class="kpi"><div class="kpi-label">Volume</div><div class="kpi-value">${fmtNum(volume, 0)} <small>kg</small></div></div>
      <div class="kpi"><div class="kpi-label">Records</div><div class="kpi-value">${records.length}</div></div>
    </div>
    ${records.length ? `<div class="label">Records battus</div><ul class="liste">${records.map(r =>
      `<li class="liste-ligne" style="cursor:default"><span>${esc(r.nom)}</span><span class="badge pos">${r.type === 'kg' ? 'Charge max' : '1RM estimé'}</span></li>`).join('')}</ul>` : ''}`,
    pied: '<button class="btn btn-primary" data-fermer>Fermer</button>' });
}
