// Écran Entraînement : programmes, « Débuter », séance vide, édition d'un programme.
import { demarrer } from '../seance.js';
import { NOM_MUSCLE } from '../profils.js';
import { choisirDansBibliotheque } from './exercices.js';
import { ordreActuel, cycles } from '../semaine.js';
import { esc, icon, fmtDate, fmtChrono, ouvrirFeuille, fermerFeuille, confirmer, toast, champErreur } from '../ui.js';

const derniere = (state, id) => state.workouts.filter(w => w.templateId === id).map(w => w.debut).sort().at(-1);

// Résumé d'un programme : muscles principaux sans doublon (les trois deltoïdes deviennent « épaules »), puis exercices et séries.
export function resume(t, E) {
  const muscles = [...new Set(t.items.map(i => E[i.exerciseId]?.musclePrincipal).filter(Boolean)
    .map(m => m.startsWith('delt_') ? 'Épaules' : NOM_MUSCLE[m]))];
  const series = t.items.reduce((n, i) => n + (i.series ?? 0), 0);
  return { muscles: muscles.map((m, k) => k ? m.toLowerCase() : m).join(', '),
    detail: `${t.items.length} exercice${t.items.length > 1 ? 's' : ''} · ${series} séries` };
}

export function render(el, ctx) {
  const { state } = ctx;
  const E = Object.fromEntries(state.exercises.map(e => [e.id, e]));
  // Prochaine séance : celle du cycle si une semaine type existe, sinon le programme fait il y a le plus longtemps
  // (jamais fait en premier). Seul lui a le bouton plein.
  const cycle = cycles(state).courant;
  const prochain = cycle ? cycle.cases[cycle.prochaine]?.templateId
    : [...state.templates].sort((a, b) => (derniere(state, a.id) ?? '').localeCompare(derniere(state, b.id) ?? ''))[0]?.id;
  el.innerHTML = `
    <div class="page-header"><h1 class="page-title">Entraînement</h1>
      <button class="btn btn-secondary btn-sm" data-act="nouveau">${icon('plus')}Programme</button></div>
    ${state.enCours ? `<div class="alert"><b>${esc(state.enCours.nom)}</b> est en cours.
      <div style="margin-top:8px"><button class="btn btn-primary btn-sm" data-act="reprendre">Reprendre la séance</button></div></div>` : ''}
    ${!ctx.demo && !state.workouts.length && !state.enCours ? `<section class="card"><h2 class="card-title" style="margin-bottom:6px">Découvre l’app</h2>
      <p class="muted" style="margin:0 0 12px;font-size:14px">Lance la démo pour voir 12 semaines de séances fictives, les conseils de charge et toutes les analyses. Tes données ne sont pas touchées.</p>
      <button class="btn btn-secondary btn-bloc" data-lancer-demo>Voir la démo</button></section>` : ''}
    ${carteSemaine(state, cycle, E)}
    ${state.templates.length ? state.templates.map(t => {
      const d = derniere(state, t.id), suivant = t.id === prochain && !state.enCours, r = resume(t, E);
      return `<section class="card programme" data-act="apercu" data-id="${esc(t.id)}">
        <div class="card-tete"><div><h2 class="card-title">${esc(t.nom)}</h2>
          <div class="faint">${suivant ? '<b class="suivant">Prochaine séance</b> · ' : ''}${d ? `Dernière : ${fmtDate(d)}` : 'Jamais fait'}</div></div>
          <button class="btn btn-texte btn-sm btn-icone" data-act="editer" data-id="${esc(t.id)}" aria-label="Modifier ${esc(t.nom)}">${icon('plusieurs')}</button></div>
        <p style="font-size:15px;margin:0 0 14px">${esc(r.muscles || 'Aucun exercice')}<span class="faint" style="display:block;margin-top:2px">${r.detail}</span></p>
        <button class="btn ${suivant ? 'btn-primary' : 'btn-secondary'} btn-bloc" data-act="debuter" data-id="${esc(t.id)}">Débuter</button>
      </section>`;
    }).join('') : `<div class="empty-state"><div class="empty-title">Aucun programme</div><div class="empty-sub">Crée ton premier programme pour débuter une séance.</div></div>`}
    <button class="btn btn-texte btn-bloc" data-act="vide">Séance vide</button>`;

  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, id } = b.dataset;
    if (act === 'reprendre') return ctx.ouvrirSeance();
    if (act === 'semaine') return editerSemaine(ctx);
    if (act === 'passer') return passer(ctx, id);
    if (act === 'vide') return debuter(ctx, null);
    // « Débuter » passe par l'aperçu du programme, comme toucher la carte.
    if (act === 'debuter') return apercu(ctx, state.templates.find(t => t.id === id), E);
    if (act === 'apercu') return apercu(ctx, state.templates.find(t => t.id === id), E);
    if (act === 'editer') return editer(ctx, state.templates.find(t => t.id === id));
    if (act === 'nouveau') return editer(ctx, { id: 't' + Date.now(), nom: '', items: [] }, true);
  };
}

