// Feuille « Analyse de tes séances » : simulation lancée à la demande. Rien ne change tant qu'on n'appuie pas sur Appliquer.
import { analyser, simuler, dependants, requis, gainPoints, dureeCalculee, facteur } from '../ajustement.js';
import { volumePrevu } from '../moteur.js';
import { MUSCLES_EN_OPTION, NOM_MUSCLE } from '../profils.js';
import { ouvrirFeuille, fermerFeuille, toast, esc, fmtNum, fmtDuree } from '../ui.js';
import { liensSources } from './exercices.js';

const pts = g => fmtNum(Math.abs(g), 1);
const minTxt = min => fmtDuree(Math.round(min / 5) * 5 * 60000);
const signeMin = m => `${m > 0 ? '+' : '−'}${Math.max(1, Math.round(Math.abs(m)))} min`;

export function ouvrirSimulation(ctx) {
  const r = analyser(ctx.state, new Date());
  const coches = new Set(r.changements.map(c => c.id));
  const f = ouvrirFeuille({ titre: 'Analyse de tes séances', corps: '<div data-sim></div>',
    pied: '<button class="btn btn-texte" data-fermer>Fermer</button><button class="btn btn-primary" data-appliquer>Appliquer à mes programmes</button>' });
  f.classList.add('haute');
  const dessiner = () => {
    f.querySelector('[data-sim]').innerHTML = contenu(ctx.state, r, coches);
    f.querySelector('[data-appliquer]').disabled = !coches.size;
  };
  f.addEventListener('change', e => {
    const i = e.target.closest('input[data-ch]');
    if (!i) return;
    if (i.checked) { coches.add(i.dataset.ch); requis(r.changements, i.dataset.ch).forEach(x => coches.add(x)); }
    else { coches.delete(i.dataset.ch); dependants(r.changements, i.dataset.ch).forEach(x => coches.delete(x)); }
    dessiner();
  });
  f.addEventListener('click', e => {
    if (!e.target.closest('button[data-appliquer]') || !coches.size) return;
    const avant = { templates: ctx.state.templates, exercises: ctx.state.exercises };
    ctx.maj(s => ({ ...s, ...simuler(s, r.changements, coches) }));
    fermerFeuille(f);
    toast('Programmes modifiés.', 'success', { libelle: 'Annuler', fn: () => { ctx.maj(s => ({ ...s, ...avant })); toast('Programmes remis comme avant.', 'info'); } });
  });
  dessiner();
}

