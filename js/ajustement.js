// « Analyser mes séances » : simulation de changements de programme pour atteindre les cibles de séries
// (docs/superpowers/specs/2026-11-16-ajustement-programme-design.md). Fonctions pures : rien ne modifie l'état.
import { MUSCLES, NOM_MUSCLE, PROFILS } from './profils.js';
import { volumePrevu, volumeSemaine, ciblesVolume, alerteEpaules, lundis } from './moteur.js';
import { BIBLIOTHEQUE, depuisBibliotheque } from './bibliotheque.js';
import { norm } from './strong-import.js';
import { GROUPE } from './seance.js';

// Réglages maison (pas des chiffres d'étude) : exécution d'une série, séries max par exercice, durée max par défaut.
export const EXEC = 40, MAX_EX = 5, DUREE_MAX = 80;
export const MAX_SEANCE = 11; // S32 : au-delà de ~11 séries fractionnaires d'un muscle dans une séance, plus de gain détectable
const JOUR = 864e5;
const exDe = etat => Object.fromEntries(etat.exercises.map(e => [e.id, e]));
const iso = type => type.split('_')[0] === 'iso';
const moitie = m => GROUPE[m] === 'jambes' ? 'bas' : 'haut';
const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');
// Variante qu'une étude préfère à type égal : leg curl assis plutôt que couché (S16).
const MIEUX = /leg curl assis|seated leg curl/i;
const reposDe = x => x.reposSec ?? PROFILS[x.type]?.reposSec ?? 90;

// Blocs d'un programme : un exercice seul, ou les exercices voisins d'un même superset.
function blocs(items) {
  const out = [];
  items.forEach((it, i) => {
    const prec = out.at(-1);
    if (it.supersetGroupe && prec && items[prec.at(-1)].supersetGroupe === it.supersetGroupe) prec.push(i); else out.push([i]);
  });
  return out;
}

// Durée calculée (s) : chaque série = 40 s + repos ; un superset prend un seul repos par tour (le plus long, comme cocherTour) ;
// transitions comprises ; pas de repos après le dernier bloc.
export function dureeCalculee(tpl, E) {
  const bs = blocs(tpl.items);
  return Math.max(0, bs.reduce((s, b, k) => {
    const its = b.map(i => tpl.items[i]), tours = Math.max(...its.map(x => x.series));
    const repos = Math.max(...its.map(x => E[x.exerciseId] ? reposDe(E[x.exerciseId]) : 90));
    const exec = its.reduce((t, x) => t + x.series * EXEC, 0);
    return s + exec + (k === bs.length - 1 ? (tours - 1) * repos : tours * repos + Math.max(0, ...its.map(x => x.transition ?? 0)));
  }, 0));
}

// Calibration : médiane des séances réelles de ce programme / durée calculée, bornée à [0,7 ; 1,5]. 1 sans au moins 2 séances.
export function facteur(state, tpl) {
  const calc = dureeCalculee(tpl, exDe(state));
  const reel = state.workouts.filter(w => w.templateId === tpl.id && w.fin)
    .map(w => (Date.parse(w.fin) - Date.parse(w.debut)) / 1000).sort((a, b) => a - b);
  if (reel.length < 2 || !calc) return 1;
  const n = reel.length, med = n % 2 ? reel[(n - 1) / 2] : (reel[n / 2 - 1] + reel[n / 2]) / 2;
  return Math.min(1.5, Math.max(0.7, med / calc));
}

// Gain (points de % de croissance du muscle) : 0,37 par série hebdomadaire (S4), décote maison pour les rendements
// décroissants de S5 : ×0,5 au-delà de 10 séries par semaine, ×0,25 au-delà de 20.
const F = x => x <= 10 ? x : x <= 20 ? 10 + (x - 10) / 2 : 15 + (x - 20) / 4;
export const gainPoints = (avant, apres) => 0.37 * (F(Math.max(0, apres)) - F(Math.max(0, avant)));