// Pastilles du cycle : nom court (sinon vrai nom tronqué), état faite / sautée / prochaine / à venir.
const nomCourt = (state, id, courts = state.settings.semaine?.courts ?? {}) => courts[id] || state.templates.find(t => t.id === id)?.nom || '?';
const pastilles = (state, cases, prochaine, courts) => `<div class="cycle">${cases.map((x, i) =>
  `<span class="${x.etat}${i === prochaine ? ' ici' : ''}">${esc(nomCourt(state, x.templateId, courts))}${x.etat === 'faite' ? ' ✓' : ''}</span>`).join('')}</div>`;

function carteSemaine(state, cycle, E) {
  if (!cycle) return state.templates.length ? `<section class="card"><h2 class="card-title" style="margin-bottom:6px">Ta semaine</h2>
    <p class="muted" style="margin:0 0 12px;font-size:14px">Indique l’ordre de tes séances sur 7 jours : l’app te proposera la suivante et comptera juste ton volume.</p>
    <button class="btn btn-secondary btn-bloc" data-act="semaine">Définir ma semaine</button></section>` : '';
  const t = state.templates.find(x => x.id === cycle.cases[cycle.prochaine].templateId), r = resume(t, E);
  const passees = cycle.cases.filter(x => x.etat !== 'a_faire').length;
  return `<section class="card">
    <div class="card-tete" style="align-items:center"><h2 class="card-title">Ma semaine</h2>
      <button class="btn btn-texte btn-sm" data-act="semaine">${cycle.jour ? `Jour ${cycle.jour} / 7` : 'Nouveau cycle'} · modifier</button></div>
    ${pastilles(state, cycle.cases, cycle.prochaine)}
    <div class="rail-cycle"><i style="width:${Math.round(passees / cycle.cases.length * 100)}%"></i></div>
    <p style="margin:12px 0 0;font-size:15px"><b>Prochaine : ${esc(t.nom)}</b><span class="faint" style="display:block">${esc(r.muscles || 'Aucun exercice')} · ${r.detail}</span></p>
    ${state.enCours ? '' : `<div class="semaine-actions"><button class="btn btn-primary" data-act="debuter" data-id="${esc(t.id)}">Débuter</button>
      <button class="btn btn-secondary" data-act="passer" data-id="${esc(t.id)}">Passer</button></div>`}
  </section>`;
}

function passer(ctx, templateId) {
  const saut = { id: 's' + Date.now(), templateId, date: new Date().toISOString() };
  ctx.maj(s => ({ ...s, sautees: [...(s.sautees ?? []), saut] }));
  const nom = ctx.state.templates.find(t => t.id === templateId)?.nom ?? 'Séance';
  toast(`${nom} passée.`, 'info', { libelle: 'Annuler', fn: () => ctx.maj(s => ({ ...s, sautees: (s.sautees ?? []).filter(x => x.id !== saut.id) })) });
}