function contenu(state, r, coches) {
  const fin = simuler(state, r.changements, coches), v0 = volumePrevu(state), v1 = volumePrevu(fin);
  const parId = Object.fromEntries(r.changements.map(c => [c.id, c]));
  const diag = r.diagnostic.filter(d => d.vise || !MUSCLES_EN_OPTION.has(d.muscle))
    .sort((a, b) => b.prioritaire - a.prioritaire);
  const note = m => r.notes.find(n => n.muscle === m);

  const diagnostic = diag.map(d => {
    const apres = v1[d.muscle], max = Math.max(d.cible * 1.5, apres, d.prevu), n = note(d.muscle);
    const change = Math.abs(apres - d.prevu) > 1e-9;
    return `<div class="jauge"><div class="jauge-tete"><span>${esc(NOM_MUSCLE[d.muscle])}${d.prioritaire ? ' <span class="badge acc">Prioritaire</span>' : ''}</span>
      <span class="${apres >= d.cible ? '' : 'muted'}">${fmtNum(d.prevu)}${change ? ` → <b>${fmtNum(apres)}</b>` : ''} / ${d.cible}</span></div>
      <div class="jauge-rail"><div class="jauge-plein ${apres >= d.cible ? 'pos' : d.prioritaire ? 'warn' : ''}" style="width:${apres / max * 100}%"></div>
      <div class="jauge-cible" style="left:${d.cible / max * 100}%" title="Cible"></div></div>
      ${[state.workouts.length ? `Fait : ${fmtNum(d.fait)} par semaine (4 dernières semaines)` : '', d.sansPrincipal && d.statut === 'retard' ? 'Aucun exercice ne le cible en principal' : '']
        .filter(Boolean).map(t => `<div class="faint" style="font-size:12px;margin-top:4px">${t}</div>`).join('')}
      ${n?.type === 'regularite' ? `<div class="sim-note">Tu fais moins que prévu : fais d’abord ce qui est prévu avant d’ajouter des séries.${liensSources(['S19'])}</div>` : ''}
      ${n?.type === 'plein' ? `<div class="sim-note">Il manque ${fmtNum(n.manque)} série${n.manque >= 2 ? 's' : ''} : plus de place efficace dans tes séances. Ajoute une séance, par exemple Upper/Lower.${liensSources(['S32'])}</div>` : ''}</div>`;
  }).join('');

  const muscles = [...new Set(r.changements.map(c => c.muscle))];
  const changements = r.changements.length ? muscles.map(m => `<div class="label" style="margin-top:14px">${esc(NOM_MUSCLE[m])}</div>
    ${r.changements.filter(c => c.muscle === m).map(c => {
      const g = c.gain[c.muscle], pertes = Object.entries(c.gain).filter(([, x]) => x < 0);
      const gain = c.type === 'superset' ? 'Même croissance, en moins de temps'
        : `≈ +${pts(g / 2)} à ${pts(g)} pt de croissance${pertes.map(([mm, x]) => ` · ${esc(NOM_MUSCLE[mm])} −${pts(x / 2)} à ${pts(x)} pt`).join('')}`;
      const tpl = state.templates.find(t => t.id === c.templateId);
      const avec = c.depend.map(d => parId[d]?.texte).filter(Boolean);
      return `<div class="sim-ch${coches.has(c.id) ? '' : ' off'}">
        <label class="case"><input type="checkbox" data-ch="${c.id}" ${coches.has(c.id) ? 'checked' : ''}><span><b>${esc(c.texte)}</b></span></label>
        <div class="sim-chiffres"><span>${gain}</span><span>${esc(tpl.nom)} : ${signeMin(c.minutes)} → ${minTxt(c.dureeApres)}${c.depasse ? ` <span class="badge warn">dépasse ${minTxt(r.dureeMax)}</span>` : ''}</span></div>
        ${avec.length ? `<div class="faint" style="font-size:12px">Va avec : ${avec.map(esc).join(' ; ')}</div>` : ''}
        <details class="explication"><summary>Pourquoi ?</summary><p>${esc(c.pourquoi)}</p>${liensSources(c.sources)}</details></div>`;
    }).join('')}`).join('')
    : `<p class="muted" style="font-size:14px">${r.notes.length ? 'Pas de changement à proposer pour l’instant : regarde les remarques ci-dessus.' : 'Tes programmes atteignent déjà toutes tes cibles. Rien à changer.'}</p>`;

  const E1 = Object.fromEntries(fin.exercises.map(e => [e.id, e])), E0 = Object.fromEntries(state.exercises.map(e => [e.id, e]));
  const remplacements = Object.fromEntries(r.changements.filter(c => c.type === 'remplacement' && coches.has(c.id)).map(c => [`${c.templateId}:${c.exerciseId}`, c.ancienId]));
  const programmes = fin.templates.filter(t => t !== state.templates.find(x => x.id === t.id)).map(t => {
    const t0 = state.templates.find(x => x.id === t.id), d0 = dureeCalculee(t0, E0) * facteur(state, t0), d1 = dureeCalculee(t, E1) * facteur(state, t0);
    return `<div class="sim-prog"><div class="jauge-tete"><b>${esc(t.nom)}</b><span class="${d1 > r.dureeMax * 60 ? 'warn-txt' : 'muted'}">${minTxt(d0 / 60)} → ${minTxt(d1 / 60)}</span></div>
      <ul class="liste">${t.items.map(it => {
        const ancien = t0.items.find(x => x.exerciseId === it.exerciseId), remplace = remplacements[`${t.id}:${it.exerciseId}`];
        const marque = remplace ? `<span class="badge acc">Remplace ${esc(E0[remplace]?.nom)}</span>` : !ancien ? '<span class="badge acc">Nouveau</span>' : '';
        const series = ancien && ancien.series !== it.series ? `${ancien.series} → <b>${it.series}</b>` : String(it.series);
        const ss = it.supersetGroupe && it.supersetGroupe !== ancien?.supersetGroupe ? ' · <b>superset</b>' : it.supersetGroupe ? ' · superset' : '';
        return `<li class="liste-ligne"><span style="min-width:0">${esc(E1[it.exerciseId]?.nom)} ${marque}<span class="faint" style="display:block">${series} séries${ss}</span></span></li>`;
      }).join('')}</ul></div>`;
  }).join('');

  const gains = Object.keys(v0).filter(m => Math.abs(gainPoints(v0[m], v1[m])) >= 0.1).map(m => [m, gainPoints(v0[m], v1[m])])
    .sort((a, b) => b[1] - a[1]);

  return `<p class="faint" style="margin:0 0 12px">Rien ne change tant que tu n’appliques pas. Décoche ce que tu ne veux pas : tout se recalcule.</p>
    <div class="label">Séries par semaine : prévu → simulé / cible</div>${diagnostic}
    <div class="label" style="margin-top:18px">Changements proposés</div>${changements}
    ${programmes ? `<div class="label" style="margin-top:18px">Tes programmes simulés</div>${programmes}` : ''}
    ${gains.length ? `<div class="label" style="margin-top:18px">Gain estimé <span class="badge">Indicatif</span></div>
      ${gains.map(([m, g]) => `<div class="sim-gain"><span>${esc(NOM_MUSCLE[m])}</span><span class="${g > 0 ? '' : 'muted'}">${g > 0 ? '+' : '−'}${pts(g / 2)} à ${pts(g)} pt</span></div>`).join('')}
      <p class="faint" style="font-size:12px;margin:6px 0 0">Points de croissance du muscle en plus, sur la durée d’une étude type : 0,37 par série hebdomadaire (méta-analyse), compté à moitié au-delà de 10 séries et au quart au-delà de 20 (réglage de l’app pour les rendements décroissants). Ordre de grandeur seulement : chez un pratiquant entraîné, l’effet est souvent plus petit. Durées estimées : 40 s par série plus le repos, recalées sur tes vraies séances.</p>
      ${liensSources(['S4', 'S5', 'S32', 'S33'])}` : ''}`;
}
