// Feuille « Ton analyse » : simulation lancée à la demande, présentée par séance (maquette B v2, choisie par Jules).
// Rien ne change tant qu'on n'appuie pas sur Appliquer.
import { analyser, simuler, dependants, requis, gainPoints, dureeCalculee, facteur } from '../ajustement.js';
import { volumePrevu } from '../moteur.js';
import { NOM_MUSCLE } from '../profils.js';
import { ouvrirFeuille, fermerFeuille, toast, esc, fmtNum, fmtDuree } from '../ui.js';
import { liensSources } from './exercices.js';

const COURT = { pectoraux: 'Pecs', delt_ant: 'Delt. antérieur', delt_lat: 'Delt. latéral', delt_post: 'Delt. postérieur', quadriceps: 'Quadri',
  ischios: 'Ischios', avant_bras: 'Avant-bras' };
const court = m => COURT[m] ?? NOM_MUSCLE[m];
const pts = g => fmtNum(Math.abs(g), 1);
const minTxt = s => fmtDuree(Math.round(s / 60) * 60000);
const signeMin = m => `${m > 0 ? '+' : '−'}${Math.max(1, Math.round(Math.abs(m)))} min`;

export function ouvrirSimulation(ctx) {
  const r = analyser(ctx.state, new Date());
  const vue = { coches: new Set(r.changements.map(c => c.id)), onglet: r.changements[0]?.templateId ?? ctx.state.templates[0]?.id, muscle: null, ouvert: null };
  const f = ouvrirFeuille({ titre: 'Ton analyse', corps: '<div data-sim></div>',
    pied: '<div class="sim-resume" data-resume></div><button class="btn btn-primary" data-appliquer>Appliquer</button>' });
  f.classList.add('haute');
  f.querySelector('.feuille-pied').classList.add('sim-pied');

  const dessiner = () => {
    const defile = [...f.querySelectorAll('.sim-defile')].map(e => e.scrollLeft);
    const d = donnees(ctx.state, r, vue);
    f.querySelector('[data-sim]').innerHTML = corps(ctx.state, r, vue, d);
    f.querySelectorAll('.sim-defile').forEach((e, i) => { e.scrollLeft = defile[i] ?? 0; });
    const n = vue.coches.size;
    f.querySelector('[data-resume]').innerHTML = r.changements.length
      ? `<b>${n} changement${n > 1 ? 's' : ''}</b><span class="faint">${d.atteintes} cible${d.atteintes > 1 ? 's' : ''} sur ${d.tuiles.length} atteinte${d.atteintes > 1 ? 's' : ''}</span>`
      : '<b>Rien à changer</b>';
    f.querySelector('[data-appliquer]').disabled = !n;
  };

  f.addEventListener('change', e => {
    const i = e.target.closest('input[data-ch]');
    if (!i) return;
    const id = i.dataset.ch;
    if (i.checked) { vue.coches.add(id); requis(r.changements, id).forEach(x => vue.coches.add(x)); }
    else { vue.coches.delete(id); dependants(r.changements, id).forEach(x => vue.coches.delete(x)); }
    dessiner();
  });
  f.addEventListener('click', e => {
    if (e.target.closest('.sim-switch')) return; // l'interrupteur gère son propre changement
    const muscle = e.target.closest('[data-muscle-filtre]'), onglet = e.target.closest('[data-onglet]'), ligne = e.target.closest('[data-ouvrir]');
    if (muscle) {
      const m = muscle.dataset.muscleFiltre;
      vue.muscle = vue.muscle === m ? null : m;
      const premier = vue.muscle && r.changements.find(c => c.muscle === vue.muscle);
      if (premier) vue.onglet = premier.templateId;
      vue.ouvert = null;
    } else if (onglet) { vue.onglet = onglet.dataset.onglet; vue.ouvert = null; }
    else if (ligne) vue.ouvert = vue.ouvert === ligne.dataset.ouvrir ? null : ligne.dataset.ouvrir;
    else if (e.target.closest('button[data-appliquer]') && vue.coches.size) {
      const avant = { templates: ctx.state.templates, exercises: ctx.state.exercises };
      ctx.maj(s => ({ ...s, ...simuler(s, r.changements, vue.coches) }));
      fermerFeuille(f);
      toast('Programmes modifiés.', 'success', { libelle: 'Annuler', fn: () => { ctx.maj(s => ({ ...s, ...avant })); toast('Programmes remis comme avant.', 'info'); } });
      return;
    } else return;
    dessiner();
  });
  f.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
  });
  dessiner();
}

