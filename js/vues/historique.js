// Historique des séances : liste, détail modifiable, suppression.
import { lireNombre, modifierSeanceHistorique } from '../seance.js';
import { tonnage } from '../moteur.js';
import { absences } from '../semaine.js';
import { esc, icon, fmtKg, fmtNum, fmtDuree, fmtDateLongue, ouvrirFeuille, fermerFeuille, confirmer, toast } from '../ui.js';

const travail = w => w.entrees.flatMap(e => e.series.filter(s => !s.echauffement));
// Données de la montre Garmin, valeurs brutes sans verdict (spec montre).
const fc = m => m?.fcMoy != null ? `${m.fcMoy}${m.fcMax != null ? ` / ${m.fcMax}` : ''}` : '–';
function ligneMontre(m) {
  if (!m) return '';
  const parts = [m.calories != null && `${m.calories} kcal`, m.fcMoy != null && `FC ${fc(m)}`, m.bodyBattery != null && `Body Battery ${m.bodyBattery}`,
    m.stress != null && `stress ${m.stress}`, m.effet != null && `effet ${fmtNum(m.effet, 1)}`].filter(Boolean);
  return parts.length ? `<p class="faint" style="margin:0 0 12px">Montre : ${parts.join(' · ')}</p>` : '';
}

export function render(el, ctx) {
  // Séances, puis séances sautées ou ratées de la semaine type (lignes grises, sans détail), de la plus récente à la plus ancienne.
  const nomDe = id => ctx.state.templates.find(t => t.id === id)?.nom ?? 'Séance';
  const ws = [...ctx.state.workouts.map(w => ({ w, date: w.debut })), ...absences(ctx.state).map(a => ({ a, date: a.date }))]
    .sort((x, y) => y.date.localeCompare(x.date));
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Historique</h1></div>
    ${ws.length ? `<section class="card" style="padding:4px 8px"><ul class="liste">${ws.map(({ w, a }) => {
      if (a) return `<li class="absence"><span><b>${esc(nomDe(a.templateId))}</b> · ${a.type === 'sautee' ? 'sautée' : 'ratée'}</span><span>${esc(fmtDateLongue(a.date))}</span></li>`;
      const s = travail(w);
      return `<li><a class="liste-ligne" href="javascript:void 0" data-id="${esc(w.id)}">
        <div style="min-width:0"><b>${esc(w.nom)}</b><div class="faint">${esc(fmtDateLongue(w.debut))}</div></div>
        <div class="num faint" style="flex:none">${s.length} séries · ${fmtNum(s.reduce((t, x) => t + tonnage(x), 0), 0)} kg<br>${w.fin && w.fin !== w.debut ? fmtDuree(Date.parse(w.fin) - Date.parse(w.debut)) : ''}</div>
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
    corps: ligneMontre(w.montre) + w.entrees.map((e, ei) => { const avecFc = e.series.some(s => s.montre?.fcMoy != null); return `<div class="form-group"><div class="label">${esc(e.nomExercice)}</div>
      <table class="series"><thead><tr><th>Série</th><th>kg</th><th>Reps</th>${avecFc ? '<th>FC</th>' : ''}</tr></thead><tbody>
      ${e.series.map((s, si) => `<tr><td class="n">${s.echauffement ? 'É' : si + 1}</td>
        <td><input data-ei="${ei}" data-si="${si}" data-champ="kg" inputmode="decimal" value="${fmtKg(s.kg)}" aria-label="Charge"></td>
        <td><input data-ei="${ei}" data-si="${si}" data-champ="reps" inputmode="numeric" value="${s.reps}" aria-label="Répétitions"></td>${avecFc ? `<td class="num faint">${fc(s.montre)}</td>` : ''}</tr>${s.degressive?.reps ? `<tr><td></td><td colspan="${avecFc ? 3 : 2}" class="faint" style="text-align:left;font-size:13px">↳ Dégressive : +${s.degressive.reps} reps${s.degressive.kgFin != null ? ` jusqu’à ${fmtKg(s.degressive.kgFin)} kg` : ''}</td></tr>` : ''}`).join('')}
      </tbody></table></div>`; }).join(''),
    pied: '<button class="btn btn-danger" data-p="suppr">Supprimer</button><button class="btn btn-primary" data-p="ok">Enregistrer</button>',
  });
  f.querySelector('.feuille-pied').addEventListener('click', async ev => {
    const p = ev.target.closest('[data-p]')?.dataset.p;
    if (p === 'ok') {
      const valeurs = [...f.querySelectorAll('input[data-champ]')].map(i => ({ ei: +i.dataset.ei, si: +i.dataset.si, champ: i.dataset.champ, valeur: lireNombre(i.value) }));
      ctx.maj(s => {
        const actuel = s.workouts.find(x => x.id === w.id);
        if (!actuel) return s;
        const m = modifierSeanceHistorique(actuel, valeurs);
        return { ...s, workouts: m ? s.workouts.map(x => x.id === w.id ? m : x) : s.workouts.filter(x => x.id !== w.id) };
      });
      fermerFeuille(f); toast('Séance modifiée.');
    }
    if (p === 'suppr' && await confirmer('Cette séance sera retirée de l’historique et de l’analyse. Ça ne peut pas être annulé.', { titre: 'Supprimer la séance ?', ok: 'Supprimer', danger: true })) {
      ctx.maj(s => ({ ...s, workouts: s.workouts.filter(x => x.id !== w.id) }));
      fermerFeuille(f); toast('Séance supprimée.');
    }
  });
}