// Feuille « Ma semaine » : ordre des séances (un programme peut revenir) et noms courts des pastilles.
// Travaille sur une copie ; seul « Enregistrer » touche l'état. Changer l'ordre ouvre une nouvelle période (spec).
function editerSemaine(ctx) {
  const { state } = ctx, existe = !!ordreActuel(state);
  const ordre = [...(ordreActuel(state) ?? [])], courts = { ...(state.settings.semaine?.courts ?? {}) };
  const f = ouvrirFeuille({ titre: 'Ma semaine', corps: '<div data-corps></div>',
    pied: `${existe ? '<button class="btn btn-texte" data-p="arreter">Ne plus suivre</button>' : ''}<button class="btn btn-primary" data-p="enregistrer">Enregistrer</button>` });
  const corps = f.querySelector('[data-corps]');
  const apercu = () => pastilles(state, ordre.map(templateId => ({ templateId, etat: 'a_faire' })), -1, courts);
  const dessiner = () => {
    const distincts = [...new Set(ordre)];
    corps.innerHTML = `<p class="faint" style="margin:0 0 12px">Les séances dans l’ordre où tu les fais. Le cycle doit tenir en 7 jours. Un programme peut revenir plusieurs fois.</p>
      <div class="label">Ordre</div>
      <ul class="liste">${ordre.map((id, i) => `<li class="liste-ligne semaine-ligne">
        <span class="faint">${i + 1}</span>
        <select class="form-control" data-i="${i}" aria-label="Séance ${i + 1}">${state.templates.map(t => `<option value="${esc(t.id)}"${t.id === id ? ' selected' : ''}>${esc(t.nom)}</option>`).join('')}</select>
        <button class="btn btn-texte btn-sm btn-icone" data-l="haut" data-i="${i}" aria-label="Monter"${i ? '' : ' disabled'}>↑</button>
        <button class="btn btn-texte btn-sm btn-icone" data-l="bas" data-i="${i}" aria-label="Descendre"${i < ordre.length - 1 ? '' : ' disabled'}>↓</button>
        <button class="btn btn-texte btn-sm btn-icone" data-l="retirer" data-i="${i}" aria-label="Retirer">${icon('close')}</button></li>`).join('')}</ul>
      <button class="btn btn-secondary btn-bloc" data-l="ajouter" style="margin-top:8px">+ Ajouter une séance</button>
      ${ordre.length ? `<div class="label" style="margin-top:20px">Noms courts (carte du haut)</div>
        <ul class="liste">${distincts.map(id => `<li class="liste-ligne" style="cursor:default">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(state.templates.find(t => t.id === id)?.nom ?? '?')}</span>
          <input class="form-control" style="width:96px;flex:none;text-align:center" data-court="${esc(id)}" maxlength="6" autocomplete="off" value="${esc(courts[id] ?? '')}" aria-label="Nom court"></li>`).join('')}</ul>
        <div class="label" style="margin-top:20px">Aperçu</div><div data-apercu>${apercu()}</div>` : ''}`;
  };
  dessiner();
  corps.addEventListener('click', e => {
    const b = e.target.closest('button[data-l]');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.l === 'ajouter') ordre.push(state.templates[0].id);
    if (b.dataset.l === 'retirer') ordre.splice(i, 1);
    if (b.dataset.l === 'haut' && i > 0) [ordre[i - 1], ordre[i]] = [ordre[i], ordre[i - 1]];
    if (b.dataset.l === 'bas' && i < ordre.length - 1) [ordre[i + 1], ordre[i]] = [ordre[i], ordre[i + 1]];
    dessiner();
  });
  corps.addEventListener('change', e => { if (e.target.matches('select[data-i]')) { ordre[Number(e.target.dataset.i)] = e.target.value; dessiner(); } });
  // Nom court : seul l'aperçu se redessine, pour garder le clavier ouvert.
  corps.addEventListener('input', e => {
    if (!e.target.dataset.court) return;
    courts[e.target.dataset.court] = e.target.value;
    corps.querySelector('[data-apercu]').innerHTML = apercu();
  });
  f.querySelector('.feuille-pied').addEventListener('click', e => {
    const p = e.target.closest('button[data-p]')?.dataset.p;
    if (!p) return;
    const liste = p === 'arreter' ? [] : ordre;
    ctx.maj(s => {
      const sem = s.settings.semaine, periodes = sem?.periodes ?? [];
      if (!sem && !liste.length) return s;
      const nouvelle = liste.join() !== (ordreActuel(s) ?? []).join();
      const propres = Object.fromEntries(Object.entries(courts).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      return { ...s, settings: { ...s.settings, semaine: { periodes: nouvelle ? [...periodes, { ordre: liste, depuis: new Date().toISOString() }] : periodes, courts: propres } } };
    });
    fermerFeuille(f);
    toast(liste.length ? 'Semaine enregistrée.' : 'Semaine retirée.');
  });
}