// Tout ce qui se calcule : simulation cochée, simulation complète (pour montrer aussi les changements décochés), durées.
function donnees(state, r, vue) {
  const fin = simuler(state, r.changements, vue.coches), complet = simuler(state, r.changements, new Set(r.changements.map(c => c.id)));
  const v0 = volumePrevu(state), v1 = volumePrevu(fin);
  const E0 = Object.fromEntries(state.exercises.map(e => [e.id, e])), E1 = Object.fromEntries(complet.exercises.map(e => [e.id, e]));
  const Ef = Object.fromEntries(fin.exercises.map(e => [e.id, e]));
  const durees = Object.fromEntries(state.templates.map(t => {
    const k = facteur(state, t);
    return [t.id, { avant: dureeCalculee(t, E0) * k, apres: dureeCalculee(fin.templates.find(x => x.id === t.id), Ef) * k }];
  }));
  const touches = new Set(r.changements.flatMap(c => Object.keys(c.gain)));
  // Muscles visés seulement : le deltoïde antérieur (secondaire) n'est pas un objectif, l'afficher « en retard » induirait en erreur.
  const tuiles = r.diagnostic.filter(d => d.vise && (d.statut === 'retard' || touches.has(d.muscle)))
    .sort((a, b) => b.prioritaire - a.prioritaire || a.prevu / a.cible - b.prevu / b.cible);
  return { fin, complet, v0, v1, E0, E1, durees, tuiles, atteintes: tuiles.filter(d => v1[d.muscle] >= d.cible).length };
}

