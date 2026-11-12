// Graphiques en SVG faits main (système de design : pas de bibliothèque).
import { fmtNum, esc } from './ui.js';

const L = 340, H = 180, G = 36, D = 8, HAUT = 10, BAS = 22;
const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const COULEURS = 6; // séries --dv-1 … --dv-6

function echelles(xs, ys, demiPas = 0) {
  let [x0, x1] = [Math.min(...xs) - demiPas, Math.max(...xs) + demiPas];
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  const marge = (y1 - y0) * 0.1 || Math.max(1, y1 * 0.05);
  y0 = Math.max(0, y0 - marge); y1 += marge;
  return {
    x: t => G + (t - x0) / (x1 - x0) * (L - G - D),
    y: v => HAUT + (1 - (v - y0) / (y1 - y0)) * (H - HAUT - BAS),
    x0: x0 + demiPas, x1: x1 - demiPas, y0, y1,
  };
}

function axes(e) {
  let s = '';
  for (let i = 0; i <= 3; i++) {
    const v = e.y0 + (e.y1 - e.y0) * i / 3, y = e.y(v);
    s += `<line class="grille" x1="${G}" x2="${L - D}" y1="${y}" y2="${y}"/><text class="axe" x="${G - 6}" y="${y + 4}" text-anchor="end">${fmtNum(v, 0)}</text>`;
  }
  return s + `<text class="axe" x="${G}" y="${H - 4}">${jour(e.x0)}</text><text class="axe" x="${L - D}" y="${H - 4}" text-anchor="end">${jour(e.x1)}</text>`;
}

const svg = (titre, contenu) => `<svg class="graph" viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(titre)}">${contenu}</svg>`;
const chemin = (e, pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${e.x(p.x).toFixed(1)},${e.y(p.y).toFixed(1)}`).join('');
const horizontale = (e, v, cls) => `<line class="${cls}" x1="${G}" x2="${L - D}" y1="${e.y(v).toFixed(1)}" y2="${e.y(v).toFixed(1)}"/>`;

// points : [{x: ms, y}] ; prediction : [{x, y}] en pointillés ; bande : [{x, lo, hi}] zone d'incertitude.
export function courbe(points, { prediction = [], bande = [], titre = 'Courbe' } = {}) {
  if (!points.length) return '';
  const tous = [...points, ...prediction, ...bande.flatMap(b => [{ x: b.x, y: b.lo }, { x: b.x, y: b.hi }])];
  const e = echelles(tous.map(p => p.x), tous.map(p => p.y));
  const zone = bande.length ? `<path class="bande" d="${chemin(e, bande.map(b => ({ x: b.x, y: b.hi })))}L${[...bande].reverse().map(b => `${e.x(b.x).toFixed(1)},${e.y(b.lo).toFixed(1)}`).join('L')}Z"/>` : '';
  return svg(titre, `${axes(e)}${zone}
    ${prediction.length ? `<path class="pred" d="${chemin(e, prediction)}"/>` : ''}
    <path class="ligne" d="${chemin(e, points)}"/>
    ${points.map(p => `<circle class="point" cx="${e.x(p.x).toFixed(1)}" cy="${e.y(p.y).toFixed(1)}" r="3.5"/>`).join('')}`);
}

// Plusieurs séries ({nom, points}) avec une couleur chacune ; reference : ligne horizontale (ex. 100 = départ).
export function courbes(series, { reference = null, titre = 'Courbes' } = {}) {
  const tous = series.flatMap(s => s.points);
  if (!tous.length) return '';
  const e = echelles(tous.map(p => p.x), [...tous.map(p => p.y), ...(reference == null ? [] : [reference])]);
  return svg(titre, `${axes(e)}${reference == null ? '' : horizontale(e, reference, 'repere')}
    ${series.map((s, i) => `<path class="ligne" style="stroke:var(--dv-${i % COULEURS + 1})" d="${chemin(e, s.points)}"/>
      ${s.points.map(p => `<circle class="point" style="fill:var(--dv-${i % COULEURS + 1})" cx="${e.x(p.x).toFixed(1)}" cy="${e.y(p.y).toFixed(1)}" r="3"/>`).join('')}`).join('')}`);
}

export const legende = series => `<div class="legende">${series.map((s, i) =>
  `<span><i style="background:var(--dv-${i % COULEURS + 1})"></i>${esc(s.nom)}</span>`).join('')}</div>`;

// Barres verticales ; cible : ligne horizontale en pointillés.
export function barres(points, { cible = null, titre = 'Barres' } = {}) {
  if (!points.length) return '';
  const pas = points.length > 1 ? (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) / (points.length - 1) : 864e5;
  const e = echelles(points.map(p => p.x), [0, ...points.map(p => p.y), ...(cible == null ? [] : [cible])], pas / 2);
  const l = Math.max(3, Math.min(14, (L - G - D) / points.length * 0.5));
  return svg(titre, `${axes(e)}
    ${points.map(p => `<rect class="barre" x="${(e.x(p.x) - l / 2).toFixed(1)}" y="${e.y(p.y).toFixed(1)}" width="${l.toFixed(1)}" height="${(e.y(e.y0) - e.y(p.y)).toFixed(1)}" rx="2"/>`).join('')}
    ${cible == null ? '' : horizontale(e, cible, 'cible')}`);
}
