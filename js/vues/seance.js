// Séance en cours (spec §4.2) : l'écran le plus important. Une série conforme au conseil = un seul toucher (✓).
// Repos affiché entre les séries (trait « 2:30 » qu'on touche pour changer le temps, barre qui se vide après avoir coché),
// minuteur dans l'en-tête, poignée pour réduire la séance, écran « Bravo » à la fin.
import { cocher, modifierSerie, lireNombre, precedent, ajouterSerie, supprimerSerie, basculerEchauffement, ajouterExercice,
  supprimerExerciceSeance, deplacerExercice, terminer, programmeDepuisSeance, cocherRestantes, resteRepos, ajusterRepos, passerRepos,
  pauserRepos, reprendreRepos, recommencerRepos, lancerRepos } from '../seance.js';
import { conseil, sessionsDe, e1rm } from '../moteur.js';
import { esc, icon, fmtKg, fmtNum, fmtDuree, fmtChrono, fmtDateLongue, ouvrirFeuille, fermerFeuille, confirmer, choisir, toast,
  champDuree, lireDuree, valeurDuree } from '../ui.js';

let horloge = null, vientDeCocher = null, geste = null, sansClicJusqua = 0;
const fmtEcoule = s => s < 3600 ? fmtChrono(s) : `${Math.floor(s / 3600)}:${fmtChrono(s % 3600).padStart(5, '0')}`;

export function render(el, ctx) {
  const { state } = ctx, w = state.enCours;
  const E = Object.fromEntries(state.exercises.map(e => [e.id, e]));
  const reste = resteRepos(w);
  el.style.transform = '';
  el.innerHTML = `
    <header class="seance-tete" data-tete>
      <button class="poignee" data-act="reduire" aria-label="Réduire la séance"><span></span></button>
      <div class="seance-barre">
        <button class="repos-pilule ${w.repos ? 'actif' : ''} ${w.repos?.pause != null ? 'pause' : ''}" data-act="repos" data-repos-on aria-label="Minuteur de repos">
          ${icon('chrono')}<span data-repos-temps>${w.repos ? fmtChrono(reste) : ''}</span></button>
        <span class="chrono" data-chrono aria-label="Durée de la séance"></span>
        <button class="btn btn-primary btn-sm" data-act="terminer">Terminer</button>
      </div>
    </header>
    <h1 class="seance-titre">${esc(w.nom)}</h1>
    <div class="faint seance-date">${esc(fmtDateLongue(w.debut))}</div>
    ${w.entrees.map((e, ei) => carte(state, E[e.exerciseId], e, ei)).join('')}
    <button class="ajouter" data-act="ajouter-ex" style="margin-bottom:12px">+ Exercice</button>
    <button class="btn btn-danger btn-bloc" data-act="annuler">Annuler la séance</button>`;
  vientDeCocher = null;

  clearInterval(horloge);
  const chrono = el.querySelector('[data-chrono]');
  const majChrono = () => { if (!chrono.isConnected) return clearInterval(horloge); chrono.textContent = fmtEcoule(Math.floor((Date.now() - Date.parse(w.debut)) / 1000)); };
  majChrono(); horloge = setInterval(majChrono, 1000);

  glisserPourReduire(el, ctx);
  glisserPourSupprimer(el, ctx);

  // Saisie : on sauvegarde à chaque frappe sans réafficher, pour garder le clavier ouvert.
  // Le trait de repos cache un champ « heure » (roulette iOS) : on ne réaffiche pas non plus, sinon la roulette se fermerait.
  el.oninput = el.onchange = e => {
    const i = e.target.closest('input[data-champ]');
    if (i) {
      const { ei, si, champ } = i.dataset;
      return ctx.maj(s => ({ ...s, enCours: modifierSerie(s.enCours, +ei, +si, champ, lireNombre(i.value)) }), { rendre: false });
    }
    const t = e.target.closest('input[data-repos-ex]');
    const r = t && lireDuree(t);
    if (r == null) return;
    const id = ctx.state.enCours.entrees[+t.dataset.reposEx].exerciseId;
    ctx.maj(s => ({ ...s, exercises: s.exercises.map(x => x.id === id ? { ...x, reposSec: r } : x) }), { rendre: false });
    el.querySelectorAll(`[data-repos-txt="${t.dataset.reposEx}"]`).forEach(x => { x.textContent = fmtChrono(r); });
    el.querySelectorAll(`input[data-repos-ex="${t.dataset.reposEx}"]`).forEach(x => { if (x !== t) x.value = valeurDuree(r); });
  };

  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b || Date.now() < sansClicJusqua) return; // pas de clic à la fin d'un glisser
    const ei = +b.dataset.ei, si = +b.dataset.si, act = b.dataset.act;
    const majSeance = fn => ctx.maj(s => ({ ...s, enCours: fn(s.enCours, s) }));
    if (act === 'coche') {
      const avant = ctx.state.enCours.entrees[ei].series[si];
      vientDeCocher = `${ei}-${si}`;
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
    if (act === 'repos') menuRepos(ctx);
    if (act === 'reduire') reduire(el, ctx);
    if (act === 'terminer') finir(ctx);
    if (act === 'annuler' && await confirmer('Les séries de cette séance ne seront pas enregistrées.', { titre: 'Annuler la séance ?', ok: 'Annuler la séance', danger: true })) {
      ctx.maj(s => ({ ...s, enCours: null }), { rendre: false });
      ctx.aller('#/programmes');
    }
  };
}