function corps(state, r, vue, d) {
  const { v0, v1 } = d, limite = r.dureeMax * 60;
  const notes = r.notes.filter(n => n.type === 'regularite');

  // 1. Muscles : avant → après, cible ; toucher filtre.
  const tuiles = d.tuiles.map(x => {
    const m = x.muscle, ok = v1[m] >= x.cible, change = Math.abs(v1[m] - v0[m]) > 1e-9;
    return `<div class="sim-m${ok ? ' ok' : ' court'}${vue.muscle === m ? ' sel' : ''}" role="button" tabindex="0" data-muscle-filtre="${m}" aria-pressed="${vue.muscle === m}">
      <span class="faint">${esc(court(m))}${x.prioritaire ? ' ★' : ''}</span><b>${change ? `${fmtNum(v0[m])} → ${fmtNum(v1[m])}` : fmtNum(v0[m])}</b><span class="faint">cible ${x.cible}</span></div>`;
  }).join('');
  let sousMuscles = '<p class="faint sim-aide">Touche un muscle pour voir son gain estimé et ses changements.</p>';
  if (vue.muscle) {
    const m = vue.muscle, g = gainPoints(v0[m], v1[m]), plein = r.notes.find(n => n.type === 'plein' && n.muscle === m), diag = r.diagnostic.find(x => x.muscle === m);
    sousMuscles = `<p class="sim-aide">${Math.abs(g) >= 0.05 ? `<span class="sim-gain">${esc(court(m))} ≈ ${g > 0 ? '+' : '−'}${pts(g / 2)} à ${pts(g)} pt de croissance</span> <span class="badge">Indicatif</span>` : `<span class="faint">Pas de changement coché pour ce muscle.</span>`}
      ${state.workouts.length ? `<span class="faint" style="display:block;margin-top:4px">Fait ces 4 dernières semaines : ${fmtNum(diag.fait)} séries par semaine.</span>` : ''}
      ${plein ? `<span class="sim-note" style="display:block">Il manque encore ${fmtNum(plein.manque)} série${plein.manque >= 2 ? 's' : ''} : plus de place efficace dans tes séances. Ajoute une séance, par exemple Upper/Lower.${liensSources(['S32'])}</span>` : ''}</p>`;
  }

  const blocMuscles = `<section class="sim-carte"><div class="sim-titre"><span>Séries par semaine</span></div>
    <div class="sim-defile">${tuiles}</div>${sousMuscles}</section>
    ${notes.length ? `<div class="sim-note">${notes.map(n => esc(court(n.muscle))).join(', ')} : tu en fais moins que prévu ces 4 dernières semaines. Fais d’abord ce qui est prévu, l’app ne propose pas d’en ajouter.${liensSources(['S19'])}</div>` : ''}`;

  if (!r.changements.length) return `${blocMuscles}<section class="sim-carte"><p class="muted" style="margin:0;font-size:14px">${r.notes.length ? 'Pas de changement à proposer pour l’instant : regarde les remarques au-dessus.' : 'Tes programmes atteignent déjà toutes tes cibles. Rien à changer.'}</p></section>`;

  // 2. Séances : durée avant → après et nombre de changements cochés, en un coup d'œil.
  const sert = c => !vue.muscle || c.muscle === vue.muscle || c.gain[vue.muscle] > 0;
  const onglets = state.templates.map(t => {
    const du = d.durees[t.id], n = r.changements.filter(c => c.templateId === t.id && vue.coches.has(c.id) && sert(c)).length;
    return `<div class="sim-onglet${vue.onglet === t.id ? ' on' : ''}${du.apres > limite ? ' warn' : ''}" role="button" tabindex="0" data-onglet="${esc(t.id)}" aria-pressed="${vue.onglet === t.id}">
      <b>${esc(t.nom)}</b><span>${Math.round(du.avant / 60)} → ${Math.round(du.apres / 60)} min${n ? ` · ${n}` : ''}</span></div>`;
  }).join('');

  // 3. La séance choisie, dans l'ordre.
  const t0 = state.templates.find(t => t.id === vue.onglet) ?? state.templates[0];
  const tC = d.complet.templates.find(t => t.id === t0.id), tF = d.fin.templates.find(t => t.id === t0.id);
  const du = d.durees[t0.id], echelle = Math.max(limite, du.avant, du.apres) * 1.08, pc = s => `${(s / echelle * 100).toFixed(1)}%`;
  const plus = du.apres - du.avant;
  const rail = `<div class="sim-rail"><i style="left:0;width:${pc(Math.min(du.avant, du.apres))}" class="base"></i>
      ${plus > 0 ? `<i style="left:${pc(du.avant)};width:${pc(plus)}" class="ajout"></i>` : ''}
      <s style="left:${pc(limite)}"></s><span class="sim-lim" style="left:${pc(limite)}">limite ${minTxt(limite)}</span></div>
    <div class="sim-legende"><span><i class="base"></i>aujourd’hui ${minTxt(du.avant)}</span>${Math.abs(plus) >= 30 ? `<span><i class="${plus > 0 ? 'ajout' : 'base'}"></i>${signeMin(plus / 60)}</span>` : ''}</div>`;

  const dansT = r.changements.filter(c => c.templateId === t0.id);
  const ligne = it => {
    const lies = dansT.filter(c => c.type !== 'superset' && c.exerciseId === it.exerciseId), c = lies[0];
    const base = t0.items.find(x => x.exerciseId === (c?.type === 'remplacement' ? c.ancienId : it.exerciseId));
    const actuel = tF.items.find(x => x.exerciseId === it.exerciseId);
    const coche = c && vue.coches.has(c.id), visible = c && sert(c);
    const nom = esc(d.E1[it.exerciseId]?.nom);
    let detailSeries;
    if (!c) detailSeries = actuel && base && actuel.series !== base.series ? `${base.series} → <span class="vert">${actuel.series} séries</span> · superset` : `${it.series} séries`;
    else if (c.type === 'series') detailSeries = coche ? `${base.series} → <span class="vert">${actuel.series} séries</span>` : `${base.series} séries · proposé : ${base.series + c.n}`;
    else detailSeries = `${it.series} séries${c.type === 'remplacement' ? ` · remplace ${esc(d.E0[c.ancienId]?.nom)}` : ''}`;
    const marque = c && c.type !== 'series' ? ` <span class="badge acc">${c.type === 'ajout' ? 'Nouveau' : 'Remplace'}</span>` : '';
    const pour = visible ? `<span class="sim-pour-l"><span class="sim-pour">${esc(court(c.muscle))}</span></span>` : '';
    const trait = !visible || !coche ? '' : c.type === 'series' ? ' on' : ' nv';
    const cl = !c ? ' calme' : !visible ? ' calme' : !coche ? ' off' : '';
    return `<div class="sim-ligne${cl}"${visible ? ` role="button" tabindex="0" data-ouvrir="${c.id}" aria-expanded="${vue.ouvert === c.id}"` : ''}>
        <span class="sim-trait${trait}"></span><span class="sim-ex"><b>${nom}${marque}</b><span class="faint">${detailSeries}</span>${pour}</span>
        ${visible ? interrupteur(c, coche) : ''}</div>${visible && vue.ouvert === c.id ? detail(c, r, vue) : ''}`;
  };
  // Blocs : exercice seul ou superset (tel qu'il serait avec tous les changements).
  const items = tC.items, html = [];
  for (let i = 0; i < items.length;) {
    const g = items[i].supersetGroupe;
    let j = i + 1;
    while (g && j < items.length && items[j].supersetGroupe === g) j++;
    if (j - i > 1) {
      const ids = items.slice(i, j).map(x => x.exerciseId);
      const ss = dansT.find(c => c.type === 'superset' && ids.includes(c.a) && ids.includes(c.b));
      const coche = ss && vue.coches.has(ss.id);
      html.push(`<div class="sim-ss${ss && !coche ? ' off' : ''}"><div class="sim-ss-tete"${ss ? ` role="button" tabindex="0" data-ouvrir="${ss.id}" aria-expanded="${vue.ouvert === ss.id}"` : ''}>
          <span>Superset${ss ? ` <span class="badge acc">${coche ? 'Nouveau' : 'Proposé'}</span>` : ''}</span>${ss ? interrupteur(ss, coche) : ''}</div>
        ${ss && vue.ouvert === ss.id ? detail(ss, r, vue) : ''}${items.slice(i, j).map(ligne).join('')}</div>`);
    } else html.push(ligne(items[i]));
    i = j;
  }
  const depasse = du.apres > limite ? `<div class="sim-note">${esc(t0.nom)} dépasse ta limite de ${Math.max(1, Math.round((du.apres - limite) / 60))} min : décoche un changement, ou garde-le quand même.</div>` : '';

  return `${blocMuscles}
    <div class="sim-defile sim-onglets">${onglets}</div>
    <section class="sim-carte">${rail}<div class="sim-liste">${html.join('')}</div></section>
    ${depasse}
    <details class="explication sim-methode"><summary>Comment c’est calculé ?</summary>
      <p>Gain : 0,37 point de croissance du muscle par série hebdomadaire en plus, sur la durée d’une étude type (méta-analyse). Compté à moitié au-delà de 10 séries par semaine et au quart au-delà de 20 : c’est un réglage de l’app pour les rendements décroissants, pas un chiffre d’étude. Ordre de grandeur seulement : chez un pratiquant entraîné, l’effet est souvent plus petit.</p>
      <p>Pas plus de 11 séries d’un même muscle dans une séance : au-delà, une série de plus n’apporte presque plus rien (préprint). Durées : 40 s par série plus le repos, recalées sur tes vraies séances.</p>
      ${liensSources(['S4', 'S5', 'S32', 'S33'])}</details>`;
}