async function debuter(ctx, id) {
  const { state } = ctx;
  if (state.enCours && !await confirmer(`« ${state.enCours.nom} » est déjà en cours. La remplacer par une nouvelle séance ? Ce qui n’a pas été terminé sera perdu.`, { titre: 'Remplacer la séance en cours ?', ok: 'Remplacer', danger: true })) return;
  ctx.maj(s => ({ ...s, enCours: demarrer(s, id, new Date()) }), { rendre: false });
  ctx.ouvrirSeance();
}

// Toucher la carte d'un programme ou « Débuter » : carte qui surgit au centre avec ses exercices (« 3 × Développé… »).
function apercu(ctx, t, E) {
  const d = derniere(ctx.state, t.id);
  const f = ouvrirFeuille({ titre: t.nom, corps: `<p class="faint" style="margin:0 0 8px">${d ? `Dernière fois : ${fmtDate(d)}` : 'Jamais fait'}</p>
    <ul class="liste">${t.items.map(i => `<li class="liste-ligne" style="cursor:default"><span><b>${i.series} × ${esc(E[i.exerciseId]?.nom ?? '?')}</b>
      <span class="faint" style="display:block">${esc(NOM_MUSCLE[E[i.exerciseId]?.musclePrincipal] ?? '')}${i.supersetGroupe ? ` · superset ${esc(i.supersetGroupe)}` : ''}</span></span></li>`).join('')}</ul>`,
    pied: '<button class="btn btn-texte" data-p="editer">Modifier</button><button class="btn btn-primary" data-p="debuter">Débuter la séance</button>' });
  f.classList.add('carte-pop');
  f.addEventListener('click', e => {
    const p = e.target.closest('[data-p]')?.dataset.p;
    if (!p) return;
    fermerFeuille(f);
    if (p === 'debuter') debuter(ctx, t.id);
    if (p === 'editer') editer(ctx, t);
  });
}

