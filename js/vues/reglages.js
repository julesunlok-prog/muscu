// Réglages en 4 groupes : entraînement, alarme et montre, mes données, l'app. Les détails s'ouvrent dans des feuilles.
import { exporterJSON, importerJSON } from '../store.js';
import { lireStrong, nomsExercicesStrong, correspondanceAuto, versWorkouts, programmesDepuis } from '../strong-import.js';
import { BIBLIOTHEQUE, correspondanceAvecBibliotheque, creerDepuisCorrespondance, deviner } from '../bibliotheque.js';
import { lireNombre } from '../seance.js';
import { activer, tester, desactiver, etat, SERVEUR } from '../alarme.js';
import { activerMontre, desactiverMontre, etatMontre, cleMontre } from '../montre.js';
import { MUSCLES, NOM_MUSCLE, MATERIELS } from '../profils.js';
import { SOURCES } from '../seed.js';
import { esc, icon, ouvrirFeuille, fermerFeuille, confirmer, toast, telecharger, fmtDate } from '../ui.js';

// Une ligne de liste qui ouvre une feuille de détail.
const ligne = (attr, titre, droite = '') => `<li><button class="liste-ligne" ${attr}><span>${titre}</span>
  <span class="ligne-droite">${droite}${icon('chevron', 'icone chevron')}</span></button></li>`;