function volSeance(tpl, E) {
  const v = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  for (const it of tpl.items) {
    const ex = E[it.exerciseId];
    if (!ex) continue;
    v[ex.musclePrincipal] += it.series;
    for (const m of ex.musclesSecondaires) v[m] += it.series / 2;
  }
  return v;
}

// Applique un changement à { templates, exercises } ; ignoré (état rendu tel quel) si sa cible n'existe plus.
function appliquer(etat, c) {
  const tpl = etat.templates.find(t => t.id === c.templateId);
  if (!tpl) return etat;
  const items = tpl.items.map(it => ({ ...it }));
  const exercises = c.nouvel && !etat.exercises.some(e => e.id === c.nouvel.id) ? [...etat.exercises, c.nouvel] : etat.exercises;
  const E = exDe({ exercises });
  if (c.type === 'series') {
    const cible = items.find(it => it.exerciseId === c.exerciseId);
    if (!cible) return etat;
    for (const it of items) if (it === cible || (cible.supersetGroupe && it.supersetGroupe === cible.supersetGroupe)) it.series += c.n;
  } else if (c.type === 'ajout') {
    if (items.some(it => it.exerciseId === c.exerciseId) || !E[c.exerciseId]) return etat;
    const g = GROUPE[E[c.exerciseId].musclePrincipal];
    let pos = -1;
    items.forEach((it, i) => { if (GROUPE[E[it.exerciseId]?.musclePrincipal] === g) pos = i; });
    while (pos >= 0 && pos + 1 < items.length && items[pos].supersetGroupe && items[pos + 1].supersetGroupe === items[pos].supersetGroupe) pos++;
    items.splice(pos < 0 ? items.length : pos + 1, 0, { exerciseId: c.exerciseId, series: c.n, supersetGroupe: null });
  } else if (c.type === 'remplacement') {
    const it = items.find(x => x.exerciseId === c.ancienId);
    if (!it || items.some(x => x.exerciseId === c.exerciseId) || !E[c.exerciseId]) return etat;
    it.exerciseId = c.exerciseId;
  } else if (c.type === 'superset') {
    const ib = items.findIndex(x => x.exerciseId === c.b), a = items.find(x => x.exerciseId === c.a);
    if (ib < 0 || !a || a.supersetGroupe || items[ib].supersetGroupe) return etat;
    const pris = new Set(items.map(x => x.supersetGroupe).filter(Boolean));
    const lettre = 'ABCDEFGHIJ'.split('').find(l => !pris.has(l));
    const [b] = items.splice(ib, 1);
    a.supersetGroupe = lettre; b.supersetGroupe = lettre;
    items.splice(items.indexOf(a) + 1, 0, b);
  }
  return { exercises, templates: etat.templates.map(t => t === tpl ? { ...t, items } : t) };
}

// Rejoue les changements cochés, dans l'ordre, sur les vrais programmes.
export function simuler(state, changements, coches) {
  let etat = { templates: state.templates, exercises: state.exercises };
  for (const c of changements) if (coches.has(c.id)) etat = appliquer(etat, c);
  return etat;
}

// Changements qui dépendent de id (à décocher avec lui), et ceux dont id dépend (à cocher avec lui), transitivement.
export function dependants(changements, id) {
  const out = new Set([id]);
  for (let ajout = true; ajout;) {
    ajout = false;
    for (const c of changements) if (!out.has(c.id) && c.depend.some(d => out.has(d))) { out.add(c.id); ajout = true; }
  }
  out.delete(id);
  return out;
}
export function requis(changements, id) {
  const par = Object.fromEntries(changements.map(c => [c.id, c])), out = new Set(), pile = [...(par[id]?.depend ?? [])];
  while (pile.length) { const d = pile.pop(); if (!out.has(d)) { out.add(d); pile.push(...(par[d]?.depend ?? [])); } }
  return out;
}

