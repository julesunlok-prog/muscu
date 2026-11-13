// Petits utilitaires d'interface : échappement, formats, icônes, toast, confirmation, feuille.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtNum = (n, dec = 1) => n == null || !Number.isFinite(n) ? '—'
  : (Math.round(n * 10 ** dec) / 10 ** dec).toLocaleString('fr-FR');
export const fmtKg = n => n == null ? '' : String(n).replace('.', ',');
export const fmtDate = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const fmtDateLongue = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export function fmtDuree(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
export const fmtChrono = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Icônes en trait (grille 24, trait 1,7), comme dans le système de design.
const PATHS = {
  haltere: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  historique: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  liste: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  graphique: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  reglages: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  retour: 'M15 6l-6 6 6 6',
  haut: 'M6 15l6-6 6 6',
  bas: 'M6 9l6 6 6-6',
  plusieurs: 'M5 12h.01M12 12h.01M19 12h.01',
  info: 'M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  alerte: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  telecharger: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  importer: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  poubelle: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};
export const icon = (nom, cls = 'icone') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[nom]}"/></svg>`;

let pile = null;
export function toast(msg, type = 'success') {
  pile ??= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toasts', role: 'status' }));
  if (type === 'success') pile.querySelectorAll('.toast.error').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="pastille">${icon(type === 'error' ? 'alerte' : type === 'info' ? 'info' : 'check', 'icone')}</span><span>${esc(msg)}</span>`;
  const fermer = () => { t.classList.add('sort'); setTimeout(() => t.remove(), 200); };
  t.onclick = fermer;
  pile.appendChild(t);
  setTimeout(fermer, type === 'error' ? 6000 : 3000);
}

const voile = () => document.body.appendChild(Object.assign(document.createElement('div'), { className: 'voile' }));

export function confirmer(message, { titre = 'Confirmer ?', ok = 'Confirmer', danger = false } = {}) {
  return new Promise(resolve => {
    const v = voile();
    const f = document.createElement('div');
    f.className = 'fenetre'; f.setAttribute('role', 'alertdialog'); f.setAttribute('aria-modal', 'true');
    f.innerHTML = `<h2>${esc(titre)}</h2><p>${esc(message)}</p><div class="actions">
      <button class="btn btn-texte" data-r="0">Retour</button>
      <button class="btn ${danger ? 'btn-danger-plein' : 'btn-primary'}" data-r="1">${esc(ok)}</button></div>`;
    const fin = r => { v.remove(); f.remove(); document.removeEventListener('keydown', clavier); resolve(r); };
    const clavier = e => { if (e.key === 'Escape') fin(false); };
    f.onclick = e => { const b = e.target.closest('[data-r]'); if (b) fin(b.dataset.r === '1'); };
    v.onclick = () => fin(false);
    document.addEventListener('keydown', clavier);
    document.body.appendChild(f);
    f.querySelector('[data-r="1"]').focus();
  });
}

// Feuille qui monte du bas : en-tête (titre + croix), corps qui défile, pied facultatif.
export function ouvrirFeuille({ titre, corps, pied = '' }) {
  const v = voile();
  const f = document.createElement('div');
  f.className = 'feuille'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', titre);
  f.innerHTML = `<div class="feuille-tete"><h2>${esc(titre)}</h2><button class="fermer" data-fermer aria-label="Fermer">${icon('close')}</button></div>
    <div class="feuille-corps">${corps}</div>${pied ? `<div class="feuille-pied">${pied}</div>` : ''}`;
  f._voile = v;
  v.onclick = () => fermerFeuille(f);
  f.addEventListener('click', e => { if (e.target.closest('[data-fermer]')) fermerFeuille(f); });
  document.body.appendChild(f);
  return f;
}

export function fermerFeuille(f) {
  if (!f.isConnected) return;
  f.classList.add('sort'); f._voile.classList.add('sort');
  setTimeout(() => { f.remove(); f._voile.remove(); }, 160);
}

// Retour haptique. iOS 18+ : basculer un interrupteur natif fait un « tic » (seul moyen sur le web, sans effet avant iOS 18).
// Android : vibration courte.
let interrupteur = null;
export function tic() {
  try {
    if (navigator.vibrate) return void navigator.vibrate(8);
    // Interrupteur rendu mais invisible (un élément en display:none peut être ignoré par iOS).
    interrupteur ??= Object.assign(document.body.appendChild(document.createElement('label')), {
      ariaHidden: 'true', innerHTML: '<input type="checkbox" switch tabindex="-1">',
      style: 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none' });
    interrupteur.click();
  } catch { /* pas de retour haptique */ }
}

// Roulette de durée façon minuteur iPhone : colonnes minutes / secondes. Défilement fait main (glisser, lancer, aimant),
// pour que le doigt sur la roue ne fasse pas défiler la page ou la feuille.
const MINUTES = [...Array(16).keys()], SECONDES = [...Array(12).keys()].map(i => i * 5);
const colonne = (nom, valeurs, unite) => `<div class="roue" tabindex="0" role="spinbutton" aria-label="${nom}" aria-valuemin="${valeurs[0]}" aria-valuemax="${valeurs.at(-1)}">
  <div class="roue-piste">${valeurs.map(v => `<div>${v}</div>`).join('')}</div></div><span class="roue-unite" aria-hidden="true">${unite}</span>`;
export const roueDuree = (id, sec) => `<div class="roues" id="${id}" role="group" aria-labelledby="${id}-titre" data-sec="${sec}">${colonne('Minutes', MINUTES, 'min')}${colonne('Secondes', SECONDES, 's')}</div>`;

const H = 36; // hauteur d'une ligne, comme dans styles.css
export const lireRoue = el => { const [m, s] = el.querySelectorAll('.roue'); return MINUTES[m._cible ?? 0] * 60 + SECONDES[s._cible ?? 0]; };
export function reglerRoue(el, sec) {
  sec = Math.min(MINUTES.at(-1) * 60 + 55, Math.round(sec / 5) * 5);
  const [m, s] = el.querySelectorAll('.roue');
  m._aller?.(Math.floor(sec / 60), false); s._aller?.((sec % 60) / 5, false);
}
// À appeler une fois la roulette dans la page.
export function brancherRoues(racine) {
  racine.querySelectorAll('.roues').forEach(el => {
    el.querySelectorAll('.roue').forEach(brancherRoue);
    reglerRoue(el, +el.dataset.sec);
  });
}

function brancherRoue(r) {
  const piste = r.firstElementChild, n = piste.children.length, max = (n - 1) * H;
  let y = 0, anim = 0, vu = 0, toucher = null;
  const poser = v => {
    y = v; piste.style.transform = `translateY(${-y}px)`;
    const i = Math.min(n - 1, Math.max(0, Math.round(y / H)));
    if (i !== vu) { vu = i; tic(); r.setAttribute('aria-valuenow', piste.children[i].textContent); }
  };
  // Va à la ligne i, en glissant (ease-out) ou d'un coup.
  r._aller = (i, anime = true) => {
    cancelAnimationFrame(anim);
    i = Math.min(n - 1, Math.max(0, i)); r._cible = i;
    if (!anime) { vu = i; r.setAttribute('aria-valuenow', piste.children[i].textContent); return poser(i * H); }
    const de = y, a = i * H, duree = Math.min(700, 220 + Math.abs(a - de) * 1.5), t0 = performance.now();
    const pas = t => { const k = Math.min(1, (t - t0) / duree); poser(de + (a - de) * (1 - (1 - k) ** 3)); if (k < 1) anim = requestAnimationFrame(pas); };
    anim = requestAnimationFrame(pas);
  };
  r.onpointerdown = e => {
    cancelAnimationFrame(anim);
    try { r.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    toucher = { y0: e.clientY, depart: y, bouge: false, pts: [[e.clientY, e.timeStamp]] };
  };
  r.onpointermove = e => {
    if (!toucher) return;
    const d = toucher.y0 - e.clientY;
    if (Math.abs(d) > 4) toucher.bouge = true;
    // Au-delà des bords, la roue résiste (élastique) au lieu de s'arrêter net.
    const v = toucher.depart + d;
    poser(v < 0 ? v / 3 : v > max ? max + (v - max) / 3 : v);
    toucher.pts = [...toucher.pts.slice(-4), [e.clientY, e.timeStamp]];
  };
  r.onpointerup = r.onpointercancel = e => {
    if (!toucher) return;
    const t = toucher; toucher = null;
    if (!t.bouge) // simple toucher : va à la ligne touchée (la ligne du milieu est à 2,5 lignes du haut)
      return r._aller(Math.round(y / H + (e.clientY - r.getBoundingClientRect().top) / H - 2.5));
    const [[y1, t1], [y2, t2]] = [t.pts[0], t.pts.at(-1)];
    const vitesse = t2 > t1 ? (y1 - y2) / (t2 - t1) : 0; // px/ms
    r._aller(Math.round((y + vitesse * 180) / H)); // lancer : la roue continue sur son élan
  };
  // Sur iPhone, touch-action ne suffit pas : sans ceci, Safari fait défiler la page et annule le glisser.
  r.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  r.addEventListener('touchend', e => e.preventDefault(), { passive: false }); // pas de zoom en touchant vite la roue (le choix passe par pointerup)
  r.onwheel = e => { e.preventDefault(); r._aller(r._cible + Math.sign(e.deltaY)); };
  r.onkeydown = e => { const d = { ArrowUp: -1, ArrowDown: 1 }[e.key]; if (d) { e.preventDefault(); r._aller(r._cible + d); } };
}

export function champErreur(input, message) {
  input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
  input.setAttribute('aria-invalid', 'true');
  let m = input.parentElement.querySelector('.err-msg');
  if (!m) m = input.parentElement.appendChild(Object.assign(document.createElement('div'), { className: 'err-msg' }));
  m.textContent = message;
  input.focus();
}

// Donne un fichier à l'utilisateur. Sur iPhone, la feuille de partage (Enregistrer dans Fichiers, iCloud…)
// est plus fiable qu'un téléchargement dans une app installée sur l'écran d'accueil.
export async function telecharger(nom, texte, type = 'application/json') {
  const fichier = new File([texte], nom, { type });
  if (navigator.canShare?.({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier], title: nom }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; /* sinon on tente le téléchargement */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(fichier);
  a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return true;
}
