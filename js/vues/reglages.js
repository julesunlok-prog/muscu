// Réglages : thème, muscles prioritaires, cibles de volume, sauvegarde, import Strong, sources.
import { exporterJSON, importerJSON } from '../store.js';
import { lireStrong, nomsExercicesStrong, correspondanceAuto, versWorkouts } from '../strong-import.js';
import { ciblesVolume } from '../moteur.js';
import { lireNombre } from '../seance.js';
import { MUSCLES, NOM_MUSCLE } from '../profils.js';
import { SOURCES } from '../seed.js';
import { esc, icon, ouvrirFeuille, fermerFeuille, confirmer, toast, telecharger } from '../ui.js';

export function render(el, ctx) {
  const { settings } = ctx.state;
  const cibles = ciblesVolume(ctx.state);
  const theme = settings.theme ?? 'auto';
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Réglages</h1></div>
    <section class="card">
      <h2 class="card-title" style="margin-bottom:10px">Apparence</h2>
      <div class="seg" role="group" aria-label="Thème">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) =>
        `<button data-theme="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</div>
    </section>

    <section class="card">
      <h2 class="card-title" style="margin-bottom:6px">Muscles prioritaires et cibles</h2>
      <p class="faint" style="margin:0 0 10px">Séries par semaine. Un muscle prioritaire vise 14 par défaut, les autres 10.</p>
      ${MUSCLES.map(m => `<div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--rule)">
        <label class="case" style="flex:1"><input type="checkbox" data-prio="${m}" ${settings.musclesPrioritaires.includes(m) ? 'checked' : ''}>${esc(NOM_MUSCLE[m])}</label>
        <input class="form-control" style="width:72px;height:36px;text-align:center" inputmode="numeric" data-cible="${m}"
          value="${settings.ciblesVolume[m] ?? ''}" placeholder="${cibles[m]}" aria-label="Cible ${esc(NOM_MUSCLE[m])}"></div>`).join('')}
    </section>

    <section class="card">
      <h2 class="card-title" style="margin-bottom:6px">Sauvegarde</h2>
      <p class="faint" style="margin:0 0 12px">Tes données restent sur ce téléphone. Exporte une sauvegarde chaque mois et garde-la dans Fichiers ou iCloud.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-secondary" data-act="exporter">${icon('telecharger')}Exporter la sauvegarde</button>
        <label class="btn btn-secondary" style="margin:0">${icon('importer')}Importer une sauvegarde<input type="file" accept=".json,application/json" data-fichier="sauvegarde" class="hidden"></label>
        <label class="btn btn-secondary" style="margin:0">${icon('importer')}Importer depuis Strong (.csv)<input type="file" accept=".csv,text/csv" data-fichier="strong" class="hidden"></label>
      </div>
      <p class="faint" style="margin:10px 0 0">Dans Strong : Profil → Réglages → Export Strong Data.</p>
    </section>

    <section class="card">
      <h2 class="card-title" style="margin-bottom:8px">Sources des conseils</h2>
      <ul class="liste">${Object.entries(SOURCES).map(([k, s]) =>
        `<li><a class="liste-ligne" href="${esc(s.url)}" target="_blank" rel="noopener"><span><b>${k}</b> · ${esc(s.titre)}</span></a></li>`).join('')}</ul>
    </section>
    <p class="faint" style="text-align:center" data-version></p>`;
  // La version est le nom du cache du service worker (VERSION dans sw.js).
  window.caches?.keys().then(k => { const v = k.find(x => x.startsWith('muscu-')); const p = el.querySelector('[data-version]'); if (v && p) p.textContent = `Version ${v.replace('muscu-', '')}`; }).catch(() => {});

  el.onclick = e => {
    const t = e.target.closest('[data-theme]')?.dataset.theme;
    if (t) { ctx.maj(s => ({ ...s, settings: { ...s.settings, theme: t } })); appliquer(t); }
    if (e.target.closest('[data-act="exporter"]')) exporter(ctx.state);
  };
  el.onchange = async e => {
    const i = e.target;
    if (i.dataset.prio) ctx.maj(s => {
      const set = new Set(s.settings.musclesPrioritaires);
      i.checked ? set.add(i.dataset.prio) : set.delete(i.dataset.prio);
      return { ...s, settings: { ...s.settings, musclesPrioritaires: MUSCLES.filter(m => set.has(m)) } };
    });
    if (i.dataset.cible) ctx.maj(s => {
      const c = { ...s.settings.ciblesVolume }, n = lireNombre(i.value);
      if (n == null) delete c[i.dataset.cible]; else c[i.dataset.cible] = n;
      return { ...s, settings: { ...s.settings, ciblesVolume: c } };
    });
    if (i.dataset.fichier && i.files[0]) {
      const texte = await i.files[0].text();
      i.value = '';
      if (i.dataset.fichier === 'sauvegarde') importerSauvegarde(ctx, texte);
      else importerStrong(ctx, texte);
    }
  };
}

function appliquer(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}

async function exporter(state) {
  if (await telecharger(`muscu-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, exporterJSON(state))) toast('Sauvegarde exportée.');
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
  const auto = correspondanceAuto(noms, ctx.state);
  const exos = ctx.state.exercises.filter(e => !e.archive).sort((a, b) => a.nom.localeCompare(b.nom));
  const f = ouvrirFeuille({
    titre: 'Associer les exercices',
    corps: `<p class="faint" style="margin-top:0">Pour chaque exercice Strong, choisis l’exercice de l’app correspondant. « Ignorer » ne l’importe pas.</p>
      ${noms.map((n, i) => `<div class="form-group"><label for="m${i}">${esc(n)}</label><select id="m${i}" class="form-control" data-nom="${esc(n)}">
        <option value="">Ignorer</option>${exos.map(e => `<option value="${esc(e.id)}" ${auto[n] === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></div>`).join('')}`,
    pied: '<button class="btn btn-texte" data-fermer>Annuler</button><button class="btn btn-primary" data-p="ok">Importer</button>',
  });
  f.querySelector('[data-p="ok"]').onclick = () => {
    const corr = Object.fromEntries([...f.querySelectorAll('select[data-nom]')].map(s => [s.dataset.nom, s.value || null]));
    const ws = versWorkouts(lignes, corr, ctx.state);
    ctx.maj(s => ({ ...s, workouts: [...s.workouts, ...ws].sort((a, b) => a.debut.localeCompare(b.debut)) }));
    fermerFeuille(f);
    toast(ws.length ? `${ws.length} séance${ws.length > 1 ? 's' : ''} importée${ws.length > 1 ? 's' : ''}.` : 'Rien de nouveau à importer.', ws.length ? 'success' : 'info');
  };
}
