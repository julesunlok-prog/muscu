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
  chrono: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9.5 2.5h5',
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

export const confirmer = (message, { titre = 'Confirmer ?', ok = 'Confirmer', danger = false } = {}) =>
  choisir(message, { titre, choix: [['non', 'Retour', 'btn-texte'], ['oui', ok, danger ? 'btn-danger-plein' : 'btn-primary']] }).then(r => r === 'oui');

// Fenêtre à plusieurs choix : choix = [[id, libellé, classe du bouton], …]. Renvoie l'id choisi, ou null (Échap, voile).
// Au-delà de deux choix, les boutons s'empilent ; le focus va sur le choix principal (le dernier à deux, le premier sinon).
export function choisir(message, { titre, choix }) {
  return new Promise(resolve => {
    const v = voile(), pile = choix.length > 2;
    const f = document.createElement('div');
    f.className = 'fenetre'; f.setAttribute('role', 'alertdialog'); f.setAttribute('aria-modal', 'true');
    f.innerHTML = `<h2>${esc(titre)}</h2><p>${esc(message)}</p><div class="actions ${pile ? 'pile' : ''}">
      ${choix.map(([id, lib, cls]) => `<button class="btn ${cls}" data-r="${esc(id)}">${esc(lib)}</button>`).join('')}</div>`;
    const fin = r => { v.remove(); f.remove(); document.removeEventListener('keydown', clavier); resolve(r); };
    const clavier = e => { if (e.key === 'Escape') fin(null); };
    f.onclick = e => { const b = e.target.closest('[data-r]'); if (b) fin(b.dataset.r); };
    v.onclick = () => fin(null);
    document.addEventListener('keydown', clavier);
    document.body.appendChild(f);
    f.querySelectorAll('[data-r]')[pile ? 0 : choix.length - 1].focus();
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
  document.documentElement.classList.add('feuille-ouverte');
  v.onclick = () => fermerFeuille(f);
  v.addEventListener('touchmove', e => e.preventDefault(), { passive: false }); // glisser sur le voile ne fait pas défiler la page
  f.addEventListener('click', e => { if (e.target.closest('[data-fermer]')) fermerFeuille(f); });
  document.body.appendChild(f);
  return f;
}

export function fermerFeuille(f) {
  if (!f.isConnected) return;
  f.classList.add('sort'); f._voile.classList.add('sort');
  setTimeout(() => {
    f.remove(); f._voile.remove();
    if (!document.querySelector('.feuille')) document.documentElement.classList.remove('feuille-ouverte');
  }, 160);
}

// Retour haptique sur tous les boutons.
// iPhone (testé iOS 26.5) : seul un vrai toucher sur un interrupteur natif fait un « tic » ; le déclencher par code ne marche pas.
// On pose donc un interrupteur transparent dans chaque <button> : le toucher l'actionne et le clic remonte au bouton.
// Les liens <a> sont exclus : l'interrupteur y bloquerait la navigation. Android : vibration courte.
const TIC = '<input type="checkbox" switch class="tic" tabindex="-1" aria-hidden="true">';
export function ticPartout() {
  const poser = () => document.querySelectorAll('button:not(:has(> .tic))').forEach(b => b.insertAdjacentHTML('beforeend', TIC));
  poser();
  new MutationObserver(poser).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', e => { if (e.target.classList?.contains('tic')) try { navigator.vibrate?.(8); } catch { /* pas de vibration */ } });
}

// Durée de repos : champ « heure » détourné (mm:ss affiché comme hh:mm), seul moyen d'ouvrir la vraie roulette iOS à deux colonnes.
// shortcut: limité à 23 min 59 s, et un iPhone réglé en 12 h afficherait AM/PM ; repasser à une roulette maison si ça gêne.
const p2 = n => String(n).padStart(2, '0');
export const valeurDuree = sec => `${p2(Math.min(23, Math.floor(sec / 60)))}:${p2(sec >= 1440 ? 59 : sec % 60)}`;
export const champDuree = (id, sec) => `<input id="${id}" type="time" class="form-control" value="${valeurDuree(sec)}">`;
export const lireDuree = input => { const [m, s] = (input?.value || '').split(':').map(Number); return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null; };

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
