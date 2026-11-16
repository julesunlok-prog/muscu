// Bibliothèque des exercices d'une salle standard (Basic-Fit, Fitness Park : machines à pile, Hammer Strength, Smith, poulies, poids libres).
// Chaque ligne : nom | noms Strong (anglais) et Hevy (français), séparés par « ; » : ils servent à la recherche et à l'import | matériel | type | muscle | secondaires.
// Les noms identiques à ceux de seed.js renvoient vers tes exercices existants (pas de doublon).
// shortcut: pas d'exercices au temps (gainage, cardio) ni de machines assistées (la charge aide au lieu de freiner : le moteur progresserait à l'envers).
import { MATERIELS, NOM_MUSCLE, nouvelExercice } from './profils.js';
import { norm } from './strong-import.js';

const LIGNES = `
Développé couché barre|Bench Press (Barbell);Flat Bench Press|barre|poly_haut|pectoraux|delt_ant triceps
Développé couché haltères|Bench Press (Dumbbell);Dumbbell Bench Press|halteres|poly_haut|pectoraux|delt_ant triceps
Développé couché Smith|Bench Press (Smith Machine)|smith|poly_haut|pectoraux|delt_ant triceps
Développé incliné barre|Incline Bench Press (Barbell)|barre|poly_haut|pectoraux|delt_ant triceps
Développé incliné haltères|Incline Bench Press (Dumbbell);Incline Dumbbell Press|halteres|poly_haut|pectoraux|delt_ant triceps
Développé incliné Smith|Incline Bench Press (Smith Machine)|smith|poly_haut|pectoraux|delt_ant triceps
Développé décliné barre|Decline Bench Press (Barbell)|barre|poly_haut|pectoraux|delt_ant triceps
Développé décliné haltères|Decline Bench Press (Dumbbell)|halteres|poly_haut|pectoraux|delt_ant triceps
Chest press (machine)|Chest Press (Machine);Seated Chest Press|machine_pile|poly_haut|pectoraux|delt_ant triceps
Développé couché iso-latéral Hammer Strength|Iso-Lateral Chest Press (Machine);Chest Press (Plate Loaded)|machine_plaques|poly_haut|pectoraux|delt_ant triceps
Presse inclinée pectoraux (machine)|Incline Chest Press (Machine);Iso-Lateral Incline Press;Chest Press Incliné (Machine)|machine_plaques|poly_haut|pectoraux|delt_ant triceps
Développé décliné machine|Decline Chest Press (Machine);Iso-Lateral Decline Press|machine_plaques|poly_haut|pectoraux|delt_ant triceps
Développé à la poulie (debout)|Cable Chest Press;Standing Cable Chest Press|poulie|poly_haut|pectoraux|delt_ant triceps
Pec deck|Butterfly;Pec Deck (Machine);Chest Fly (Machine);Papillon|machine_pile|iso|pectoraux|
Écarté haltères (banc)|Chest Fly (Dumbbell);Dumbbell Fly|halteres|iso|pectoraux|delt_ant
Écarté incliné haltères|Incline Chest Fly (Dumbbell);Incline Dumbbell Fly|halteres|iso|pectoraux|delt_ant
Écarté à la poulie (vis-à-vis)|Cable Crossover;Chest Fly (Cable);Cable Fly|poulie|iso|pectoraux|delt_ant
Écarté poulie basse vers le haut|Low Cable Fly;Low to High Cable Fly;Cable Crossover (Low)|poulie|iso|pectoraux|delt_ant
Écarté poulie haute vers le bas|High to Low Cable Fly;Cable Crossover (High)|poulie|iso|pectoraux|delt_ant
Pompes|Push Up;Push-up|poids_du_corps|poly_haut|pectoraux|delt_ant triceps
Dips pectoraux (lestés ou poids du corps)|Chest Dip;Dips;Dip;Chest Dip (Weighted);Dips Pectoraux (Lesté);Dips Pectoraux;Dips (lestés ou poids du corps)|poids_du_corps|poly_haut|pectoraux|triceps delt_ant
Dips triceps (lestés ou poids du corps)|Triceps Dip;Triceps Dip (Weighted);Dips Triceps (Lesté);Dips Triceps|poids_du_corps|poly_haut|triceps|pectoraux delt_ant
Pull-over haltère|Pullover (Dumbbell);Dumbbell Pullover|halteres|iso|pectoraux|dos triceps
Tirage vertical (lat pulldown)|Lat Pulldown (Cable);Lat Pulldown;Wide Grip Lat Pulldown;Tirage Poitrine (Poulie)|poulie|poly_haut|dos|biceps
Tirage vertical machine|Lat Pulldown (Machine);Iso-Lateral Pulldown|machine_pile|poly_haut|dos|biceps
Tirage vertical prise serrée (triangle)|Lat Pulldown - Close Grip (Cable);Close Grip Lat Pulldown;Neutral Grip Lat Pulldown|poulie|poly_haut|dos|biceps
Tirage vertical supination|Reverse Grip Lat Pulldown (Cable);Underhand Lat Pulldown|poulie|poly_haut|dos|biceps
Tirage vertical unilatéral (poulie)|Single Arm Lat Pulldown;Single Arm Lat Pulldown (Cable)|poulie|poly_haut|dos|biceps
Tirage haut iso-latéral Hammer Strength (high row)|High Row (Machine);Iso-Lateral High Row (Machine)|machine_plaques|poly_haut|dos|biceps delt_post
Tractions|Pull Up;Pull-up;Pull Up (Weighted);Wide Grip Pull Up;Tractions (Lesté)|poids_du_corps|poly_haut|dos|biceps
Tractions supination (chin-up)|Chin Up;Chin-up;Chin Up (Weighted)|poids_du_corps|poly_haut|dos|biceps
Tractions prise neutre|Neutral Grip Pull Up;Hammer Grip Pull Up|poids_du_corps|poly_haut|dos|biceps
Rowing barre|Bent Over Row (Barbell);Barbell Row|barre|poly_haut|dos|biceps delt_post
Rowing barre supination|Bent Over Row - Underhand (Barbell);Reverse Grip Barbell Row;Yates Row|barre|poly_haut|dos|biceps delt_post
Rowing Pendlay|Pendlay Row (Barbell);Pendlay Row|barre|poly_haut|dos|biceps delt_post
Rowing Smith|Bent Over Row (Smith Machine)|smith|poly_haut|dos|biceps delt_post
Rowing haltère unilatéral|Bent Over One Arm Row (Dumbbell);Dumbbell Row;One Arm Dumbbell Row|halteres|poly_haut|dos|biceps delt_post
Rowing haltères poitrine appuyée (banc incliné)|Incline Row (Dumbbell);Chest Supported Row (Dumbbell);Chest Supported Dumbbell Row|halteres|poly_haut|dos|biceps delt_post
Rowing T-bar|T Bar Row;T-Bar Row|barre|poly_haut|dos|biceps delt_post
Rowing T-bar poitrine appuyée (machine)|Chest Supported T Bar Row;T Bar Row (Machine);Lying T Bar Row|machine_plaques|poly_haut|dos|biceps delt_post
Rowing assis à la poulie (tirage horizontal)|Seated Row (Cable);Seated Cable Row;Cable Row;Rowing Poulie Assis;Rowing Poulie Assis - Prise en V|poulie|poly_haut|dos|biceps delt_post
Rowing unilatéral à la poulie|Single Arm Cable Row;Single Arm Seated Row (Cable)|poulie|poly_haut|dos|biceps delt_post
Rowing assis machine|Seated Row (Machine);Machine Row|machine_pile|poly_haut|dos|biceps delt_post
Rowing iso-latéral|Iso-Lateral Row (Machine);Iso-Lateral Low Row;Low Row (Machine)|machine_plaques|poly_haut|dos|biceps delt_post
Rowing inversé (australien)|Inverted Row;Australian Pull Up|poids_du_corps|poly_haut|dos|biceps delt_post
Pull-over à la poulie haute (bras tendus)|Straight Arm Pulldown;Straight Arm Lat Pulldown (Cable);Cable Pullover|poulie|iso|dos|
Pull-over machine|Pullover (Machine);Machine Pullover|machine_pile|iso|dos|
Soulevé de terre|Deadlift (Barbell);Deadlift;Conventional Deadlift|barre|poly_bas|fessiers|ischios lombaires quadriceps
Soulevé de terre sumo|Sumo Deadlift (Barbell);Sumo Deadlift|barre|poly_bas|fessiers|quadriceps adducteurs ischios
Soulevé de terre trap bar|Trap Bar Deadlift;Hex Bar Deadlift|barre|poly_bas|quadriceps|fessiers ischios
Rack pull|Rack Pull;Rack Pull (Barbell)|barre|poly_bas|dos|fessiers trapezes lombaires
Hyperextension (banc à lombaires)|Back Extension;Hyperextension;45 Degree Back Extension;Extension Dos (Hyperextension)|poids_du_corps|iso|lombaires|fessiers ischios
Extension du dos (machine)|Back Extension (Machine);Lower Back Extension (Machine)|machine_pile|iso|lombaires|fessiers
Shrug haltères|Shrug (Dumbbell);Dumbbell Shrug|halteres|iso|trapezes|
Shrug barre|Shrug (Barbell);Barbell Shrug|barre|iso|trapezes|
Shrug Smith|Shrug (Smith Machine)|smith|iso|trapezes|
Face pull|Face Pull (Cable);Face Pull;Tirage vers le Visage|poulie|iso_petit|delt_post|trapezes
Rowing menton (upright row)|Upright Row (Barbell);Upright Row (Cable);Upright Row (Dumbbell)|barre|iso_petit|delt_lat|trapezes
Développé militaire barre (debout)|Overhead Press (Barbell);Strict Military Press (Barbell);Military Press;OHP;Développé Militaire (Barre)|barre|poly_haut|delt_ant|delt_lat triceps
Développé épaules haltères (assis)|Shoulder Press (Dumbbell);Seated Overhead Press (Dumbbell);Overhead Press (Dumbbell)|halteres|poly_haut|delt_ant|delt_lat triceps
Développé Arnold|Arnold Press (Dumbbell);Arnold Press|halteres|poly_haut|delt_ant|delt_lat triceps
Développé militaire Smith|Overhead Press (Smith Machine);Shoulder Press (Smith Machine);Seated Overhead Press (Smith Machine)|smith|poly_haut|delt_ant|delt_lat triceps
Développé épaules machine|Shoulder Press (Machine);Machine Shoulder Press|machine_pile|poly_haut|delt_ant|delt_lat triceps
Développé épaules iso-latéral Hammer Strength|Iso-Lateral Shoulder Press;Shoulder Press (Plate Loaded)|machine_plaques|poly_haut|delt_ant|delt_lat triceps
Landmine press|Landmine Press;Landmine Press (Barbell)|barre|poly_haut|delt_ant|pectoraux triceps
Élévations latérales haltères|Lateral Raise (Dumbbell);Dumbbell Lateral Raise;Side Lateral Raise;Élévation Latérale (Haltère)|halteres|iso_petit|delt_lat|
Élévations latérales poulie|Lateral Raise (Cable);Single Arm Lateral Raise (Cable);Cable Lateral Raise;Élévation Latérale Un Bras (Poulie);Élévation Latérale (Poulie)|poulie|iso_petit|delt_lat|
Élévations latérales machine|Lateral Raise (Machine);Machine Lateral Raise|machine_pile|iso_petit|delt_lat|
Élévations frontales haltères|Front Raise (Dumbbell);Dumbbell Front Raise|halteres|iso_petit|delt_ant|
Élévations frontales poulie|Front Raise (Cable);Cable Front Raise|poulie|iso_petit|delt_ant|
Écarté arrière (reverse pec deck)|Reverse Fly (Machine);Rear Delt Fly (Machine);Reverse Pec Deck|machine_pile|iso_petit|delt_post|
Oiseau haltères (buste penché)|Reverse Fly (Dumbbell);Bent Over Lateral Raise;Rear Delt Fly (Dumbbell);Oiseau Penché (Haltère)|halteres|iso_petit|delt_post|
Oiseau à la poulie (croisé)|Reverse Fly (Cable);Rear Delt Fly (Cable);Cable Reverse Fly|poulie|iso_petit|delt_post|
Curl barre|Bicep Curl (Barbell);Barbell Curl;Biceps Curl (Barbell);Curl Biceps (Barre)|barre|iso|biceps|
Curl barre EZ|EZ Bar Curl;Bicep Curl (EZ Bar);EZ-Bar Curl|barre|iso|biceps|
Curl haltères|Bicep Curl (Dumbbell);Dumbbell Curl;Biceps Curl (Dumbbell)|halteres|iso|biceps|
Curl marteau|Hammer Curl (Dumbbell);Hammer Curl;Curl Marteau (Haltère)|halteres|iso|biceps|avant_bras
Curl marteau à la corde (poulie)|Hammer Curl (Cable);Rope Hammer Curl;Cable Rope Hammer Curl|poulie|iso|biceps|avant_bras
Curl incliné haltères|Incline Curl (Dumbbell);Incline Dumbbell Curl|halteres|iso|biceps|
Curl pupitre barre EZ|Preacher Curl (Barbell);Preacher Curl (EZ Bar);EZ Bar Preacher Curl|barre|iso|biceps|
Curl pupitre haltère|Preacher Curl (Dumbbell);Dumbbell Preacher Curl|halteres|iso|biceps|
Curl pupitre machine|Preacher Curl (Machine);Bicep Curl (Machine);Machine Bicep Curl|machine_pile|iso|biceps|
Curl concentré|Concentration Curl (Dumbbell);Concentration Curl|halteres|iso|biceps|
Curl à la poulie basse|Bicep Curl (Cable);Cable Curl;Biceps Curl (Cable)|poulie|iso|biceps|
Curl poulie haute (bras écartés)|Overhead Cable Curl;High Cable Curl|poulie|iso|biceps|
Curl Bayesian (poulie derrière soi)|Bayesian Curl;Behind the Body Cable Curl|poulie|iso|biceps|
Curl araignée (spider curl)|Spider Curl (Dumbbell);Spider Curl (Barbell);Spider Curl|halteres|iso|biceps|
Curl inversé barre|Reverse Curl (Barbell);Reverse Grip Curl|barre|iso|avant_bras|biceps
Curl poignets|Wrist Curl (Barbell);Wrist Curl (Dumbbell);Wrist Curl|barre|iso_petit|avant_bras|
Curl poignets inversé|Reverse Wrist Curl (Barbell);Reverse Wrist Curl|barre|iso_petit|avant_bras|
Extension triceps à la poulie haute (pushdown)|Triceps Pushdown (Cable - Straight Bar);Triceps Pushdown;Tricep Pushdown;Triceps Pushdown (Cable - V Bar);Extension Triceps Poulie Haute|poulie|iso|triceps|
Extension triceps à la corde (poulie haute)|Triceps Rope Pushdown;Triceps Pushdown (Cable - Rope);Rope Pushdown|poulie|iso|triceps|
Extension triceps unilatérale (poulie haute)|Single Arm Triceps Pushdown (Cable);One Arm Triceps Pushdown|poulie|iso|triceps|
Extension triceps au-dessus de la tête (poulie)|Triceps Extension (Cable);Overhead Triceps Extension (Cable);Overhead Cable Triceps Extension|poulie|iso|triceps|
Extension triceps au-dessus de la tête (haltère)|Triceps Extension (Dumbbell);Overhead Triceps Extension (Dumbbell);Seated Triceps Press|halteres|iso|triceps|
Barre au front (skull crusher)|Skullcrusher (Barbell);Lying Triceps Extension (Barbell);Skull Crusher;Skullcrusher (EZ Bar)|barre|iso|triceps|
Barre au front haltères|Skullcrusher (Dumbbell);Lying Triceps Extension (Dumbbell)|halteres|iso|triceps|
Extension triceps machine|Triceps Extension (Machine);Machine Triceps Extension|machine_pile|iso|triceps|
Kickback triceps haltère|Triceps Kickback (Dumbbell);Tricep Kickback|halteres|iso|triceps|
Kickback triceps poulie|Triceps Kickback (Cable);Cable Kickback (Triceps)|poulie|iso|triceps|
Développé couché prise serrée|Close Grip Bench Press (Barbell);Close Grip Bench Press|barre|poly_haut|triceps|pectoraux delt_ant
Dips triceps (machine)|Triceps Dip (Machine);Seated Dip Machine;Dip Machine|machine_pile|poly_haut|triceps|pectoraux delt_ant
Dips entre deux bancs|Bench Dip|poids_du_corps|poly_haut|triceps|pectoraux delt_ant
Squat barre|Squat (Barbell);Back Squat (Barbell);Back Squat;High Bar Squat;Low Bar Squat|barre|poly_bas|quadriceps|fessiers adducteurs
Front squat|Front Squat (Barbell);Front Squat|barre|poly_bas|quadriceps|fessiers
Squat Smith|Squat (Smith Machine);Smith Machine Squat|smith|poly_bas|quadriceps|fessiers adducteurs
Squat goblet|Goblet Squat (Kettlebell);Goblet Squat (Dumbbell);Goblet Squat|kettlebell|poly_bas|quadriceps|fessiers adducteurs
Hack squat (machine)|Hack Squat;Hack Squat (Machine)|machine_plaques|poly_bas|quadriceps|fessiers
Pendulum squat|Pendulum Squat (Machine);Pendulum Squat|machine_plaques|poly_bas|quadriceps|fessiers
Belt squat|Belt Squat (Machine);Belt Squat|machine_plaques|poly_bas|quadriceps|fessiers
Presse à cuisses|Leg Press;Leg Press (Machine);45 Degree Leg Press|machine_plaques|poly_bas|quadriceps|fessiers
Presse à cuisses horizontale (pile)|Seated Leg Press (Machine);Horizontal Leg Press;Seated Leg Press;Presse à Cuisses Horizontale|machine_pile|poly_bas|quadriceps|fessiers
Leg extension|Leg Extension (Machine);Leg Extension;Extension Jambes (Machine)|machine_pile|iso|quadriceps|
Fentes haltères|Lunge (Dumbbell);Walking Lunge (Dumbbell);Dumbbell Lunge|halteres|poly_bas|quadriceps|fessiers adducteurs
Fentes arrière haltères|Reverse Lunge (Dumbbell);Reverse Lunge|halteres|poly_bas|quadriceps|fessiers adducteurs
Fentes barre|Lunge (Barbell);Walking Lunge (Barbell)|barre|poly_bas|quadriceps|fessiers adducteurs
Fentes Smith|Lunge (Smith Machine);Split Squat (Smith Machine)|smith|poly_bas|quadriceps|fessiers adducteurs
Squat bulgare haltères|Bulgarian Split Squat;Bulgarian Split Squat (Dumbbell);Split Squat (Dumbbell)|halteres|poly_bas|quadriceps|fessiers adducteurs
Step-up haltères|Step-up (Dumbbell);Step Up;Step-up|halteres|poly_bas|quadriceps|fessiers
Sissy squat|Sissy Squat|poids_du_corps|iso|quadriceps|
Leg curl assis|Seated Leg Curl (Machine);Seated Leg Curl|machine_pile|iso|ischios|
Leg curl allongé|Lying Leg Curl (Machine);Lying Leg Curl;Leg Curl (Machine)|machine_pile|iso|ischios|
Leg curl debout unilatéral|Standing Leg Curl (Machine);Standing Leg Curl|machine_pile|iso|ischios|
Soulevé de terre roumain barre|Romanian Deadlift (Barbell);Romanian Deadlift;RDL|barre|poly_bas|ischios|fessiers
Soulevé de terre roumain haltères|Romanian Deadlift (Dumbbell);Dumbbell Romanian Deadlift|halteres|poly_bas|ischios|fessiers
Soulevé de terre roumain Smith|Romanian Deadlift (Smith Machine)|smith|poly_bas|ischios|fessiers
Soulevé de terre jambes tendues|Stiff Leg Deadlift (Barbell);Straight Leg Deadlift;Stiff Leg Deadlift|barre|poly_bas|ischios|fessiers lombaires
Soulevé de terre roumain unilatéral (haltère)|Single Leg Romanian Deadlift (Dumbbell);Single Leg Deadlift|halteres|poly_bas|ischios|fessiers
Good morning|Good Morning (Barbell);Good Morning;Good Morning (Barre)|barre|poly_bas|ischios|fessiers lombaires
Nordic curl|Nordic Hamstring Curl;Nordic Curl|poids_du_corps|iso|ischios|
Hip thrust barre|Hip Thrust (Barbell);Barbell Hip Thrust;Hip Thrust|barre|poly_bas|fessiers|ischios
Hip thrust machine|Hip Thrust (Machine);Glute Drive;Machine Hip Thrust|machine_plaques|poly_bas|fessiers|ischios
Hip thrust Smith|Hip Thrust (Smith Machine)|smith|poly_bas|fessiers|ischios
Pont fessier|Glute Bridge;Glute Bridge (Barbell)|poids_du_corps|poly_bas|fessiers|ischios
Kickback fessier machine|Glute Kickback (Machine);Glute Machine;Rear Kick (Machine)|machine_pile|iso|fessiers|ischios
Kickback fessier poulie|Glute Kickback (Cable);Cable Kickback;Cable Glute Kickback|poulie|iso|fessiers|ischios
Abduction hanche (machine)|Hip Abductor (Machine);Hip Abduction (Machine);Abductor Machine|machine_pile|iso|fessiers|
Abduction hanche poulie|Hip Abduction (Cable);Cable Hip Abduction|poulie|iso|fessiers|
Adduction hanche (machine)|Hip Adductor (Machine);Hip Adduction (Machine);Adductor Machine|machine_pile|iso|adducteurs|
Adduction hanche poulie|Hip Adduction (Cable);Cable Hip Adduction|poulie|iso|adducteurs|
Kettlebell swing|Kettlebell Swing;Russian Kettlebell Swing|kettlebell|poly_bas|fessiers|ischios lombaires
Mollets debout machine|Standing Calf Raise (Machine);Calf Raise (Machine);Standing Calf Raise|machine_pile|iso|mollets|
Mollets assis machine|Seated Calf Raise (Machine);Seated Calf Raise (Plate Loaded);Seated Calf Raise|machine_plaques|iso|mollets|
Mollets à la presse|Calf Press on Leg Press;Calf Press (Machine);Leg Press Calf Raise|machine_plaques|iso|mollets|
Mollets Smith|Standing Calf Raise (Smith Machine);Calf Raise (Smith Machine)|smith|iso|mollets|
Mollets haltères|Standing Calf Raise (Dumbbell);Calf Raise (Dumbbell);Single Leg Calf Raise (Dumbbell)|halteres|iso|mollets|
Crunch machine|Crunch (Machine);Ab Crunch Machine;Abdominal Crunch (Machine)|machine_pile|iso|abdos|
Crunch à la poulie haute|Cable Crunch;Crunch (Cable);Kneeling Cable Crunch|poulie|iso|abdos|
Crunch|Crunch;Crunches|poids_du_corps|iso|abdos|
Crunch décliné|Decline Crunch;Decline Sit Up|poids_du_corps|iso|abdos|
Relevé de jambes suspendu|Hanging Leg Raise;Hanging Knee Raise|poids_du_corps|iso|abdos|
Relevé de jambes à la chaise romaine|Knee Raise (Captain's Chair);Captain's Chair Leg Raise;Vertical Knee Raise|poids_du_corps|iso|abdos|
Relevé de jambes au sol|Lying Leg Raise;Leg Raise;Leg Raises|poids_du_corps|iso|abdos|
Roue abdominale|Ab Wheel;Ab Wheel Rollout;Ab Roller|poids_du_corps|iso|abdos|
Rotation du buste (machine)|Torso Rotation (Machine);Rotary Torso;Torso Rotation|machine_pile|iso|abdos|
Woodchopper à la poulie|Wood Chop (Cable);Cable Woodchopper;Cable Wood Chop|poulie|iso|abdos|
Russian twist|Russian Twist;Russian Twist (Weighted)|poids_du_corps|iso|abdos|
Flexion latérale haltère|Side Bend (Dumbbell);Dumbbell Side Bend|halteres|iso|abdos|
`;