function editer(ctx, original, nouveau = false) {
  let t = structuredClone(original);
  const nomEx = id => ctx.state.exercises.find(e => e.id === id)?.nom ?? '?';
  const f = ouvrirFeuille({
    titre: nouveau ? 'Nouveau programme' : 'Modifier le programme',
    corps: '<div data-corps></div>',
    pied: `${nouveau ? '' : `<button class="btn btn-danger" data-p="supprimer">Supprimer</button><button class="btn btn-secondary" data-p="dupliquer">Dupliquer</button>`}
      <button class="btn btn-primary" data-p="enregistrer">Enregistrer</button>`,
  });
  const corps = f.querySelector('[data-corps]');
  const dessiner = () => {
    corps.innerHTML = `
      <div class="form-group"><label for="nom-prog">Nom</label><input id="nom-prog" class="form-control" value="${esc(t.nom)}" maxlength="40" autocomplete="off"></div>
      <div class="label">Exercices</div>
      <ul class="liste">${t.items.map((it, i) => `<li class="liste-ligne" style="cursor:default;flex-wrap:wrap;row-gap:2px">
        <div style="min-width:0;flex:1 1 180px"><b>${esc(nomEx(it.exerciseId))}</b>
          <div class="faint">${it.series} séries${it.supersetGroupe ? ` · superset ${esc(it.supersetGroupe)}` : ''}${it.transition ? ` · +${fmtChrono(it.transition)} avant la suite` : ''}</div></div>
        <div style="display:flex;gap:2px;flex:none;margin-left:auto">
          <button class="btn btn-texte btn-sm btn-icone" data-i="${i}" data-a="moins" aria-label="Une série de moins">−</button>
          <button class="btn btn-texte btn-sm btn-icone" data-i="${i}" data-a="plus" aria-label="Une série de plus">+</button>
          <button class="btn btn-texte btn-sm btn-icone" data-i="${i}" data-a="haut" aria-label="Monter">${icon('haut')}</button>
          <button class="btn btn-texte btn-sm btn-icone" data-i="${i}" data-a="transition" aria-label="Repos en plus avant l’exercice suivant">${icon('chrono')}</button>
          <button class="btn btn-texte btn-sm btn-icone" data-i="${i}" data-a="ss" aria-label="Grouper en superset avec le suivant">SS</button>
          <button class="btn btn-texte btn-sm btn-icone" data-i="${i}" data-a="retirer" aria-label="Retirer">${icon('close')}</button>
        </div></li>`).join('') || '<li class="faint" style="padding:8px 0">Aucun exercice pour l’instant.</li>'}</ul>
      <button type="button" class="ajouter" data-a="ajouter" style="margin-top:12px">+ Ajouter un exercice</button>
      <p class="faint">« SS » groupe l’exercice avec le suivant en superset : le repos démarre après le dernier des deux.
        Le chrono ajoute du repos avant l’exercice suivant (1:00, 1:30, 2:00 ou 3:00), en plus de celui de la dernière série.</p>`;
  };
  dessiner();
  corps.addEventListener('input', e => { if (e.target.id === 'nom-prog') t.nom = e.target.value; });
  corps.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    if (b.dataset.a === 'ajouter') return choisirDansBibliotheque(ctx, { titre: 'Ajouter un exercice', mes: true, choisi: id => {
      t.items.push({ exerciseId: id, series: ctx.state.exercises.find(x => x.id === id).series, supersetGroupe: null });
      dessiner();
    } });
    const i = Number(b.dataset.i), it = t.items[i];
    if (b.dataset.a === 'plus') it.series = Math.min(10, it.series + 1);
    if (b.dataset.a === 'moins') it.series = Math.max(1, it.series - 1);
    if (b.dataset.a === 'haut' && i > 0) [t.items[i - 1], t.items[i]] = [t.items[i], t.items[i - 1]];
    if (b.dataset.a === 'retirer') t.items.splice(i, 1);
    if (b.dataset.a === 'transition') { // chaque toucher passe au palier suivant : aucun → 1:00 → 1:30 → 2:00 → 3:00 → aucun
      const paliers = [0, 60, 90, 120, 180], n = paliers[(paliers.indexOf(it.transition ?? 0) + 1) % paliers.length];
      if (n) it.transition = n; else delete it.transition;
    }
    if (b.dataset.a === 'ss') {
      const suivant = t.items[i + 1];
      if (!suivant) { toast('Ajoute d’abord un exercice après celui-ci.', 'info'); return; }
      if (it.supersetGroupe && it.supersetGroupe === suivant.supersetGroupe) { it.supersetGroupe = null; suivant.supersetGroupe = null; }
      else {
        const pris = new Set(t.items.map(x => x.supersetGroupe).filter(Boolean));
        const lettre = it.supersetGroupe ?? 'ABCDEFGH'.split('').find(l => !pris.has(l));
        it.supersetGroupe = lettre; suivant.supersetGroupe = lettre;
      }
    }
    // Un groupe réduit à un seul exercice n'est plus un superset.
    const compte = {}; t.items.forEach(x => { if (x.supersetGroupe) compte[x.supersetGroupe] = (compte[x.supersetGroupe] ?? 0) + 1; });
    t.items.forEach(x => { if (x.supersetGroupe && compte[x.supersetGroupe] < 2) x.supersetGroupe = null; });
    dessiner();
  });
  f.querySelector('.feuille-pied').addEventListener('click', async e => {
    const a = e.target.closest('[data-p]')?.dataset.p;
    if (!a) return;
    if (a === 'enregistrer') {
      const input = f.querySelector('#nom-prog');
      if (!t.nom.trim()) { champErreur(input, 'Donne un nom au programme.'); return; }
      t.nom = t.nom.trim();
      ctx.maj(s => ({ ...s, templates: nouveau ? [...s.templates, t] : s.templates.map(x => x.id === t.id ? t : x) }));
      fermerFeuille(f); toast(nouveau ? 'Programme créé.' : 'Programme enregistré.');
    }
    if (a === 'dupliquer') {
      const copie = { ...structuredClone(original), id: 't' + Date.now(), nom: `${original.nom} (copie)` };
      ctx.maj(s => ({ ...s, templates: [...s.templates, copie] }));
      fermerFeuille(f); toast('Programme dupliqué.');
    }
    if (a === 'supprimer' && await confirmer(`Le programme « ${original.nom} » sera supprimé. Tes séances passées restent dans l’historique.`, { titre: 'Supprimer le programme ?', ok: 'Supprimer', danger: true })) {
      ctx.maj(s => ({ ...s, templates: s.templates.filter(x => x.id !== original.id) }));
      fermerFeuille(f); toast('Programme supprimé.');
    }
  });
}
