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
    'Stable, et il active les pectoraux à un niveau comparable au développé (mesure d’activation, pas de croissance). Isolation de ton muscle prioritaire.', ['S12']),
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
    'L’épaule en extension étire la longue portion du biceps. Une étude montre plus de croissance dans la partie haute du biceps qu’au curl pupitre, mais le curl pupitre fait davantage grossir la partie basse : les deux se complètent. Travailler en position étirée est au moins aussi bien qu’en position raccourcie.', ['S14', 'S15', 'S25']),
  ex('presse', 'Presse à cuisses', 'machine_plaques', 'poly_bas', 'quadriceps', ['fessiers'],
    'Quadriceps, avec les fessiers en secondaire.', [], { repMin: 8, repMax: 12 }),
  ex('rdl-barre', 'Soulevé de terre roumain barre', 'barre', 'poly_bas', 'ischios', ['fessiers'],
    'Charnière de hanche : ischio-jambiers (allongés) et fessiers. Suivi séparé de la version haltères. Le leg curl assis fait plus grossir les ischios que le leg curl couché : à envisager en ajout.', ['S16'], { rirCible: '2–3' }),
  ex('rdl-halteres', 'Soulevé de terre roumain haltères', 'halteres', 'poly_bas', 'ischios', ['fessiers'],
    'Même mouvement que la version barre, suivi à part pour ne pas fausser l’historique.', ['S16'], { rirCible: '2–3' }),
  ex('leg-extension', 'Leg extension', 'machine_pile', 'iso', 'quadriceps', [],
    'Incline le dossier vers l’arrière : plus de croissance du droit fémoral. Insiste sur la partie basse du mouvement (genou fléchi), là où le quadriceps est étiré.', ['S26', 'S17']),
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

// Vérifiées le 2026-11-13 (reports/Vérification des études muscu.md) : liens vers l'article publié (DOI, PubMed ou PMC).
// S1 (« 2-for-2 » de la NSCA) est retiré : l'app n'applique pas cette règle et le lien n'était pas une source NSCA.
export const SOURCES = {
  S2: { titre: 'ACSM 2009 — modèles de progression : +2 à 10 % quand on dépasse la cible de 1 à 2 reps', url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/' },
  S3: { titre: 'Plotkin et al. 2022 — progresser en reps ou en charge (PeerJ)', url: 'https://doi.org/10.7717/peerj.14142' },
  S4: { titre: 'Schoenfeld, Ogborn & Krieger 2017 — dose-réponse du volume (J Sports Sci)', url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/' },
  S5: { titre: 'Pelland et al. 2026 — volume, fréquence et comptage fractionnaire (Sports Med)', url: 'https://doi.org/10.1007/s40279-025-02344-w' },
  S6: { titre: 'Robinson et al. 2024 — proximité de l’échec (Sports Med)', url: 'https://doi.org/10.1007/s40279-024-02069-2' },
  S7: { titre: 'Lopez et al. 2021 — charge et hypertrophie (MSSE)', url: 'https://doi.org/10.1249/MSS.0000000000002585' },
  S8: { titre: 'Maeo et al. 2023 — extension triceps au-dessus de la tête', url: 'https://pubmed.ncbi.nlm.nih.gov/35819335/' },
  S9: { titre: 'Coleman et al. 2024 — une semaine sans entraînement ne fait pas perdre de muscle (un peu de force)', url: 'https://pubmed.ncbi.nlm.nih.gov/38274324/' },
  S10: { titre: 'Singer et al. 2024 — durée de repos', url: 'https://pubmed.ncbi.nlm.nih.gov/39205815/' },
  S11: { titre: 'Rodríguez-Ridao et al. 2020 — inclinaison du banc et EMG', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7579505' },
  S12: { titre: 'Rocha Júnior et al. 2007 — EMG développé vs pec deck (Rev Bras Med Esporte)', url: 'https://doi.org/10.1590/S1517-86922007000100012' },
  S13: { titre: 'Larsen et al. 2025 — élévations latérales haltères vs poulie (Front Physiol)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12277279/' },
  S14: { titre: 'Kassiano et al. 2025 — curl incliné vs pupitre (Int J Sports Med)', url: 'https://doi.org/10.1055/a-2517-0509' },
  S15: { titre: 'Pedrosa et al. 2023 — curl en amplitude initiale (Sports)', url: 'https://doi.org/10.3390/sports11020039' },
  S16: { titre: 'Maeo et al. 2021 — leg curl assis vs couché (MSSE)', url: 'https://doi.org/10.1249/MSS.0000000000002523' },
  S17: { titre: 'Pedrosa et al. 2022 — leg extension en position étirée (Eur J Sport Sci)', url: 'https://doi.org/10.1080/17461391.2021.1927199' },
  S18: { titre: 'Schoenfeld et al. 2016 — fréquence d’entraînement et hypertrophie', url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/' },
  S19: { titre: 'ACSM 2026 — Currier et al., position officielle (la régularité compte le plus)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/' },
  S20: { titre: 'Barbell Medicine (avis de coachs) — progression réactive ; une stagnation se juge sur 3–4 semaines', url: 'https://www.barbellmedicine.com/blog/novice-intermediate-advanced-strength-training/' },
  S21: { titre: 'Ratio poussée / tirage : repère de coachs, aucune étude sur les séries (Kolber 2017 porte sur des rapports de force de l’épaule)', url: 'https://pubmed.ncbi.nlm.nih.gov/27390859/' },
  S22: { titre: 'Schoenfeld, Grgic & Krieger 2019 — à volume égal, la fréquence change peu (J Sports Sci)', url: 'https://pubmed.ncbi.nlm.nih.gov/30558493/' },
  S23: { titre: 'Rogerson et al. 2024 — la décharge selon les coachs (consensus, pas un essai)', url: 'https://doi.org/10.1186/s40798-024-00691-y' },
  S24: { titre: 'Refalo et al. 2023 — aller jusqu’à l’échec n’apporte presque rien (Sports Med)', url: 'https://doi.org/10.1007/s40279-022-01784-y' },
  S25: { titre: 'Wolf et al. 2023 — amplitude partielle vs complète (méta-analyse, IJSC)', url: 'https://doi.org/10.47206/ijsc.v3i1.182' },
  S26: { titre: 'Larsen et al. 2025 — leg extension dossier incliné : plus de croissance du droit fémoral (J Sports Sci)', url: 'https://doi.org/10.1080/02640414.2024.2444713' },
  S27: { titre: 'Kassiano et al. 2026 — augmenter la charge en haut de la fourchette (MSSE)', url: 'https://doi.org/10.1249/MSS.0000000000003968' },
};
