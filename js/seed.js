// Exercices et programmes créés avec Jules (spec §7), et sources citées.
import { defautsProfil, MATERIELS } from './profils.js';

function ex(id, nom, materiel, type, musclePrincipal, musclesSecondaires, note, sources, extra = {}) {
  return {
    id, nom, materiel, type, musclePrincipal, musclesSecondaires,
    ...defautsProfil(type), series: 3,
    pasMateriel: MATERIELS[materiel].pas, parMain: materiel === 'halteres', increment: null,
    note, sources, archive: false, ...extra,
  };
}

export const EXERCICES_INITIAUX = [
  ex('developpe-halteres', 'Développé couché haltères', 'halteres', 'poly_haut', 'pectoraux', ['delt_ant', 'triceps'],
    'À plat, le développé sollicite surtout le milieu et le bas des pectoraux.', ['S11']),
  ex('incline-smith', 'Développé incliné Smith', 'smith', 'poly_haut', 'pectoraux', ['delt_ant', 'triceps'],
    'Le haut des pectoraux est le plus actif vers 30° ; au-delà de 45°, le deltoïde antérieur prend le dessus et les pectoraux travaillent moins. Règle le banc à ~30°, pas 45°.', ['S11']),
  ex('pec-deck', 'Pec deck', 'machine_pile', 'iso', 'pectoraux', [],
    'Garde la tension sur tout le mouvement, contrairement à l’écarté aux haltères qui la perd en haut. Stable, et il active les pectoraux à un niveau comparable au développé. Isolation de ton muscle prioritaire.', ['S12']),
  ex('ecarte-arriere', 'Écarté arrière (reverse pec deck)', 'machine_pile', 'iso_petit', 'delt_post', [],
    'Isolation du deltoïde postérieur, sur la même machine que le pec deck : le superset est pratique.', []),
  ex('extension-nuque', 'Extension triceps au-dessus de la tête (poulie)', 'poulie', 'iso', 'triceps', [],
    'Le bras au-dessus de la tête étire la longue portion et donne plus d’hypertrophie qu’un bras le long du corps. C’est l’isolation triceps la plus étayée.', ['S8']),
  ex('pushdown', 'Extension triceps à la poulie haute (pushdown)', 'poulie', 'iso', 'triceps', [],
    'Complément utile à l’extension au-dessus de la tête, avec moins de travail en position étirée.', ['S8']),
  ex('elevations-laterales', 'Élévations latérales haltères', 'halteres', 'iso_petit', 'delt_lat', [],
    'Haltères et poulie font aussi bien l’un que l’autre pour l’hypertrophie du deltoïde latéral. Attention aux sauts de charge : 2 kg sur 8 kg = +25 %.', ['S13']),
  ex('rowing-barre', 'Rowing barre', 'barre', 'poly_haut', 'dos', ['biceps', 'delt_post'],
    'Polyarticulaire du dos (épaisseur).', []),
  ex('tirage-vertical', 'Tirage vertical (lat pulldown)', 'poulie', 'poly_haut', 'dos', ['biceps'],
    'Polyarticulaire du dos, centré sur le grand dorsal.', []),
  ex('rowing-iso', 'Rowing iso-latéral', 'machine_plaques', 'poly_haut', 'dos', ['biceps', 'delt_post'],
    'Polyarticulaire du dos, guidé.', []),
  ex('curl-marteau', 'Curl marteau', 'halteres', 'iso', 'biceps', [],
    'Cible le brachial et le brachio-radial.', []),
  ex('curl-incline', 'Curl incliné haltères', 'halteres', 'iso', 'biceps', [],
    'L’épaule en extension étire la longue portion du biceps. Une étude montre plus de croissance dans la région proximale qu’au curl pupitre, mais les résultats varient selon les études. Travailler en position étirée est au moins aussi bien qu’en position raccourcie.', ['S14', 'S15']),
  ex('presse', 'Presse à cuisses', 'machine_plaques', 'poly_bas', 'quadriceps', ['fessiers'],
    'Quadriceps, avec les fessiers en secondaire.', [], { repMin: 8, repMax: 12 }),
  ex('rdl-barre', 'Soulevé de terre roumain barre', 'barre', 'poly_bas', 'ischios', ['fessiers'],
    'Charnière de hanche : ischio-jambiers (allongés) et fessiers. Suivi séparé de la version haltères. Le leg curl assis fait plus grossir les ischios que le leg curl couché : à envisager en ajout.', ['S16'], { rirCible: '2–3' }),
  ex('rdl-halteres', 'Soulevé de terre roumain haltères', 'halteres', 'poly_bas', 'ischios', ['fessiers'],
    'Même mouvement que la version barre, suivi à part pour ne pas fausser l’historique.', ['S16'], { rirCible: '2–3' }),
  ex('leg-extension', 'Leg extension', 'machine_pile', 'iso', 'quadriceps', [],
    'Travailler en position étirée favorise la croissance du droit fémoral distal.', ['S17']),
];