// Glisser une série vers la gauche : fond rouge avec corbeille ; au-delà de 40 % de la largeur, la série est supprimée.
// Le sens se décide après 8 px : vertical, on laisse la page défiler ; horizontal, on suit le doigt.
function glisserPourSupprimer(el, ctx) {
  const cellules = (tr, x, anime) => tr.querySelectorAll('td').forEach(td => {
    td.style.transition = anime ? 'transform .2s var(--out)' : ''; td.style.transform = x ? `translateX(${x}px)` : '';
  });
  el.onpointerdown = e => {
    const tr = e.target.closest('tr[data-serie]');
    geste = tr && e.button < 1 ? { tr, x0: e.clientX, y0: e.clientY, dx: 0, sens: null, id: e.pointerId } : null;
  };
  el.onpointermove = e => {
    const g = geste;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.sens) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.sens = dx < 0 && Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (g.sens === 'v') { geste = null; return; }
      g.tr.classList.add('glisse');
      document.activeElement?.blur?.();
    }
    g.dx = Math.min(0, dx);
    cellules(g.tr, g.dx, false);
  };
  el.onpointerup = el.onpointercancel = e => {
    const g = geste;
    geste = null;
    if (!g?.sens) return;
    sansClicJusqua = Date.now() + 400;
    const largeur = g.tr.offsetWidth;
    if (e.type === 'pointerup' && g.dx < -largeur * 0.4) {
      cellules(g.tr, -largeur, true);
      const { ei, si } = g.tr.dataset;
      return setTimeout(() => ctx.maj(s => ({ ...s, enCours: supprimerSerie(s.enCours, +ei, +si) })), 200);
    }
    cellules(g.tr, 0, true);
    setTimeout(() => g.tr.classList.remove('glisse'), 200);
  };
  if (!el.dataset.glisseBranche) { // #vue est réutilisé à chaque affichage : un seul écouteur
    el.dataset.glisseBranche = '1';
    el.addEventListener('touchmove', e => { if (geste?.sens === 'h' && geste.tr.isConnected) e.preventDefault(); }, { passive: false }); // Safari ne fait pas défiler pendant le glisser
  }
}