export const BIBLIOTHEQUE = LIGNES.trim().split('\n').map(l => {
  const [nom, strong, materiel, type, musclePrincipal, sec] = l.split('|');
  return { nom, strong: strong.split(';'), materiel, type, musclePrincipal, musclesSecondaires: sec ? sec.split(' ') : [] };
});

const texte = b => norm([b.nom, ...(b.strong ?? []), NOM_MUSCLE[b.musclePrincipal], MATERIELS[b.materiel].nom].join(' '));
// Chaque mot tapé doit apparaître (dans le nom français, un nom Strong, le muscle ou le matériel).
export function chercher(q, liste = BIBLIOTHEQUE) {
  const mots = norm(q).split(' ').filter(Boolean);
  return liste.filter(b => mots.every(m => texte(b).includes(m)));
}

// Nom Strong (anglais) ou français → fiche de la bibliothèque.
const PAR_NOM = new Map(BIBLIOTHEQUE.flatMap(b => [b.nom, ...b.strong].map(n => [norm(n), b])));
export const trouver = nom => PAR_NOM.get(norm(nom)) ?? null;

export const depuisBibliotheque = b => nouvelExercice(structuredClone(b));

// Nom inconnu (exercice perso de Strong) : gardé tel quel ; muscle et type pris sur la fiche qui partage le plus de mots,
// matériel lu dans le nom quand il y est. null si aucun mot en commun.
const MATERIEL_DU_NOM = [[/smith/, 'smith'], [/barbell|barre|ez bar/, 'barre'], [/dumbbell|haltere/, 'halteres'], [/cable|poulie/, 'poulie'],
  [/kettlebell/, 'kettlebell'], [/plate loaded|hammer|disques/, 'machine_plaques'], [/machine/, 'machine_pile'], [/bodyweight|weighted|leste|poids du corps/, 'poids_du_corps']];