const item = (exerciseId, supersetGroupe = null) => ({ exerciseId, series: 3, supersetGroupe });

export const PROGRAMMES_INITIAUX = [
  { id: 'push', nom: 'Push', items: [
    item('developpe-halteres'), item('incline-smith'), item('pec-deck', 'A'), item('ecarte-arriere', 'A'),
    item('extension-nuque'), item('pushdown', 'B'), item('elevations-laterales', 'B'),
  ] },
  { id: 'pull', nom: 'Pull', items: [
    item('rowing-barre'), item('tirage-vertical'), item('rowing-iso'), item('curl-marteau'), item('curl-incline'),
  ] },
  { id: 'legs', nom: 'Legs', items: [item('presse'), item('rdl-barre'), item('leg-extension')] },
];

export const SOURCES = {
  S1: { titre: 'NSCA — règle « 2-for-2 » et pourcentages d’augmentation', url: 'https://open-exam-prep.com/study-guides/nsca-cpt/acute-variables/progression-reassessment' },
  S2: { titre: 'ACSM 2009 — Progression models in resistance training', url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/' },
  S3: { titre: 'Plotkin et al. 2022 — progresser en reps ou en charge', url: 'https://peerj.com/articles/14142' },
  S4: { titre: 'Schoenfeld, Ogborn & Krieger 2017 — dose-réponse du volume', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6303131' },
  S5: { titre: 'Pelland et al. — volume, fréquence et comptage fractionnaire', url: 'https://sportrxiv.org/index.php/server/preprint/download/460/967/908' },
  S6: { titre: 'Robinson et al. 2024 — proximité de l’échec', url: 'https://sciencedaily.com/releases/2024/07/240731140409.htm' },
  S7: { titre: 'Lopez et al. 2021 — charge et hypertrophie', url: 'https://jyx.jyu.fi/jyx/Record/jyx_123456789_75929' },
  S8: { titre: 'Maeo et al. 2023 — extension triceps au-dessus de la tête', url: 'https://pubmed.ncbi.nlm.nih.gov/35819335/' },
  S9: { titre: 'Coleman et al. 2024 — semaine de décharge', url: 'https://pubmed.ncbi.nlm.nih.gov/38274324/' },
  S10: { titre: 'Singer et al. 2024 — durée de repos', url: 'https://pubmed.ncbi.nlm.nih.gov/39205815/' },
  S11: { titre: 'Rodríguez-Ridao et al. 2020 — inclinaison du banc et EMG', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7579505' },
  S12: { titre: 'Pec deck vs développé — EMG', url: 'https://www.repositorio.unb.br/bitstream/10482/27102/2/ARTIGO_ComparisonAmoungEMG.pdf' },
  S13: { titre: 'Larsen et al. 2025 — élévations latérales haltères vs poulie', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12277279/' },
  S14: { titre: 'Kassiano et al. 2025 — curl incliné vs pupitre', url: 'https://barbend.com/news/preacher-vs-incline-biceps-curls/' },
  S15: { titre: 'Wolf et al. 2023 / Pedrosa et al. 2023 — position étirée', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9960616' },
  S16: { titre: 'Maeo et al. 2021 — leg curl assis vs couché', url: 'https://mennohenselmans.com/stretch-mediated-hypertrophy-rom/' },
  S17: { titre: 'Pedrosa et al. 2022 — leg extension en position étirée', url: 'https://sportrxiv.org/index.php/server/preprint/download/486/1085/1009' },
  S18: { titre: 'Schoenfeld et al. 2016 — fréquence d’entraînement et hypertrophie', url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/' },
  S19: { titre: 'ACSM 2026 — nouvelles recommandations (la régularité compte le plus)', url: 'https://www.newswise.com/articles/acsm-unveils-landmark-2026-resistance-training-guidelines-first-update-in-17-years' },
  S20: { titre: 'Barbell Medicine — rythme de progression selon l’expérience (article de coachs)', url: 'https://www.barbellmedicine.com/blog/novice-intermediate-advanced-strength-training/' },
  S21: { titre: 'Ratios poussée / tirage — recommandations de coachs, sans étude', url: 'https://www.bodybuilding.com/content/safe-strong-upper-body-lifting-begins-with-these-two-ratios.html' },
};