const interrupteur = (c, coche) => `<label class="sim-switch" aria-label="${coche ? 'Retirer' : 'Garder'} : ${esc(c.texte)}"><input type="checkbox" data-ch="${c.id}" ${coche ? 'checked' : ''}><span></span></label>`;

function detail(c, r, vue) {
  const gains = Object.entries(c.gain).filter(([, g]) => Math.abs(g) >= 0.05).sort((a, b) => b[1] - a[1]);
  const parId = Object.fromEntries(r.changements.map(x => [x.id, x]));
  const avec = c.depend.map(id => parId[id]?.texte).filter(Boolean);
  return `<div class="sim-detail">
    ${c.type === 'superset' ? '<span class="sim-gain">Même croissance, en moins de temps</span>'
      : gains.map(([m, g]) => `<span class="sim-gain${g < 0 ? ' neg' : ''}">${esc(court(m))} ≈ ${g > 0 ? '+' : '−'}${pts(g / 2)} à ${pts(g)} pt</span>`).join(' ')}
    <p>${esc(c.pourquoi)}</p>
    ${avec.length ? `<p class="faint">Va avec : ${avec.map(esc).join(' ; ')}</p>` : ''}
    <div class="sim-src">${signeMin(c.minutes)} sur la séance${c.depasse && vue.coches.has(c.id) ? ' · <b>au-delà de ta limite</b>' : ''}${liensSources(c.sources)}</div></div>`;
}