export function analyser(state, now = new Date()) {
  const dureeMax = (state.settings.dureeMax ?? DUREE_MAX) * 60;
  const cibles = ciblesVolume(state), prio = state.settings.musclesPrioritaires;
  const E0 = exDe(state), prevu = volumePrevu(state);
  const fact = Object.fromEntries(state.templates.map(t => [t.id, facteur(state, t)]));
  const fait = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  // 4 dernières semaines complètes : la semaine en cours, entamée, ferait croire qu'on en fait moins que prévu.
  for (const d of lundis(new Date(now.getTime() - 7 * JOUR), 4)) for (const [m, v] of Object.entries(volumeSemaine(state, d.toISOString()))) fait[m] += v / 4;
  const premier = state.workouts.reduce((min, w) => w.debut < min ? w.debut : min, now.toISOString());
  const historique = now.getTime() - Date.parse(premier) >= 28 * JOUR;
  const vises = new Set([...prio, ...state.templates.flatMap(t => t.items.map(i => E0[i.exerciseId]?.musclePrincipal)).filter(Boolean)]);
  const statut = (v, m) => v[m] < cibles[m] ? 'retard' : v[m] > 1.5 * cibles[m] ? 'beaucoup' : 'ok';
  const diagnostic = MUSCLES.map(m => ({ muscle: m, prevu: prevu[m], fait: fait[m], cible: cibles[m], statut: statut(prevu, m),
    prioritaire: prio.includes(m), vise: vises.has(m), moinsQuePrevu: historique && prevu[m] > 0 && fait[m] < 0.8 * prevu[m],
    sansPrincipal: !state.templates.some(t => t.items.some(i => E0[i.exerciseId]?.musclePrincipal === m)) }));
  const D = Object.fromEntries(diagnostic.map(d => [d.muscle, d]));
  const notes = diagnostic.filter(d => d.vise && d.moinsQuePrevu && d.statut === 'retard').map(d => ({ type: 'regularite', muscle: d.muscle }));
  const ordre = MUSCLES.filter(m => vises.has(m) && D[m].statut === 'retard' && !D[m].moinsQuePrevu)
    .sort((a, b) => prio.includes(b) - prio.includes(a) || prevu[a] / cibles[a] - prevu[b] / cibles[b]);

  let etat = { templates: state.templates, exercises: state.exercises };
  const changements = [], creesBiblio = {}, epaules = !!alerteEpaules(state);
  let num = 0;
  const duree = (et, tid) => dureeCalculee(et.templates.find(t => t.id === tid), exDe(et)) * fact[tid];

  // Exercice à ajouter pour m dans tpl : tes exercices d'abord, puis la bibliothèque ; isolation, repos court,
  // absent des autres séances, nom. Écarte ceux qui chargeraient un muscle déjà « beaucoup ».
  function exercicePour(m, tpl) {
    const sem = volumePrevu(etat), dans = new Set(tpl.items.map(i => i.exerciseId));
    const ailleurs = new Set(etat.templates.filter(t => t.id !== tpl.id).flatMap(t => t.items.map(i => i.exerciseId)));
    const ok = x => x.musclePrincipal === m && !x.musclesSecondaires.some(s => sem[s] > 1.5 * cibles[s]);
    const noms = new Set(etat.exercises.map(e => norm(e.nom)));
    const miens = etat.exercises.filter(e => !e.archive && !dans.has(e.id) && ok(e));
    const biblio = BIBLIOTHEQUE.filter(x => ok(x) && !noms.has(norm(x.nom)) && !dans.has(creesBiblio[x.nom]?.id));
    const tri = (a, b) => iso(b.type) - iso(a.type) || MIEUX.test(b.nom) - MIEUX.test(a.nom) || biblio.includes(a) - biblio.includes(b) || reposDe(a) - reposDe(b)
      || ailleurs.has(a.id) - ailleurs.has(b.id) || a.nom.localeCompare(b.nom);
    const x = [...miens, ...biblio].sort(tri)[0];
    if (!x) return null;
    return biblio.includes(x) ? creesBiblio[x.nom] ??= depuisBibliotheque(x) : x;
  }
  const nouvelSi = ex => state.exercises.some(e => e.id === ex.id) ? {} : { nouvel: ex };
  const niveau = (tpl, m, E) => {
    const pm = tpl.items.map(i => E[i.exerciseId]?.musclePrincipal).filter(Boolean);
    return pm.includes(m) ? 0 : pm.some(x => GROUPE[x] === GROUPE[m]) ? 1 : pm.some(x => moitie(x) === moitie(m)) ? 2 : 3;
  };
  // Changements de la même séance dont c dépend : supersets et remplacements faits avant, ajout de l'exercice visé.
  const dependDe = c => changements.filter(p => p.templateId === c.templateId &&
    (p.type === 'superset' || p.type === 'remplacement' || (p.type === 'ajout' && p.exerciseId === c.exerciseId))).map(p => p.id);
  const sansExces = (c, avant = etat) => {
    const t0 = avant.templates.find(t => t.id === c.templateId), ap = appliquer(avant, c), t1 = ap.templates.find(t => t.id === c.templateId);
    const v0 = volSeance(t0, exDe(avant)), v1 = volSeance(t1, exDe(ap));
    return ap !== avant && MUSCLES.every(x => v1[x] <= Math.max(MAX_SEANCE, v0[x]));
  };
  const pousser = c => { const x = { id: 'c' + ++num, ...c }; x.depend = dependDe(x); changements.push(x); etat = appliquer(etat, x); return x; };

  for (const m of ordre) {
    const essais = new Set();
    for (let garde = 0; garde < 60; garde++) {
      const E = exDe(etat), sem = volumePrevu(etat), ecart = cibles[m] - sem[m];
      if (ecart < 0.5) break;
      const options = [];
      for (const tpl of etat.templates) {
        const vs = volSeance(tpl, E)[m], niv = niveau(tpl, m, E);
        if (vs + 1 > MAX_SEANCE) continue;
        for (const it of tpl.items) {
          if (E[it.exerciseId]?.musclePrincipal !== m) continue;
          const groupe = it.supersetGroupe ? tpl.items.filter(x => x.supersetGroupe === it.supersetGroupe) : [it];
          if (groupe.some(x => x.series >= MAX_EX)) continue;
          const c = { type: 'series', templateId: tpl.id, muscle: m, exerciseId: it.exerciseId, n: 1 };
          if (sansExces(c)) options.push({ c, sorte: 'a', niv, vs, series: it.series, apres: duree(appliquer(etat, c), tpl.id) });
        }
        // Un seul exercice ajouté par muscle et par séance : au-delà, on passe à une autre séance (répartition).
        const ex = changements.some(p => p.type === 'ajout' && p.muscle === m && p.templateId === tpl.id) ? null : exercicePour(m, tpl);
        if (ex) {
          const n = Math.max(1, Math.min(3, Math.max(2, Math.ceil(ecart)), Math.floor(MAX_SEANCE - vs)));
          const c = { type: 'ajout', templateId: tpl.id, muscle: m, exerciseId: ex.id, n, ...nouvelSi(ex) };
          if (sansExces(c)) options.push({ c, sorte: 'b', niv, vs, series: 0, apres: duree(appliquer(etat, c), tpl.id) });
        }
      }
      const sous = options.filter(o => o.apres <= dureeMax);
      const meilleur = l => l.sort((x, y) => x.niv - y.niv || x.vs - y.vs || x.series - y.series || x.apres - y.apres)[0];
      let choix = meilleur(sous.filter(o => o.sorte === 'a')) ?? meilleur(sous.filter(o => o.sorte === 'b'));
      if (!choix) { // faire de la place avant de dépasser : superset de muscles opposés, ou remplacer un exercice d'un muscle « beaucoup »
        const place = faireDeLaPlace(m, options, essais, E, sem);
        if (place) { pousser(place); continue; }
        choix = options.sort((x, y) => x.apres - y.apres || x.niv - y.niv || x.vs - y.vs)[0];
      }
      if (!choix) break;
      const c = choix.c, dernier = changements.findLast(p => p.templateId === c.templateId && p.type !== 'series');
      const fusion = c.type === 'series' && changements.find(p => (p.type === 'series' || p.type === 'ajout') && p.muscle === m
        && p.templateId === c.templateId && p.exerciseId === c.exerciseId && (!dernier || changements.indexOf(p) >= changements.indexOf(dernier)));
      if (fusion) { fusion.n += 1; etat = appliquer(etat, c); } else pousser(c);
    }
  }

  function faireDeLaPlace(m, options, essais, E, sem) {
    const tpls = [...new Set(options.map(o => o.c.templateId))].map(id => etat.templates.find(t => t.id === id))
      .sort((a, b) => niveau(a, m, E) - niveau(b, m, E));
    for (const tpl of tpls) {
      if (!essais.has('ss' + tpl.id)) {
        essais.add('ss' + tpl.id);
        const seuls = tpl.items.filter(x => !x.supersetGroupe && E[x.exerciseId]);
        const oppose = (p, q) => (GROUPE[p] === 'pousser' && GROUPE[q] === 'tirer') || (GROUPE[p] === 'tirer' && GROUPE[q] === 'pousser')
          || [p, q].sort().join() === 'ischios,quadriceps';
        let best = null;
        for (const a of seuls) for (const b of seuls) {
          const pa = E[a.exerciseId].musclePrincipal, pb = E[b.exerciseId].musclePrincipal;
          if (a === b || a.series !== b.series || !oppose(pa, pb) || tpl.items.indexOf(a) > tpl.items.indexOf(b)) continue;
          if (E[a.exerciseId].type === 'poly_bas' && E[b.exerciseId].type === 'poly_bas') continue; // deux gros mouvements de jambes enchaînés : trop épuisant
          const c = { type: 'superset', templateId: tpl.id, muscle: m, a: a.exerciseId, b: b.exerciseId };
          const gagne = duree(etat, tpl.id) - duree(appliquer(etat, c), tpl.id);
          if (gagne > 0 && (!best || gagne > best.gagne)) best = { c, gagne };
        }
        if (best) return best.c;
      }
      if (!essais.has('rp' + tpl.id)) {
        essais.add('rp' + tpl.id);
        const vs = volSeance(tpl, E)[m];
        for (const it of tpl.items) {
          const m2 = E[it.exerciseId]?.musclePrincipal;
          if (!m2 || m2 === m || sem[m2] <= 1.5 * cibles[m2] || vs + it.series > MAX_SEANCE) continue;
          if (etat.templates.flatMap(t => t.items).filter(x => E[x.exerciseId]?.musclePrincipal === m2).length < 2) continue;
          const ex = exercicePour(m, tpl);
          if (!ex) break;
          const c = { type: 'remplacement', templateId: tpl.id, muscle: m, ancienId: it.exerciseId, exerciseId: ex.id, ...nouvelSi(ex) };
          if (sansExces(c) && duree(appliquer(etat, c), tpl.id) <= dureeMax) return c;
        }
      }
    }
    return null;
  }

  // Écarts restants : ligne honnête.
  const fin = volumePrevu(etat);
  for (const m of ordre) if (cibles[m] - fin[m] >= 0.5) notes.push({ type: 'plein', muscle: m, manque: cibles[m] - fin[m] });

  // Chiffres affichés : rejoués dans l'ordre (gain par muscle, minutes, durée après, dépassement) et textes.
  let cur = { templates: state.templates, exercises: state.exercises };
  for (const c of changements) {
    const avant = volumePrevu(cur), dAv = duree(cur, c.templateId), apres = appliquer(cur, c), vAp = volumePrevu(apres), dAp = duree(apres, c.templateId);
    c.gain = Object.fromEntries(MUSCLES.filter(x => Math.abs(vAp[x] - avant[x]) > 1e-9).map(x => [x, gainPoints(avant[x], vAp[x])]));
    c.minutes = (dAp - dAv) / 60; c.dureeApres = dAp / 60; c.depasse = dAp > dureeMax;
    Object.assign(c, decrire(c, cur, apres, avant));
    cur = apres;
  }
  return { diagnostic, changements, notes, dureeMax: dureeMax / 60 };

  function decrire(c, av, ap, vol) {
    const E = exDe(ap), nomEx = id => E[id]?.nom ?? exDe(av)[id]?.nom ?? id;
    const tAv = av.templates.find(t => t.id === c.templateId), mus = NOM_MUSCLE[c.muscle];
    const etat0 = `${mus} : ${fmt(vol[c.muscle])} séries prévues par semaine, cible ${cibles[c.muscle]}.`;
    const autres = av.templates.filter(t => t.id !== c.templateId && volSeance(t, exDe(av))[c.muscle] + 1 > MAX_SEANCE).map(t => t.nom);
    if (c.type === 'series') {
      const it = tAv.items.find(x => x.exerciseId === c.exerciseId);
      const partenaires = it?.supersetGroupe ? tAv.items.filter(x => x !== it && x.supersetGroupe === it.supersetGroupe).map(x => nomEx(x.exerciseId)) : [];
      return { texte: `${tAv.nom} · ${nomEx(c.exerciseId)} : ${it.series} → ${it.series + c.n} séries`, sources: ['S4', 'S5', 'S32'],
        pourquoi: `${etat0} Un exercice que tu fais déjà, sans dépasser ${MAX_SEANCE} séries de ${mus.toLowerCase()} dans la séance : au-delà, une série de plus dans la même séance n'apporte presque plus rien.${partenaires.length ? ` ${partenaires.join(', ')} gagne aussi ${c.n} série${c.n > 1 ? 's' : ''} pour garder le superset aligné.` : ''}` };
    }
    if (c.type === 'ajout') {
      const ex = E[c.exerciseId], src = ['S4', 'S5', 'S32', 'S22'];
      let p = `${etat0} `;
      p += autres.length ? `${autres.join(' et ')} ${autres.length > 1 ? 'sont' : 'est'} déjà à ${MAX_SEANCE} séries pour ce muscle, alors les séries vont dans ${tAv.nom} : à volume égal, répartir sur plusieurs séances ne coûte rien.`
        : `Un exercice de plus dans ${tAv.nom} pour combler l'écart.`;
      if (iso(ex.type)) p += ' Isolation : plus de travail sur le muscle visé, repos plus court.';
      if (MIEUX.test(ex.nom)) { p += ' Le leg curl assis fait plus grossir les ischios que le couché.'; src.push('S16'); }
      if (c.muscle === 'pectoraux' && epaules && iso(ex.type)) { p += ' Ton programme charge déjà beaucoup les épaules : l\'isolation des pecs les épargne.'; src.push('S11', 'S12', 'S28'); }
      if (c.nouvel) p += ' Pris dans la bibliothèque : il sera ajouté à ta liste.';
      return { texte: `${tAv.nom} · ajouter ${ex.nom} (${c.n} série${c.n > 1 ? 's' : ''})`, sources: src, pourquoi: p };
    }
    if (c.type === 'remplacement') {
      const m2 = exDe(av)[c.ancienId].musclePrincipal;
      return { texte: `${tAv.nom} · remplacer ${nomEx(c.ancienId)} par ${nomEx(c.exerciseId)}`, sources: ['S4', 'S5'],
        pourquoi: `${etat0} ${NOM_MUSCLE[m2]} a déjà ${fmt(vol[m2])} séries prévues pour une cible de ${cibles[m2]} : il en garde assez, et la séance reste sous ta limite.` };
    }
    return { texte: `${tAv.nom} · ${nomEx(c.a)} + ${nomEx(c.b)} en superset`, sources: ['S33'],
      pourquoi: `Deux exercices de muscles opposés enchaînés : même croissance qu'en séries classiques, avec un seul repos par tour. Ça libère du temps pour ${mus.toLowerCase()} sans dépasser ta limite.` };
  }
}