// Poignée : glisser l'en-tête vers le bas (ou toucher la poignée) réduit la séance ; elle continue, « Reprendre » la rouvre.
function glisserPourReduire(el, ctx) {
  const tete = el.querySelector('[data-tete]');
  tete.addEventListener('touchmove', e => e.preventDefault(), { passive: false }); // sinon Safari fait défiler la page
  tete.onpointerdown = e => {
    if (e.target.closest('button:not(.poignee)')) return;
    const y0 = e.clientY;
    let dy = 0;
    try { tete.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    tete.onpointermove = m => { dy = Math.max(0, m.clientY - y0); el.style.transform = dy ? `translateY(${dy}px)` : ''; };
    tete.onpointerup = tete.onpointercancel = () => {
      tete.onpointermove = tete.onpointerup = tete.onpointercancel = null;
      if (dy > 90) return reduire(el, ctx);
      if (!dy) return;
      el.classList.add('revient'); el.style.transform = '';
      setTimeout(() => el.classList.remove('revient'), 260);
    };
  };
}

function reduire(el, ctx) {
  if (el.classList.contains('reduit')) return;
  el.style.animation = ''; // l'animation en ligne « none » (réaffichage) masquerait celle de la classe
  el.classList.add('reduit');
  const fin = () => { if (!el.classList.contains('reduit')) return; el.classList.remove('reduit'); el.style.transform = ''; ctx.aller('#/programmes'); };
  el.addEventListener('animationend', fin, { once: true });
  setTimeout(fin, 400); // si les animations sont coupées (réglage « réduire les animations »)
}

function carte(state, ex, e, ei) {
  const c = conseil(ex, sessionsDe(state, ex.id)), w = state.enCours, repos = ex.reposSec ?? 90;
  const cols = e.afficherRir ? 6 : 5, reste = resteRepos(w);
  let n = 0;
  // Trait de repos sous chaque série ; sous la série qui a lancé le repos, la barre de décompte.
  const ligneRepos = si => {
    const actif = w.repos && w.repos.ei === ei && w.repos.si === si;
    const arrive = actif && w.repos.pause == null && Date.now() - (w.repos.fin - w.repos.duree * 1000) < 1000;
    return `<tr class="ligne-repos ${actif ? 'actif' : ''}" ${actif ? 'data-repos-on' : ''}><td colspan="${cols}">
      <div class="repos-trait"><span data-repos-txt="${ei}">${fmtChrono(repos)}</span>
        <input type="time" class="repos-choix" data-repos-ex="${ei}" value="${valeurDuree(repos)}" aria-label="Repos de ${esc(e.nomExercice)} (minutes : secondes)"></div>
      ${actif ? `<button class="repos-actif ${arrive ? 'arrive' : ''}" data-act="repos" aria-label="Repos en cours : ouvrir le minuteur">
        <span class="repos-reste" data-repos-rail style="width:${Math.min(100, reste / w.repos.duree * 100)}%"></span>
        <span class="repos-chiffre" data-repos-temps>${fmtChrono(reste)}</span></button>` : ''}</td></tr>`;
  };
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
      return `<tr data-serie data-ei="${ei}" data-si="${si}" class="${s.faite ? 'faite' : ''} ${s.faite && vientDeCocher === `${ei}-${si}` ? 'vient' : ''}">
        <td class="n ${s.echauffement ? 'echauf' : ''}"><button data-act="serie" data-ei="${ei}" data-si="${si}" aria-label="Options de la série ${si + 1}">${num}</button></td>
        <td class="prec">${esc(precedent(state, ex.id, si) ?? '—')}</td>
        <td>${champ('kg', 'decimal')}</td><td>${champ('reps', 'numeric')}</td>${e.afficherRir ? `<td>${champ('rir', 'numeric')}</td>` : ''}
        <td><button class="coche" data-act="coche" data-ei="${ei}" data-si="${si}" aria-pressed="${s.faite}" aria-label="Série ${si + 1} faite">${icon('check')}</button></td></tr>
        ${ligneRepos(si)}`;
    }).join('')}</tbody></table>
    <div class="exo-actions"><button class="btn btn-secondary btn-sm" data-act="serie-plus" data-ei="${ei}"><span>+ Série (<span data-repos-txt="${ei}">${fmtChrono(repos)}</span>)</span></button></div>
  </section>`;
}

// Panneau du minuteur : réglages du repos en cours, ou lancement d'un repos à la main.
function menuRepos(ctx) {
  const w = ctx.state.enCours;
  if (!w.repos) {
    const f = ouvrirFeuille({ titre: 'Minuteur', corps: `<p class="faint" style="margin-top:0">Lance un repos sans cocher de série.</p>
      <div class="repos-grille">${[60, 90, 120, 150, 180, 240].map(s => `<button class="btn btn-secondary" data-lancer="${s}">${fmtChrono(s)}</button>`).join('')}</div>` });
    f.addEventListener('click', e => {
      const s = e.target.closest('[data-lancer]')?.dataset.lancer;
      if (!s) return;
      ctx.maj(st => ({ ...st, enCours: lancerRepos(st.enCours, +s, new Date()) }));
      fermerFeuille(f);
    });
    return;
  }
  const libPause = () => ctx.state.enCours?.repos?.pause != null ? 'Reprendre' : 'Pause';
  const f = ouvrirFeuille({ titre: 'Repos', corps: `
    <div class="repos-grand" data-repos-temps>${fmtChrono(resteRepos(w))}</div>
    <div class="repos-grille">
      <button class="btn btn-secondary" data-r="-15">−15 s</button><button class="btn btn-secondary" data-r="15">+15 s</button>
      <button class="btn btn-secondary" data-r="pause"><span>${libPause()}</span></button><button class="btn btn-secondary" data-r="recommencer">Recommencer</button>
    </div>`, pied: '<button class="btn btn-primary" data-r="passer">Passer le repos</button>' });
  f.dataset.reposFeuille = '';
  f.addEventListener('click', e => {
    const a = e.target.closest('[data-r]')?.dataset.r;
    if (!a) return;
    const now = new Date();
    const fn = { '-15': w => ajusterRepos(w, -15), 15: w => ajusterRepos(w, 15), recommencer: w => recommencerRepos(w, now), passer: passerRepos,
      pause: w => w.repos?.pause != null ? reprendreRepos(w, now) : pauserRepos(w, now) }[a];
    ctx.maj(st => ({ ...st, enCours: fn(st.enCours) }), { rendre: a === 'passer' });
    if (a === 'passer') return fermerFeuille(f);
    f.querySelector('[data-r="pause"] span').textContent = libPause();
  });
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
    <div class="form-group"><label for="repos-ex">Repos entre les séries <span class="faint">(min : s)</span></label>${champDuree('repos-ex', repos)}</div>
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
      const r = m === 'ok' ? lireDuree(f.querySelector('#repos-ex')) : null; // champ vidé : on garde l'ancien repos
      const exercises = r == null ? st.exercises : st.exercises.map(x => x.id === e.exerciseId ? { ...x, reposSec: r } : x);
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
  if (w.entrees.some(e => e.series.some(s => !s.faite))) {
    const c = await choisir('Certaines séries ne sont pas cochées. Une série vide n’est jamais enregistrée.', { titre: 'Terminer la séance ?', choix: [
      ['valider', 'Valider les séries remplies', 'btn-primary'], ['ignorer', 'Ignorer les séries non cochées', 'btn-danger'], ['annuler', 'Continuer la séance', 'btn-texte']] });
    if (!c || c === 'annuler') return;
    if (c === 'valider') ctx.maj(s => ({ ...s, enCours: cocherRestantes(s.enCours, s) }), { rendre: false });
  }
  const r = terminer(ctx.state, new Date());
  if (!r.workout.entrees.length) {
    if (await confirmer('Aucune série n’est cochée : rien ne sera enregistré.', { titre: 'Abandonner la séance ?', ok: 'Abandonner', danger: true })) {
      ctx.maj(s => ({ ...s, enCours: null }), { rendre: false });
      ctx.aller('#/programmes');
    }
    return;
  }
  ctx.maj(s => ({ ...s, enCours: null, workouts: [...s.workouts, r.workout] }), { rendre: false });
  if (r.programmeModifie && await confirmer('Tu as changé le nombre de séries ou l’ordre des exercices pendant la séance.', { titre: 'Mettre à jour le programme ?', ok: 'Mettre à jour' }))
    ctx.maj(s => ({ ...s, templates: s.templates.map(t => t.id === w.templateId ? { ...t, items: programmeDepuisSeance(w) } : t) }), { rendre: false });
  ctx.aller('#/programmes');
  bravo(r, ctx.state.workouts.length);
}

// Écran de fin : étoiles, confettis et résumé (meilleure série de chaque exercice).
function bravo({ workout, records }, n) {
  const travail = e => e.series.filter(s => !s.echauffement);
  const volume = workout.entrees.flatMap(travail).reduce((t, s) => t + s.kg * s.reps, 0);
  const meilleure = e => travail(e).reduce((m, s) => (e1rm(s.kg, s.reps) ?? s.kg) > (e1rm(m.kg, m.reps) ?? m.kg) ? s : m, travail(e)[0] ?? e.series[0]);
  const o = document.createElement('div');
  o.className = 'bravo'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Séance terminée');
  o.innerHTML = `<div class="confettis" aria-hidden="true">${Array.from({ length: 40 }, (_, i) =>
      `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 1.2).toFixed(2)}s;--t:${(2.4 + Math.random() * 1.8).toFixed(2)}s;--r:${Math.round(360 + Math.random() * 540)}deg;--c:var(--dv-${1 + i % 5})"></i>`).join('')}</div>
    <button class="fermer" data-fermer aria-label="Fermer">${icon('close')}</button>
    <div class="etoiles" aria-hidden="true"><span>★</span><span>★</span><span>★</span></div>
    <h2>Bravo !</h2><p class="muted">C’est ta ${n === 1 ? '1re' : `${n}e`} séance.</p>
    <section class="card bravo-carte">
      <h3 class="card-title">${esc(workout.nom)}</h3><div class="faint">${esc(fmtDateLongue(workout.debut))}</div>
      <div class="bravo-kpis"><span>${icon('chrono')}${fmtDuree(Date.parse(workout.fin) - Date.parse(workout.debut))}</span>
        <span>${icon('haltere')}${fmtNum(volume, 0)} kg</span><span>${icon('graphique')}${records.length} record${records.length > 1 ? 's' : ''}</span></div>
      <table class="bravo-table"><thead><tr><th>Exercice</th><th>Meilleure série</th></tr></thead><tbody>
        ${workout.entrees.map(e => { const m = meilleure(e); return `<tr><td>${travail(e).length || e.series.length} × ${esc(e.nomExercice)}</td>
          <td>${fmtKg(m.kg)} kg × ${m.reps}${records.some(r => r.nom === e.nomExercice) ? ' <span class="badge pos">Record</span>' : ''}</td></tr>`; }).join('')}
      </tbody></table>
    </section>
    <button class="btn btn-primary btn-bloc bravo-ok" data-fermer>Continuer</button>`;
  const fermer = () => { o.classList.add('sort'); setTimeout(() => o.remove(), 200); document.removeEventListener('keydown', clavier); };
  const clavier = e => { if (e.key === 'Escape') fermer(); };
  o.onclick = e => { if (e.target.closest('[data-fermer]')) fermer(); };
  document.addEventListener('keydown', clavier);
  document.body.appendChild(o);
  o.querySelector('.bravo-ok').focus();
}
