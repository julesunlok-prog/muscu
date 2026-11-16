// Profils de progression (spec §6.1) et données de référence.

export const PROFILS = {
  poly_haut: { nom: 'Polyarticulaire haut du corps', repMin: 6, repMax: 10, reposSec: 150, rirCible: '1–2', pct: 0.025 },
  poly_bas: { nom: 'Polyarticulaire bas du corps', repMin: 6, repMax: 10, reposSec: 180, rirCible: '2', pct: 0.05 },
  iso: { nom: 'Isolation', repMin: 10, repMax: 15, reposSec: 90, rirCible: '0–1', pct: 0 },
  iso_petit: { nom: 'Isolation petit muscle', repMin: 12, repMax: 20, reposSec: 90, rirCible: '0–1', pct: 0 },
};

// Les 5 derniers (bibliothèque) ne s'affichent dans l'Analyse que si un de tes exercices les cible.
export const MUSCLES = ['pectoraux', 'delt_ant', 'delt_lat', 'delt_post', 'triceps', 'dos', 'biceps', 'quadriceps', 'ischios', 'fessiers', 'mollets',
  'abdos', 'trapezes', 'lombaires', 'adducteurs', 'avant_bras'];
export const MUSCLES_EN_OPTION = new Set(MUSCLES.slice(11));

export const NOM_MUSCLE = {
  pectoraux: 'Pectoraux', delt_ant: 'Deltoïde antérieur', delt_lat: 'Deltoïde latéral', delt_post: 'Deltoïde postérieur',
  triceps: 'Triceps', dos: 'Dos', biceps: 'Biceps', quadriceps: 'Quadriceps', ischios: 'Ischio-jambiers',
  fessiers: 'Fessiers', mollets: 'Mollets',
  abdos: 'Abdominaux', trapezes: 'Trapèzes', lombaires: 'Lombaires', adducteurs: 'Adducteurs', avant_bras: 'Avant-bras',
};

export const MATERIELS = {
  barre: { nom: 'Barre', pas: 2.5 },
  halteres: { nom: 'Haltères', pas: 2 },
  smith: { nom: 'Machine Smith', pas: 2.5 },
  machine_plaques: { nom: 'Machine à plaques', pas: 5 },
  machine_pile: { nom: 'Machine à pile', pas: 5 },
  poulie: { nom: 'Poulie', pas: 5 },
  poids_du_corps: { nom: 'Poids du corps', pas: 2.5 },
  kettlebell: { nom: 'Kettlebell', pas: 4 },
};

// Réglages par défaut d'un exercice pour un profil donné.
export function defautsProfil(type) {
  const { repMin, repMax, reposSec, rirCible } = PROFILS[type];
  return { repMin, repMax, reposSec, rirCible };
}

// Exercice neuf avec les réglages du profil (création à la main ou depuis la bibliothèque).
export function nouvelExercice({ nom, materiel, type, musclePrincipal, musclesSecondaires }) {
  const id = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  return { id, nom, materiel, type, musclePrincipal, musclesSecondaires, ...defautsProfil(type), series: 3,
    pasMateriel: MATERIELS[materiel].pas, parMain: materiel === 'halteres', increment: null, note: '', sources: [], archive: false };
}

const arrondi = (x, pas) => Math.round(x / pas) * pas;

// Incrément de charge (spec §6.2 point 4) : au moins un pas de matériel.
export function incrementPour(ex, kg) {
  if (ex.increment != null) return ex.increment;
  const pas = ex.pasMateriel;
  return Math.max(pas, arrondi(kg * PROFILS[ex.type].pct, pas));
}