export function render(el, ctx) {
  const { settings } = ctx.state;
  const theme = settings.theme ?? 'auto';
  const e = etat(), montre = etatMontre() === 'activee';
  const badge = (on, texte) => `<span class="badge ${on ? 'pos' : ''}">${texte}</span>`;
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Réglages</h1></div>

    <h2 class="groupe-titre">Entraînement</h2>
    <section class="card">
      <h3 class="card-title" style="font-size:16px;margin-bottom:4px">Muscles prioritaires</h3>
      <p class="faint" style="margin:0 0 10px">16 à 20 séries par semaine, au lieu de 10 à 20 pour les autres.</p>
      <div class="puces-grille" role="group" aria-label="Muscles prioritaires">${MUSCLES.map(m =>
        `<button data-prio="${m}" aria-pressed="${settings.musclesPrioritaires.includes(m)}">${esc(NOM_MUSCLE[m])}</button>`).join('')}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:16px">
        <label for="duree-max" style="flex:1;font-size:14px;margin:0">Durée max d’une séance (min)<span class="faint" style="display:block;font-size:12px">Utilisée par « Analyser mes séances ». 80 par défaut.</span></label>
        <input id="duree-max" class="form-control" style="width:72px;height:36px;text-align:center" inputmode="numeric" data-duree-max
          value="${settings.dureeMax ?? ''}" placeholder="80"></div>
    </section>

    <h2 class="groupe-titre">Alarme et montre</h2>
    <section class="card"><ul class="liste">
      ${ligne('data-ouvrir="alarme"', 'Alarme de repos', badge(e === 'activee', STATUT_ALARME[e]))}
      ${ctx.demo ? '' : ligne('data-ouvrir="montre"', 'Montre Garmin', badge(montre, montre ? 'Activée' : 'Désactivée'))}
    </ul></section>

    <h2 class="groupe-titre">Mes données</h2>
    <section class="card">
      <p class="faint" style="margin:0 0 12px">Dernière sauvegarde : <b>${settings.derniereSauvegarde ? fmtDate(settings.derniereSauvegarde) : 'jamais'}</b>.
        Tes données restent sur ce téléphone : retirer l’app de l’écran d’accueil les efface.</p>
      <button class="btn btn-primary btn-bloc" data-act="exporter">${icon('telecharger')}Exporter la sauvegarde</button>
      <ul class="liste" style="margin-top:8px">${ligne('data-ouvrir="importer"', 'Importer…')}</ul>
    </section>

    <h2 class="groupe-titre">Idées et corrections</h2>
    <section class="card"><ul class="liste">${ligne('data-ouvrir="idees"', 'Proposer une idée ou signaler un bug')}</ul></section>

    <h2 class="groupe-titre">L’app</h2>
    <section class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;padding-left:8px"><span>Thème</span>
        <div class="seg" role="group" aria-label="Thème">${[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) =>
          `<button data-theme="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</div></div>
      <ul class="liste">
        <li><a class="liste-ligne" href="installer.html?partage"><span>Partager l’app (QR code)</span>${icon('chevron', 'icone chevron')}</a></li>
        ${ctx.demo ? '' : ligne('data-lancer-demo', 'Voir la démo')}
        ${ligne('data-ouvrir="sources"', 'Sources des conseils')}
      </ul>
    </section>
    <p class="faint" style="text-align:center" data-version></p>`;
  // La version est le nom du cache du service worker (VERSION dans sw.js).
  window.caches?.keys().then(k => { const v = k.find(x => x.startsWith('muscu-')); const p = el.querySelector('[data-version]'); if (v && p) p.textContent = `Version ${v.replace('muscu-', '')}`; }).catch(() => {});

  // Même gestionnaire pour l'écran et ses feuilles (ajoutées à <body>, hors de el).
  const clic = e => {
    const feuille = e.target.closest('.feuille');
    const fini = () => { if (feuille) fermerFeuille(feuille); ctx.rendre(); };
    // button : <html> porte aussi data-theme (thème Clair/Sombre choisi) ; sans ça, tout toucher redessinait l'écran.
    const t = e.target.closest('button[data-theme]')?.dataset.theme;
    if (t) { ctx.maj(s => ({ ...s, settings: { ...s.settings, theme: t } })); appliquer(t); }
    const p = e.target.closest('button[data-prio]')?.dataset.prio;
    if (p) ctx.maj(s => {
      const set = new Set(s.settings.musclesPrioritaires);
      set.has(p) ? set.delete(p) : set.add(p);
      return { ...s, settings: { ...s.settings, musclesPrioritaires: MUSCLES.filter(m => set.has(m)) } };
    });
    const o = e.target.closest('[data-ouvrir]')?.dataset.ouvrir;
    if (o) { const f = ouvrirFeuille(FEUILLES[o]()); f.addEventListener('click', clic); f.onchange = change; if (o === 'idees') afficherIdees(f); }
    if (feuille && e.target.closest('[data-idee-envoyer]')) envoyerIdee(feuille);
    const sup = e.target.closest('[data-idee-suppr]')?.dataset.ideeSuppr;
    if (feuille && sup) confirmer('Supprimer cette idée pour tout le monde ?', { titre: 'Supprimer', ok: 'Supprimer', danger: true })
      .then(ok => ok && afficherIdees(feuille, idees('/idees/supprimer', { n: +sup })));
    if (feuille && e.target.closest('[data-idee-admin]')) {
      const c = feuille.querySelector('#idee-code')?.value.trim();
      if (c) { ecrireAdmin(c); afficherIdees(feuille); }
      else if (codeAdmin()) { ecrireAdmin(null); afficherIdees(feuille); }
      else feuille.querySelector('[data-idee-admin-zone]').innerHTML = `<div style="display:flex;gap:8px;margin-top:8px">
        <input id="idee-code" class="form-control" placeholder="Code" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="btn btn-secondary" data-idee-admin>Valider</button></div>`;
    }
    if (e.target.closest('[data-act="exporter"]')) sauvegarder(ctx);
    const a = e.target.closest('[data-alarme]')?.dataset.alarme;
    // activer() est appelée sans attente avant : iOS n'accorde la permission de notifications qu'en réponse directe au toucher.
    if (a === 'activer') activer().then(r => {
      toast(MESSAGES_ALARME[r], r === 'ok' ? undefined : 'error');
      if (r === 'ok') fini();
    });
    if (a === 'tester') tester().then(ok => toast(ok ? 'Notification dans 10 s : verrouille l’iPhone pour essayer.' : 'Pas de réponse du serveur : vérifie le réseau.', ok ? 'info' : 'error'));
    if (a === 'desactiver') desactiver().then(() => { toast('Alarme désactivée.'); fini(); });
    const m = e.target.closest('button[data-montre]')?.dataset.montre;
    if (m === 'activer') activerMontre(document.querySelector('#montre-code').value.trim()).then(r => {
      toast(r === 'ok' ? 'Montre activée.' : MESSAGES_ALARME[r], r === 'ok' ? undefined : 'error');
      if (r === 'ok') fini();
    });
    if (m === 'copier') navigator.clipboard?.writeText(cleMontre()).then(() => toast('Clé copiée. Colle-la dans Garmin Connect → app Muscu → Réglages.'), () => toast('Copie impossible : sélectionne la clé à la main.', 'error'));
    if (m === 'desactiver') desactiverMontre().then(() => { toast('Montre désactivée.'); fini(); });
  };
  const change = async e => {
    const i = e.target;
    if ('dureeMax' in i.dataset) ctx.maj(s => {
      const n = lireNombre(i.value), { dureeMax, ...reste } = s.settings;
      return { ...s, settings: n == null ? reste : { ...reste, dureeMax: Math.min(180, Math.max(30, Math.round(n))) } };
    });
    if (i.dataset.ideeFait) afficherIdees(i.closest('.feuille'), idees('/idees/fait', { n: +i.dataset.ideeFait, fait: i.checked }));
    if (i.dataset.fichier && i.files[0]) {
      const texte = await i.files[0].text();
      i.value = '';
      fermerFeuille(i.closest('.feuille'));
      if (i.dataset.fichier === 'sauvegarde') importerSauvegarde(ctx, texte);
      else importerStrong(ctx, texte);
    }
  };
  el.onclick = clic;
  el.onchange = change;
}

const STATUT_ALARME = { activee: 'Activée', desactivee: 'Désactivée', refusee: 'Refusée', indisponible: 'Non disponible' };
const MESSAGES_ALARME = {
  ok: 'Alarme activée.', code: 'Code refusé.', reseau: 'Pas de réponse du serveur : vérifie le réseau.',
  refuse: 'Notifications refusées : Réglages iOS → Notifications → Muscu.',
  indisponible: 'Ajoute l’app à l’écran d’accueil (iOS 16.4+) pour activer l’alarme.',
};

// ---------- Boîte à idées (temporaire) : liste commune sur le serveur, l'admin (secret ADMIN_IDEES du Worker) coche ce qui est fait ----------
const K_ADMIN = 'muscu:idees-code';
const codeAdmin = () => { try { return localStorage.getItem(K_ADMIN); } catch { return null; } };
const ecrireAdmin = c => { try { c ? localStorage.setItem(K_ADMIN, c) : localStorage.removeItem(K_ADMIN); } catch { /* stockage indisponible */ } };

// La liste à jour, ou le statut HTTP (0 = réseau).
async function idees(route, corps = {}) {
  try {
    const r = await fetch(SERVEUR + route, { method: 'POST', body: JSON.stringify(corps), signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', ...(codeAdmin() ? { Authorization: `Bearer ${codeAdmin()}` } : {}) } });
    return r.ok ? (await r.json()).idees : r.status;
  } catch { return 0; }
}

async function afficherIdees(f, promesse = idees('/idees/lire')) {
  const zone = f.querySelector('[data-idees]'), liste = await promesse;
  if (!f.isConnected) return;
  if (liste === 401) { ecrireAdmin(null); toast('Code refusé.', 'error'); return afficherIdees(f); }
  if (!Array.isArray(liste)) { zone.innerHTML = '<p class="faint">Pas de réponse du serveur : vérifie le réseau.</p>'; return; }
  const admin = !!codeAdmin();
  const triees = [...liste].sort((a, b) => a.fait - b.fait || b.n - a.n); // à faire d'abord, les plus récentes en haut
  zone.innerHTML = triees.length ? `<ul class="liste">${triees.map(i => `<li class="idee">
      ${admin ? `<label class="case" style="flex:1"><input type="checkbox" data-idee-fait="${i.n}" ${i.fait ? 'checked' : ''}><span>${esc(i.texte)}</span></label>
        <button class="btn btn-texte" data-idee-suppr="${i.n}" aria-label="Supprimer">${icon('poubelle')}</button>`
      : `<span style="flex:1">${esc(i.texte)}</span>${i.fait ? '<span class="badge pos">Ajoutée</span>' : ''}`}</li>`).join('')}</ul>`
    : '<p class="faint">Aucune idée pour l’instant. Sois le premier !</p>';
  f.querySelector('[data-idee-admin-zone]').innerHTML = `<button class="btn btn-texte" data-idee-admin>${admin ? 'Quitter le mode admin' : 'Je suis l’admin'}</button>`;
}

async function envoyerIdee(f) {
  const champ = f.querySelector('#idee-texte'), texte = champ.value.trim();
  if (texte.length < 3) return toast('Écris ton idée d’abord.', 'error');
  const r = idees('/idees', { texte });
  const liste = await r;
  if (Array.isArray(liste)) { champ.value = ''; toast('Merci, c’est noté !'); }
  else toast(liste === 409 ? 'La liste est pleine pour l’instant.' : 'Pas de réponse du serveur : vérifie le réseau.', 'error');
  afficherIdees(f, r);
}

const FEUILLES = {
  idees: () => ({ titre: 'Idées et corrections', corps: `<p class="faint" style="margin:0 0 10px">Une idée d’ajout ou un bug ? Écris-le ici : tout le monde voit la liste, et « Ajoutée » s’affiche quand c’est fait.</p>
    <textarea id="idee-texte" class="form-control" maxlength="300" placeholder="Ex. : pouvoir noter mon poids de corps"></textarea>
    <button class="btn btn-primary btn-bloc" style="margin-top:8px" data-idee-envoyer>Envoyer</button>
    <div data-idees style="margin-top:16px"><p class="faint">Chargement…</p></div>
    <div data-idee-admin-zone style="text-align:center;margin-top:8px"></div>` }),
  // Alarme de repos (spec 2026-11-15) : notification à la fin du repos, même app fermée.
  alarme: () => {
    const e = etat();
    return { titre: 'Alarme de repos', corps: `<p class="faint" style="margin:0 0 12px">Une notification à la fin de chaque repos, même app fermée. Sonne si le téléphone n’est pas en silencieux, sinon vibre.</p>
      ${e === 'activee' ? `<div style="display:flex;gap:8px">
          <button class="btn btn-secondary" style="flex:1" data-alarme="tester">Tester</button>
          <button class="btn btn-texte" style="flex:1" data-alarme="desactiver">Désactiver</button></div>`
        : `${e === 'refusee' ? `<p class="faint" style="margin:0 0 10px">${MESSAGES_ALARME.refuse}</p>` : ''}
        ${e === 'indisponible' ? `<p class="faint" style="margin:0 0 10px">${MESSAGES_ALARME.indisponible}</p>` : ''}
        <button class="btn btn-primary btn-bloc" data-alarme="activer">Activer</button>`}` };
  },
  // Montre Garmin (spec 2026-11-15-montre-garmin) : valider ses séries au poignet.
  montre: () => {
    const on = etatMontre() === 'activee';
    return { titre: 'Montre Garmin', corps: `<p class="faint" style="margin:0 0 12px">Valide tes séries depuis une montre Garmin. La séance en cours passe par le serveur et y est effacée à la fin.</p>
      ${on ? `<div class="form-group"><label for="montre-cle">Clé de la montre</label>
          <input id="montre-cle" class="form-control" readonly value="${esc(cleMontre())}"></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" style="flex:1" data-montre="copier">Copier la clé</button>
          <button class="btn btn-texte" style="flex:1" data-montre="desactiver">Désactiver</button></div>`
        : `<div class="form-group"><label for="montre-code">Code</label>
          <input id="montre-code" class="form-control" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        <button class="btn btn-primary btn-bloc" data-montre="activer">Activer</button>`}` };
  },
  importer: () => ({ titre: 'Importer', corps: `<div style="display:flex;flex-direction:column;gap:8px">
      <label class="btn btn-secondary" style="margin:0">${icon('importer')}Importer une sauvegarde<input type="file" accept=".json,application/json" data-fichier="sauvegarde" class="hidden"></label>
      <label class="btn btn-secondary" style="margin:0">${icon('importer')}Importer depuis Strong ou Hevy (.csv)<input type="file" accept=".csv,text/csv" data-fichier="strong" class="hidden"></label>
    </div>
    <p class="faint" style="margin:10px 0 0">Une sauvegarde remplace toutes tes données. Strong ou Hevy ajoute tes anciennes séances.</p>
    <p class="faint" style="margin:6px 0 0">Dans Strong : Profil → Réglages → Export Strong Data. Dans Hevy : Profil → Réglages → Exporter les données (export des séances).</p>` }),
  sources: () => ({ titre: 'Sources des conseils', corps: `<ul class="liste">${Object.entries(SOURCES).map(([k, s]) =>
    `<li><a class="liste-ligne" href="${esc(s.url)}" target="_blank" rel="noopener"><span><b>${k}</b> · ${esc(s.titre)}</span></a></li>`).join('')}</ul>` }),
};

function appliquer(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}

// Aussi appelée par le bandeau de rappel (app.js).
export async function sauvegarder(ctx) {
  if (!await telecharger(`muscu-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, exporterJSON(ctx.state))) return;
  ctx.maj(s => ({ ...s, settings: { ...s.settings, derniereSauvegarde: new Date().toISOString(), rappelReporte: null } }));
  toast('Sauvegarde exportée. Garde le fichier dans Fichiers ou iCloud Drive.');
}

async function importerSauvegarde(ctx, texte) {
  let s;
  try { s = importerJSON(texte); } catch (e) { return toast(e.message, 'error'); }
  if (!await confirmer(`Toutes tes données actuelles seront remplacées par cette sauvegarde (${s.workouts.length} séances). Exporte d’abord une sauvegarde si besoin.`,
    { titre: 'Remplacer toutes les données ?', ok: 'Remplacer', danger: true })) return;
  ctx.remplacerEtat(s);
  toast('Sauvegarde importée.');
}

function importerStrong(ctx, texte) {
  let lignes;
  try { ({ lignes } = lireStrong(texte)); } catch (e) { return toast(e.message, 'error'); }
  if (!lignes.length) return toast('Aucune série avec charge et reps dans ce fichier.', 'error');
  const noms = nomsExercicesStrong(lignes);
  const auto = correspondanceAvecBibliotheque(noms, ctx.state, correspondanceAuto(noms, ctx.state));
  const exos = ctx.state.exercises.filter(e => !e.archive).sort((a, b) => a.nom.localeCompare(b.nom));
  const biblio = BIBLIOTHEQUE.map((b, i) => [i, b]).sort((x, y) => x[1].nom.localeCompare(y[1].nom));
  const compte = v => noms.filter(n => v(auto[n])).length;
  const recap = [[compte(v => v && !v.startsWith('biblio:') && v !== 'creer'), 'Reliés à tes exercices'],
    [compte(v => v?.startsWith('biblio:')), 'Créés depuis la bibliothèque'], [compte(v => v === 'creer'), 'Créés sous leur nom Strong'],
    [compte(v => !v), 'Ignorés (rien de proche)']].filter(([nb]) => nb).map(([nb, t]) => `<li>${t} : <b>${nb}</b></li>`).join('');
  const f = ouvrirFeuille({
    titre: 'Importer',
    corps: `<ul style="margin:0 0 8px;padding-left:18px">${recap}</ul>
      <label class="case"><input type="checkbox" data-programmes checked> Recréer mes programmes (séances faites au moins 2 fois : ordre des exercices et nombre de séries)</label>
      <p class="faint">L’export ne contient ni les repos ni les supersets : les repos sont ceux de l’app selon le type d’exercice, et les supersets se refont avec « SS » dans le programme. Les charges et les reps de chaque série sont toutes importées.</p>
      <details><summary>Vérifier les exercices (${noms.length})</summary>
      ${noms.map((n, i) => { const d = auto[n] === 'creer' ? deviner(n) : null; return `<div class="form-group"><label for="m${i}">${esc(n)}</label><select id="m${i}" class="form-control" data-nom="${esc(n)}">
        <option value="">Ignorer</option>${d ? `<option value="creer" selected>Créer « ${esc(n)} » (${esc(NOM_MUSCLE[d.musclePrincipal])} · ${esc(MATERIELS[d.materiel].nom)})</option>` : ''}
        <optgroup label="Mes exercices">${exos.map(e => `<option value="${esc(e.id)}" ${auto[n] === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</optgroup>
        <optgroup label="Créer depuis la bibliothèque">${biblio.map(([j, b]) => `<option value="biblio:${j}" ${auto[n] === 'biblio:' + j ? 'selected' : ''}>${esc(b.nom)}</option>`).join('')}</optgroup></select></div>`; }).join('')}
      </details>`,
    pied: '<button class="btn btn-texte" data-fermer>Annuler</button><button class="btn btn-primary" data-p="ok">Importer</button>',
  });
  f.querySelector('[data-p="ok"]').onclick = () => {
    const choix = Object.fromEntries([...f.querySelectorAll('select[data-nom]')].map(s => [s.dataset.nom, s.value || null]));
    const { corr, nouveaux } = creerDepuisCorrespondance(choix);
    const avant = { ...ctx.state, exercises: [...ctx.state.exercises, ...nouveaux] };
    const tps = f.querySelector('[data-programmes]').checked ? programmesDepuis(lignes, corr, avant) : [];
    const ws = versWorkouts(lignes, corr, { ...avant, templates: [...avant.templates, ...tps] });
    const servis = new Set([...ws.flatMap(w => w.entrees.map(x => x.exerciseId)), ...tps.flatMap(t => t.items.map(x => x.exerciseId))]);
    ctx.maj(s => ({ ...s, exercises: [...s.exercises, ...nouveaux.filter(e => servis.has(e.id))], templates: [...s.templates, ...tps],
      workouts: [...s.workouts, ...ws].sort((a, b) => a.debut.localeCompare(b.debut)) }));
    fermerFeuille(f);
    const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    toast(ws.length || tps.length ? `${pl(ws.length, 'séance')} et ${pl(tps.length, 'programme')} importés.` : 'Rien de nouveau à importer.', ws.length ? 'success' : 'info');
  };
}