export function deviner(nom) {
  const n = norm(nom), mots = n.replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(m => m.length >= 3);
  let best = null, score = 0;
  for (const b of BIBLIOTHEQUE) {
    const t = texte(b), sc = mots.filter(m => t.includes(m)).length;
    if (sc > score) { best = b; score = sc; }
  }
  if (!best) return null;
  const materiel = MATERIEL_DU_NOM.find(([re]) => re.test(n))?.[1] ?? best.materiel;
  return { nom, materiel, type: best.type, musclePrincipal: best.musclePrincipal, musclesSecondaires: [...best.musclesSecondaires] };
}

// Import Strong : ton exercice du même nom d'abord, sinon la fiche de la bibliothèque (« biblio:<n° de ligne> »),
// sinon un exercice créé sous son nom Strong (« creer »), sinon rien.
export function correspondanceAvecBibliotheque(noms, state, auto) {
  return Object.fromEntries(noms.map(n => {
    if (auto[n]) return [n, auto[n]];
    const b = trouver(n);
    if (!b) return [n, deviner(n) ? 'creer' : null];
    const mien = state.exercises.find(e => !e.archive && norm(e.nom) === norm(b.nom));
    return [n, mien ? mien.id : 'biblio:' + BIBLIOTHEQUE.indexOf(b)];
  }));
}

// Remplace les « biblio:n » par de vrais exercices, créés une seule fois même si plusieurs noms Strong y mènent.
export function creerDepuisCorrespondance(corr) {
  const crees = {}, nouveaux = [];
  const out = Object.fromEntries(Object.entries(corr).map(([n, v]) => {
    if (v === 'creer') { const e = nouvelExercice(deviner(n)); nouveaux.push(e); return [n, e.id]; }
    if (!v?.startsWith('biblio:')) return [n, v];
    if (!crees[v]) { const e = depuisBibliotheque(BIBLIOTHEQUE[+v.slice(7)]); crees[v] = e.id; nouveaux.push(e); }
    return [n, crees[v]];
  }));
  return { corr: out, nouveaux };
}
