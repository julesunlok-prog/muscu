// Semaine type : liste ordonnée de programmes (un programme peut revenir) à faire en un cycle de 7 jours.
// Rien n'est enregistré à part la liste (par périodes) et les sauts : faites et ratées se déduisent toujours
// des séances, pour qu'une suppression ou un import d'historique remette tout d'aplomb (spec semaine type).

// Périodes illisibles (sauvegarde modifiée à la main) ignorées : mieux vaut pas de semaine qu'un écran planté.
const periodesDe = state => { const p = state.settings?.semaine?.periodes; return Array.isArray(p) ? p.filter(x => Array.isArray(x?.ordre) && typeof x.depuis === 'string') : []; };
const ordreFiltre = (state, ordre) => { const ids = new Set(state.templates.map(t => t.id)); return ordre.filter(id => ids.has(id)); };
const minuit = date => { const x = new Date(date); x.setHours(0, 0, 0, 0); return x; };
const plusJours = (date, n) => { const x = new Date(date); x.setDate(x.getDate() + n); return x; };

export function ordreActuel(state) {
  const p = periodesDe(state).at(-1);
  const ordre = p ? ordreFiltre(state, p.ordre) : [];
  return ordre.length ? ordre : null;
}

export function occurrences(state) {
  const ordre = ordreActuel(state);
  if (!ordre) return null;
  const n = {};
  for (const id of ordre) n[id] = (n[id] ?? 0) + 1;
  return n;
}

export function cycles(state, now = new Date()) {
  const periodes = periodesDe(state), ratees = [], sauteesVisibles = [];
  let courant = null;
  const clore = c => {
    for (const x of c.cases) {
      if (x.etat === 'a_faire') ratees.push({ templateId: x.templateId, date: new Date(c.fin - 1).toISOString() }); // datée du 7e jour
      if (x.etat === 'sautee') sauteesVisibles.push(x.saut);
    }
  };
  periodes.forEach((p, i) => {
    const derniere = i === periodes.length - 1;
    const fin = derniere ? now.toISOString() : periodes[i + 1].depuis;
    // Un programme supprimé ne sort que de la liste actuelle : l'historique des périodes passées ne bouge pas.
    const ordre = derniere ? ordreFiltre(state, p.ordre) : p.ordre;
    if (!ordre.length) return;
    const dans = date => date >= p.depuis && date < fin;
    const evts = [
      ...state.workouts.filter(w => ordre.includes(w.templateId) && dans(w.debut)).map(w => ({ faite: true, templateId: w.templateId, date: w.debut })),
      ...(state.sautees ?? []).filter(s => ordre.includes(s.templateId) && dans(s.date)).map(s => ({ faite: false, templateId: s.templateId, date: s.date, saut: s })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let c = null;
    for (const e of evts) {
      if (c && Date.parse(e.date) >= c.fin.getTime()) { clore(c); c = null; }
      if (!c) { const debut = minuit(e.date); c = { debut, fin: plusJours(debut, 7), cases: ordre.map(templateId => ({ templateId, etat: 'a_faire' })) }; }
      const meme = etat => c.cases.find(x => x.templateId === e.templateId && x.etat === etat);
      if (e.faite) {
        const x = meme('a_faire') ?? meme('sautee'); // une séance faite remplace un saut du même programme
        if (x) { x.etat = 'faite'; delete x.saut; }
      } else {
        const x = meme('a_faire');
        if (x) { x.etat = 'sautee'; x.saut = e.saut; }
      }
      if (!c.cases.some(x => x.etat === 'a_faire')) { clore(c); c = null; }
    }
    if (c && Date.parse(fin) >= c.fin.getTime()) clore(c);
    else if (c && derniere) courant = c;
    // liste modifiée en plein cycle : cycle abandonné sans ratée, ses sauts restent dans l'historique
    else if (c) for (const x of c.cases) if (x.etat === 'sautee') sauteesVisibles.push(x.saut);
  });
  const ordre = ordreActuel(state);
  if (!ordre) return { courant: null, ratees, sauteesVisibles };
  if (courant) for (const x of courant.cases) if (x.etat === 'sautee') sauteesVisibles.push(x.saut);
  const cases = (courant?.cases ?? ordre.map(templateId => ({ templateId, etat: 'a_faire' }))).map(({ templateId, etat }) => ({ templateId, etat }));
  return {
    courant: {
      debut: courant?.debut ?? null,
      jour: courant ? Math.round((minuit(now) - courant.debut) / 864e5) + 1 : null,
      cases, prochaine: cases.findIndex(x => x.etat === 'a_faire'),
    },
    ratees, sauteesVisibles,
  };
}

export function absences(state, now = new Date()) {
  const { ratees, sauteesVisibles } = cycles(state, now);
  return [...ratees.map(r => ({ ...r, type: 'ratee' })), ...sauteesVisibles.map(s => ({ templateId: s.templateId, date: s.date, type: 'sautee', id: s.id }))]
    .sort((a, b) => b.date.localeCompare(a.date));
}
