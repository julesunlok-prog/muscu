// Historique des séances : liste, détail modifiable, suppression.
import { lireNombre } from '../seance.js';
import { esc, icon, fmtKg, fmtNum, fmtDuree, fmtDateLongue, ouvrirFeuille, fermerFeuille, confirmer, toast } from '../ui.js';

const travail = w => w.entrees.flatMap(e => e.series.filter(s => !s.echauffement));

export function render(el, ctx) {
  const ws = [...ctx.state.workouts].sort((a, b) => b.debut.localeCompare(a.debut));
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Historique</h1></div>
    ${ws.length ? `<section class="card" style="padding:4px 8px"><ul class="liste">${ws.map(w => {
      const s = travail(w);
      return `<li><a class="liste-ligne" href="javascript:void 0" data-id="${esc(w.id)}">
        <div style="min-width:0"><b>${esc(w.nom)}</b><div class="faint">${esc(fmtDateLongue(w.debut))}</div></div>
        <div class="num faint" style="flex:none">${s.length} séries · ${fmtNum(s.reduce((t, x) => t + x.kg * x.reps, 0), 0)} kg<br>${w.fin && w.fin !== w.debut ? fmtDuree(Date.parse(w.fin) - Date.parse(w.debut)) : ''}</div>
        ${icon('chevron', 'icone chevron')}</a></li>`;
    }).join('')}</ul></section>`
    : `<div class="empty-state"><div class="empty-title">Aucune séance</div><div class="empty-sub">Termine ta première séance, ou importe ton historique Strong dans Réglages.</div>
       <a class="btn btn-secondary" href="#/reglages">Aller aux réglages</a></div>`}`;
  el.onclick = e => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id) { e.preventDefault(); detail(ctx, ctx.state.workouts.find(w => w.id === id)); }
  };
}

function detail(ctx, w) {
  const f = ouvrirFeuille({
    titre: `${w.nom} · ${fmtDateLongue(w.debut)}`,
    corps: w.entrees.map((e, ei) => `<div class="form-group"><div class="label">${esc(e.nomExercice)}</div>
      <table class="series"><thead><tr><th>Série</th><th>kg</th><th>Reps</th></tr></thead><tbody>
      ${e.series.map((s, si) => `<tr><td class="n">${s.echauffement ? 'É' : si + 1}</td>
        <td><input data-ei="${ei}" data-si="${si}" data-champ="kg" inputmode="decimal" value="${fmtKg(s.kg)}" aria-label="Charge"></td>
        <td><input data-ei="${ei}" data-si="${si}" data-champ="reps" inputmode="numeric" value="${s.reps}" aria-label="Répétitions"></td></tr>`).join('')}
      </tbody></table></div>`).join(''),
    pied: '<button class="btn btn-danger" data-p="suppr">Supprimer</button><button class="btn btn-primary" data-p="ok">Enregistrer</button>',
  });
  f.querySelector('.feuille-pied').addEventListener('click', async ev => {
    const p = ev.target.closest('[data-p]')?.dataset.p;
    if (p === 'ok') {
      const copie = structuredClone(w);
      f.querySelectorAll('input[data-champ]').forEach(i => { copie.entrees[i.dataset.ei].series[i.dataset.si][i.dataset.champ] = lireNombre(i.value); });
      copie.entrees = copie.entrees.map(e => ({ ...e, series: e.series.filter(s => s.kg != null && s.kg >= 0 && s.reps > 0) })).filter(e => e.series.length);
      ctx.maj(s => ({ ...s, workouts: copie.entrees.length ? s.workouts.map(x => x.id === w.id ? copie : x) : s.workouts.filter(x => x.id !== w.id) }));
      fermerFeuille(f); toast('Séance modifiée.');
    }
    if (p === 'suppr' && await confirmer('Cette séance sera retirée de l’historique et de l’analyse. Ça ne peut pas être annulé.', { titre: 'Supprimer la séance ?', ok: 'Supprimer', danger: true })) {
      ctx.maj(s => ({ ...s, workouts: s.workouts.filter(x => x.id !== w.id) }));
      fermerFeuille(f); toast('Séance supprimée.');
    }
  });
}
