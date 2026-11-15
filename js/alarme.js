// Alarme de repos qui sonne app fermée : le Worker Cloudflare (serveur/) envoie une notification à la fin du repos.
// Ce module décide quoi lui demander (programmer, annuler, réessayer) ; il n'envoie que l'heure de fin, jamais de séance.
// Spec : docs/superpowers/specs/2026-11-15-alarme-repos-design.md

export const SERVEUR = 'https://muscu-alarme.julesunlok.workers.dev'; // Worker Cloudflare (serveur/)
export const VAPID_PUBLIQUE = 'BNsfPt9Pn0AGmwMYVTPBXViZCq5erTJit71R1dY-RqRr4x4hdOPG924uZY8LwqHkjCWpR2DEIVbkOkt9vTW6Xjs'; // clé publique VAPID (pas un secret)

const K = { code: 'muscu:alarme-code', id: 'muscu:alarme-id', dernier: 'muscu:alarme' };
const lire = k => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };
const dernierEnvoi = () => { try { return JSON.parse(lire(K.dernier)); } catch { return null; } };

// Dernier envoi : { type, fin, ok, armee }. armee = la fin la plus tardive qui peut encore être programmée sur le serveur
// (une demande ratée a pu arriver, ou non) : c'est elle qu'il faut annuler, même si une demande plus récente a aussi raté.
export function apres(precedent, demande, ok) {
  const armee = ok ? (demande.type === 'programmer' ? demande.fin : null)
    : Math.max(precedent?.armee ?? 0, demande.type === 'programmer' ? demande.fin : 0) || null;
  return { ...demande, ok, armee };
}

// Demande à envoyer pour ce repos, sachant le dernier envoi, ou null.
export function besoin(repos, dernier, maintenant) {
  const fin = repos && repos.pause == null && repos.fin > maintenant ? repos.fin : null;
  if (fin) return dernier?.type === 'programmer' && dernier.fin === fin && dernier.ok ? null : { type: 'programmer', fin };
  // Plus d'alarme voulue : annuler celle qui est peut-être programmée, tant qu'elle n'est pas échue.
  return dernier?.armee > maintenant ? { type: 'annuler', fin: dernier.armee } : null;
}

export function etatPilule(dernier, maintenant) {
  if (!dernier || dernier.ok) return null;
  if (dernier.type === 'programmer' && dernier.fin > maintenant) return 'non-programmee';
  return dernier.armee > maintenant ? 'pas-annulee' : null;
}
export const pilule = () => etatPilule(dernierEnvoi(), Date.now());

function idAppareil() {
  let id = lire(K.id);
  if (!id) { id = crypto.randomUUID(); ecrire(K.id, id); }
  return id;
}

// Statut HTTP de la requête, ou 0 si le réseau a échoué.
async function requete(methode, route, corps, code = lire(K.code)) {
  try {
    const r = await fetch(SERVEUR + route, { method: methode, body: JSON.stringify({ id: idAppareil(), ...corps }),
      headers: { Authorization: `Bearer ${code}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000) }); // réseau faible : on abandonne pour ne pas bloquer les demandes suivantes
    return r.status;
  } catch { return 0; }
}
const reussi = statut => statut >= 200 && statut < 300;

let enVol = false, enAttente = null;
// Appelée après chaque changement d'état, au retour du réseau et au retour au premier plan.
export async function synchroniser(state, { demo = false } = {}) {
  if (demo || !SERVEUR || !lire(K.code)) return;
  if (enVol) { enAttente = state; return; } // une demande à la fois ; on rejoue avec l'état le plus récent
  const b = besoin(state.enCours?.repos ?? null, dernierEnvoi(), Date.now());
  if (!b) return;
  enVol = true;
  try {
    const statut = await requete(b.type === 'programmer' ? 'PUT' : 'DELETE', '/alarme', b.type === 'programmer' ? { fin: b.fin } : {});
    ecrire(K.dernier, JSON.stringify(apres(dernierEnvoi(), b, reussi(statut))));
  } finally {
    enVol = false;
    if (enAttente) { const s = enAttente; enAttente = null; synchroniser(s, { demo }); }
  }
}

const b64uDec = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const disponible = () => !!SERVEUR && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator;

export function etat() {
  if (!disponible()) return 'indisponible';
  if (Notification.permission === 'denied') return 'refusee';
  return lire(K.code) ? 'activee' : 'desactivee';
}

// À appeler directement dans le gestionnaire du toucher : iOS n'accorde la permission qu'en réponse à un geste.
export async function activer(code) {
  if (!disponible()) return 'indisponible';
  if (await Notification.requestPermission() !== 'granted') return 'refuse';
  let abonnement;
  try { // iOS peut refuser l'abonnement (hors ligne, service push indisponible) : message plutôt que bouton muet
    const reg = await navigator.serviceWorker.ready;
    abonnement = await reg.pushManager.getSubscription()
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uDec(VAPID_PUBLIQUE) });
  } catch { return 'reseau'; }
  const statut = await requete('PUT', '/abonnement', { subscription: abonnement.toJSON() }, code);
  if (statut === 401) return 'code';
  if (!reussi(statut)) return 'reseau';
  ecrire(K.code, code);
  return 'ok';
}

export const tester = async () => reussi(await requete('PUT', '/alarme', { fin: Date.now() + 10000 }));

export async function desactiver() {
  await requete('DELETE', '/abonnement', {});
  try { await (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.unsubscribe(); } catch { /* déjà désabonné */ }
  ecrire(K.code, null); ecrire(K.dernier, null);
}
