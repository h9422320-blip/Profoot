import { Club } from "./data";

// 1. TACTICAL ENGINE - Elite Club Profiles
export const clubProfiles: Record<string, any> = {
  "psg": {
    playstyle: "possession asymétrique et surcharges latérales",
    defensiveBlock: "bloc médian-haut à géométrie variable",
    pressing: "pressing orienté sur les touches, intensité inconstante",
    transitions: "explosivité létale à la récupération, recherche immédiate des ailiers en 1v1",
    keyStrength: "capacité d'élimination individuelle et isolation des zones clés",
    keyWeakness: "vulnérabilité chronique dans la gestion de la profondeur axiale et repli des ailiers",
    formation: "4-3-3 hybride / 4-2-4 en phase offensive",
    tempo: "irrégulier, alternance de passes latérales et d'accélérations verticales foudroyantes",
    keyPlayers: ["Bradley Barcola", "Ousmane Dembélé", "Vitinha"],
    coachPhilosophy: "Luis Enrique : contrôle par la possession et fixation latérale",
    narrativeKeywords: ["explosivité", "déséquilibre", "fixation", "foudre", "transitions éclairs", "surcharges"]
  },
  "barcelona": {
    playstyle: "Juego de Posición moderne, contrôle absolu du tempo au milieu",
    defensiveBlock: "ligne défensive extrêmement haute, compacité axiale",
    pressing: "contre-pressing (Gegenpressing) féroce dès la perte à la récupération immédiate",
    transitions: "patience en transition offensive, recherche systématique du 3ème homme",
    keyStrength: "maîtrise technique sous pression et création de supériorités numériques (Tiki-Taka)",
    keyWeakness: "espace béant laissé dans le dos de la charnière centrale face aux transitions rapides",
    formation: "4-3-3 fluide",
    tempo: "métronomique, accélération brutale aux abords de la surface",
    keyPlayers: ["Lamine Yamal", "Pedri", "Robert Lewandowski"],
    coachPhilosophy: "Hansi Flick : verticalité contrôlée et intensité physique",
    narrativeKeywords: ["Juego de Posición", "académisme", "contrôle total", "3ème homme", "demi-espaces"]
  },
  "realmadrid": {
    playstyle: "pragmatisme élitiste, chaos organisé et fluidité totale en attaque",
    defensiveBlock: "bloc médian résilient, capacité unique à subir sans concéder",
    pressing: "pressing déclenché par à-coups (triggers spécifiques)",
    transitions: "les meilleures transitions offensives du monde, jeu direct et létal",
    keyStrength: "gestion émotionnelle hors norme, aura européenne et efficacité clinique",
    keyWeakness: "apathie occasionnelle face à des blocs très bas et denses",
    formation: "4-3-1-2 losange ou 4-3-3 asymétrique",
    tempo: "réactif, capable d'absorber le rythme adverse pour mieux punir",
    keyPlayers: ["Kylian Mbappé", "Vinícius Júnior", "Jude Bellingham"],
    coachPhilosophy: "Carlo Ancelotti : gestion humaine, liberté créative et adaptation",
    narrativeKeywords: ["pragmatisme clinique", "aura galactique", "cynisme", "gestion émotionnelle", "chaos contrôlé"]
  },
  "mancity": {
    playstyle: "domination territoriale, latéraux inversés et occupation des 5 couloirs",
    defensiveBlock: "bloc très haut, ligne de hors-jeu agressive",
    pressing: "structure de pressing millimétrée, étouffement de la relance adverse",
    transitions: "contrôle absolu, limitation stricte des phases de transition ouverte",
    keyStrength: "asphyxie tactique et capacité à démonter les blocs bas via les demi-espaces",
    keyWeakness: "les ballons dans la diagonale si le premier rideau de pressing est franchi",
    formation: "3-2-4-1 (phase de possession)",
    tempo: "lent et hypnotique, dicté par le tempo du numéro 6",
    keyPlayers: ["Rodri", "Erling Haaland", "Kevin De Bruyne"],
    coachPhilosophy: "Pep Guardiola : contrôle total, minimisation de l'aléa",
    narrativeKeywords: ["machine tactique", "asphyxie", "latéraux inversés", "occupation spatiale", "rouleau compresseur"]
  },
  "liverpool": {
    playstyle: "Heavy Metal Football, jeu très direct vers les zones excentrées",
    defensiveBlock: "ligne haute et agressive, piège du hors-jeu",
    pressing: "Gegenpressing d'une intensité folle, meutes à la récupération",
    transitions: "verticalité absolue dès la récupération, recherche immédiate de la profondeur",
    keyStrength: "intensité physique et psychologique insoutenable pour l'adversaire",
    keyWeakness: "gestion de la fatigue sur la durée du match et espaces laissés par les latéraux",
    formation: "4-3-3 très écarté",
    tempo: "frénétique, refus du calcul",
    keyPlayers: ["Mohamed Salah", "Trent Alexander-Arnold", "Virgil van Dijk"],
    coachPhilosophy: "Arne Slot : pressing, jeu direct et structure évolutive",
    narrativeKeywords: ["Heavy Metal", "Gegenpressing", "fureur", "vagues incessantes", "verticalité foudroyante"]
  },
  "arsenal": {
    playstyle: "structuration positionnelle stricte, surcharges à droite et isolations à gauche",
    defensiveBlock: "la meilleure structure défensive d'Europe, bloc médian infranchissable",
    pressing: "pressing hybride individuel/zone très coordonné",
    transitions: "sorties de balle sous pression d'une grande fluidité",
    keyStrength: "contrôle du jeu, domination sur coups de pied arrêtés (CPA) et charnière centrale d'élite",
    keyWeakness: "manque de folie ou de cynisme dans les matchs fermés à double tour",
    formation: "4-3-3 ou 4-2-3-1 asymétrique",
    tempo: "méthodique, calculé",
    keyPlayers: ["Bukayo Saka", "Martin Ødegaard", "William Saliba"],
    coachPhilosophy: "Mikel Arteta : rigidité positionnelle et maîtrise des détails",
    narrativeKeywords: ["CPA", "structure granitique", "surcharges", "méthode", "domination axiale"]
  },
  "atletico": {
    playstyle: "Cholismo, bloc ultra-compact, refus volontaire de la possession",
    defensiveBlock: "bloc très bas et resserré, coulissement parfait des lignes",
    pressing: "pressing de zone dans leur propre moitié de terrain, agressivité extrême sur le porteur",
    transitions: "contres assassins menés à 3 ou 4 joueurs maximum",
    keyStrength: "résilience psychologique, sacrifice collectif et art de la souffrance",
    keyWeakness: "incapacité chronique à créer du jeu s'ils sont menés au score",
    formation: "5-3-2 ou 4-4-2 à plat",
    tempo: "haché, ralentissement constant du jeu, guerre psychologique",
    keyPlayers: ["Antoine Griezmann", "Jan Oblak", "Koke"],
    coachPhilosophy: "Diego Simeone : combat, discipline tactique et bloc équipe",
    narrativeKeywords: ["guerre de tranchées", "Cholismo", "mur de fer", "abnégation", "guérilla tactique"]
  },
  "inter": {
    playstyle: "système à trois centraux, utilisation agressive des pistons (Wing-backs)",
    defensiveBlock: "ligne de 5 très disciplinée, bloc médian solide",
    pressing: "pressing déclenché sur des zones spécifiques, notamment sur les côtés",
    transitions: "fluidité remarquable avec projections des milieux relayeurs",
    keyStrength: "les dédoublements extérieurs et l'entente des deux attaquants axiaux",
    keyWeakness: "difficulté si l'adversaire bloque les couloirs et aspire les centraux",
    formation: "3-5-2 classique italien",
    tempo: "maîtrisé, verticalisation soudaine vers le duo d'attaque",
    keyPlayers: ["Lautaro Martínez", "Nicolò Barella", "Federico Dimarco"],
    coachPhilosophy: "Simone Inzaghi : flexibilité du 3-5-2 et verticalité contrôlée",
    narrativeKeywords: ["pistons", "catenaccio moderne", "duo d'attaque", "transitions fluides", "science tactique"]
  },
  "monaco": {
    playstyle: "jeu très vertical, pressing haut et densité dans l'axe",
    defensiveBlock: "défense pro-active, marquage individuel audacieux",
    pressing: "intensité maximale dans le camp adverse",
    transitions: "recherche immédiate des espaces dans le dos de la défense",
    keyStrength: "la vitesse d'exécution et le surnombre à la récupération",
    keyWeakness: "les déséquilibres béants si le premier rideau est éliminé",
    formation: "3-4-2-1 ou 4-4-2",
    tempo: "très élevé, match souvent ouvert et débridé",
    keyPlayers: ["Takumi Minamino", "Denis Zakaria", "Breel Embolo"],
    coachPhilosophy: "Adi Hütter : football total et pressing autrichien",
    narrativeKeywords: ["étincelles", "football champagne", "déséquilibre", "intensité", "marquage individuel"]
  },
  "lens": {
    playstyle: "impact athlétique, pistons ultra-offensifs et jeu direct",
    defensiveBlock: "bloc haut, ligne de 3 solide et rugueuse",
    pressing: "harcèlement constant du porteur de balle",
    transitions: "projection en nombre à la récupération",
    keyStrength: "l'impact physique, le jeu de tête et l'apport des côtés",
    keyWeakness: "manque de créativité face à un adversaire qui refuse le combat physique",
    formation: "3-4-2-1",
    tempo: "suffocant, engagement total",
    keyPlayers: ["Florian Sotoca", "Kevin Danso", "Przemysław Frankowski"],
    coachPhilosophy: "Will Still : énergie, data et intensité",
    narrativeKeywords: ["combat", "Sang et Or", "intensité athlétique", "harcèlement", "poumons"]
  },
  "villarreal": {
    playstyle: "jeu combiné, possession prudente et sorties de balle au sol",
    defensiveBlock: "bloc médian très bien organisé en 2 lignes de 4",
    pressing: "orienté pour fermer les lignes de passes axiales",
    transitions: "sorties de balle propres et rapides si l'espace est ouvert",
    keyStrength: "la qualité technique du milieu de terrain et l'intelligence de jeu",
    keyWeakness: "manque d'impact athlétique et de profondeur face à des défenses rapides",
    formation: "4-4-2 ou 4-2-3-1",
    tempo: "moyen, maîtrise patiente",
    keyPlayers: ["Gerard Moreno", "Álex Baena", "Dani Parejo"],
    coachPhilosophy: "Marcelino : structure, 4-4-2 classique et transitions rapides",
    narrativeKeywords: ["Sous-marin jaune", "prudence", "technique", "jeu entre les lignes", "structure 4-4-2"]
  },
  "default": {
    playstyle: "organisation adaptative, recherche d'équilibre",
    defensiveBlock: "bloc médian en zone",
    pressing: "pressing modéré",
    transitions: "transitions structurées",
    keyStrength: "solidité collective de base",
    keyWeakness: "vulnérabilité face à des systèmes très spécifiques",
    formation: "4-2-3-1",
    tempo: "modéré",
    keyPlayers: ["Le meneur", "Le buteur", "Le roc"],
    coachPhilosophy: "Pragmatisme et adaptation à l'adversaire",
    narrativeKeywords: ["équilibre", "organisation", "bataille du milieu", "pragmatisme"]
  }
};

// Helpers for randomization
const randomChoice = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const pickRandomElements = (arr: any[], count: number) => [...arr].sort(() => 0.5 - Math.random()).slice(0, count);

// 2. CONTEXT ENGINE
// Fakes dynamic context (injuries, momentum, real world stakes)
function generateContext(c1: Club, c2: Club) {
  const stakes = ["une place européenne", "le titre", "la survie en première partie de tableau", "une question de suprématie psychologique", "l'honneur dans ce choc historique"];
  const dynamiques = [
    "vient de traverser une zone de turbulences en championnat",
    "surfe sur une série de résultats extrêmement positifs",
    "sort d'une performance majuscule tactiquement",
    "cherche encore la bonne formule au milieu de terrain"
  ];
  return {
    stake: randomChoice(stakes),
    dyn1: randomChoice(dynamiques),
    dyn2: randomChoice(dynamiques)
  };
}

// 3. NARRATIVE ENGINE
// A massively expanded library of phrasing to ensure NO repetition.
const NarrativeLibrary = {
  intro: [
    (fav: any, under: any, ctx: any) => `Le contexte est électrique. Au-delà de ${ctx.stake}, cette affiche nous offre un véritable laboratoire tactique. Le ${fav.profile.playstyle} prôné par ${fav.club.coach} va se frotter au ${under.profile.defensiveBlock} de ${under.club.name}. C'est une opposition paradigmatique du football moderne.`,
    (fav: any, under: any, ctx: any) => `C'est un choc asymétrique par excellence. D'un côté, ${fav.club.name} (${ctx.dyn1}) compte imposer sa loi via son ${fav.profile.narrativeKeywords[0]}. De l'autre, ${under.club.name} arrive avec un plan de jeu axé sur ${under.profile.playstyle}. Le rapport de force au milieu du terrain décidera de l'issue.`,
    (fav: any, under: any, ctx: any) => `Oubliez les classements un instant. Le duel entre la philosophie de ${fav.club.coach} et celle de ${under.club.coach} est fascinant. ${fav.club.name} mise sur son ${fav.profile.narrativeKeywords[1]} tandis que ${under.club.name} tentera de déjouer les pronostics grâce à une approche basée sur ${under.profile.narrativeKeywords[0]}.`,
    (fav: any, under: any, ctx: any) => `Analyse de haut vol en perspective. ${fav.club.name} cherchera à dicter un tempo ${fav.profile.tempo}. Si l'on regarde les datas, ${under.club.name} (${ctx.dyn2}) a précisément les armes pour répondre avec ses ${under.profile.narrativeKeywords[1]}.`
  ],
  tactical: [
    (fav: any, under: any) => `Sur le tableau noir, la friction se situe dans la gestion de l'espace. ${fav.club.name} va déployer son ${fav.profile.formation}, cherchant à activer ${fav.profile.keyPlayers[0]}. L'enjeu pour ${under.club.name} sera de maintenir son ${under.profile.defensiveBlock} tout en exploitant ${fav.profile.keyWeakness}. Le déclenchement du pressing de ${under.club.name} sera chirurgical.`,
    (fav: any, under: any) => `La bataille des demi-espaces s'annonce féroce. La structure de ${fav.club.name} vise à créer des surcharges autour de ${fav.profile.keyPlayers[1]}. Pour y répondre, ${under.club.coach} a probablement préparé un dispositif spécifique pour fermer ces couloirs intérieurs, forçant ${fav.club.name} à utiliser la largeur.`,
    (fav: any, under: any) => `C'est une partie d'échecs tactique. Le ${fav.profile.pressing} de ${fav.club.name} risque d'asphyxier la relance adverse. Cependant, si ${under.club.name} parvient à trouver ${under.profile.keyPlayers[0]} en sortie de balle, la transition pourrait être fatale, exposant directement la charnière de ${fav.club.name}.`,
    (fav: any, under: any) => `L'algorithme identifie la gestion du rythme comme facteur X. ${fav.club.name} excelle dans un tempo ${fav.profile.tempo}. Si ${under.club.name} impose un rythme différent, notamment via son ${under.profile.playstyle}, le plan de jeu de ${fav.club.name} pourrait sérieusement s'enrayer.`
  ],
  offensive: [
    (fav: any, under: any) => `En phase de possession, la data indique que ${fav.club.name} surperforme souvent ses xG grâce à ${fav.profile.keyStrength}. La finition de ${fav.profile.keyPlayers[2]} dans les zones de vérité est clinique. ${under.club.name}, au contraire, mise sur une efficacité rationnelle, maximisant chaque ${under.profile.transitions}.`,
    (fav: any, under: any) => `L'animation offensive de ${fav.club.name} s'appuie énormément sur ${fav.profile.narrativeKeywords[2]}. Ils chercheront systématiquement à isoler leurs ailiers. Du côté de ${under.club.name}, le salut viendra sûrement du jeu combiné autour de ${under.profile.keyPlayers[1]}, cherchant à piquer dans le dos des latéraux de ${fav.club.name}.`,
    (fav: any, under: any) => `Offensivement, c'est le jour et la nuit. ${fav.club.name} attaque en vagues successives (style ${fav.profile.narrativeKeywords[0]}). ${under.club.name} adopte une posture plus attentiste, mais les statistiques prouvent que leur capacité à punir sur une seule perte de balle adverse dans l'axe est l'une des meilleures d'Europe.`
  ],
  defensive: [
    (fav: any, under: any) => `Défensivement, le modèle de ${fav.club.name} (${fav.profile.defensiveBlock}) exige une concentration absolue. La moindre faille sera exploitée par ${under.profile.keyPlayers[2]} qui rôde entre les lignes. L'indicateur PPDA (Passes Allowed Per Defensive Action) montre que ${under.club.name} tentera de casser ce pressing par un jeu plus direct.`,
    (fav: any, under: any) => `La solidité de ${under.club.name} réside dans son ${under.profile.defensiveBlock}. C'est une forteresse difficile à manœuvrer. ${fav.club.name} devra faire preuve d'énormément de créativité ou s'en remettre à une fulgurance de ${fav.profile.keyPlayers[0]} pour déverrouiller la situation.`,
    (fav: any, under: any) => `La gestion des transitions à la perte du ballon sera vitale. ${fav.club.name} a montré des signes de ${fav.profile.keyWeakness} cette saison. Face à l'intensité du ${under.profile.pressing} de ${under.club.name}, une perte de balle dans la zone de construction pourrait coûter très cher.`
  ],
  factors: [
    (fav: any, under: any, ctx: any) => `• La zone de vérité : L'affrontement entre ${fav.profile.keyPlayers[1]} et l'arrière-garde de ${under.club.name} dictera le match.\n• Le point de bascule : Les datas anticipent un creux physique pour ${under.club.name} vers la 70ème minute.\n• Enjeu caché : Ce match est crucial pour ${ctx.stake}.`,
    (fav: any, under: any, ctx: any) => `• Le joueur clé de l'ombre : Le travail de récupération de ${under.profile.keyPlayers[2]} sera essentiel.\n• Vulnérabilité IA : Le modèle a détecté que ${fav.club.name} encaisse 40% de ses buts suite à une erreur dans les 30 derniers mètres.\n• Mental : ${fav.club.name} ${ctx.dyn1}, ce qui impacte leur confiance globale.`,
    (fav: any, under: any, ctx: any) => `• Le thermomètre : Si ${fav.profile.keyPlayers[0]} réussit plus de 85% de ses passes vers l'avant, la victoire est quasiment assurée.\n• Faille identifiée : ${under.profile.keyWeakness} est une véritable aubaine pour ${fav.club.name}.\n• Stratégie du banc : L'apport des remplaçants sera la clé tactique de ${fav.club.coach} en seconde période.`
  ]
};

// 4. MAIN AI ENGINE EXPORT
export function generateAdvancedAnalysis(c1: Club, c2: Club) {
  const p1 = clubProfiles[c1.id] || clubProfiles["default"];
  const p2 = clubProfiles[c2.id] || clubProfiles["default"];

  const ctx = generateContext(c1, c2);

  // PREDICTION ENGINE (Dynamic probabilities based on style mismatch)
  const s1 = c1.stats || { played: 0, goalsScored: 0, goalsConceded: 0, possession: 50, xG: 0, cleanSheets: 0 };
  const s2 = c2.stats || { played: 0, goalsScored: 0, goalsConceded: 0, possession: 50, xG: 0, cleanSheets: 0 };
  
  const off1 = s1.played > 0 ? s1.goalsScored / s1.played : 1.2;
  const off2 = s2.played > 0 ? s2.goalsScored / s2.played : 1.2;
  const def1 = s1.played > 0 ? s1.goalsConceded / s1.played : 1.2;
  const def2 = s2.played > 0 ? s2.goalsConceded / s2.played : 1.2;
  const ppg1 = s1.played > 0 ? c1.points / s1.played : 1.5;
  const ppg2 = s2.played > 0 ? c2.points / s2.played : 1.5;

  let str1 = ppg1 * 40 + off1 * 20 + (1 - def1) * 20 + s1.possession * 0.2;
  let str2 = ppg2 * 40 + off2 * 20 + (1 - def2) * 20 + s2.possession * 0.2;

  // Tactical mismatch modifiers
  if (p1.playstyle.includes("possession") && p2.playstyle.includes("transitions")) {
      str2 += 5; // Counter-attacking teams do well against possession
  }
  if (p1.playstyle.includes("pragmatisme") && p2.playstyle.includes("possession")) {
      str1 += 5; 
  }

  const total = str1 + str2 || 1;
  const win1Raw = (str1 / total) * 100;
  
  const randOffset = (Math.random() * 8) - 4; 
  let win1 = Math.round(Math.max(15, Math.min(85, win1Raw + randOffset)));
  let draw = Math.round(Math.max(15, 35 - Math.abs(win1Raw - 50) * 0.4 + (Math.random() * 5)));
  let win2 = 100 - win1 - draw;

  if(win2 < 10) { win2 = 10; draw = 100 - win1 - win2; }
  
  const expectedGoals1 = off1 * def2 * 1.3;
  const expectedGoals2 = off2 * def1 * 0.9;
  
  const gs1 = Math.max(0, Math.round(expectedGoals1 + (Math.random() * 1.5 - 0.5)));
  const gs2 = Math.max(0, Math.round(expectedGoals2 + (Math.random() * 1.5 - 0.5)));
  
  const confidence = Math.round(75 + Math.abs(win1 - win2) * 0.4 + (Math.random() * 8));

  const isC1Fav = win1 >= win2;
  const favNode = { club: isC1Fav ? c1 : c2, profile: isC1Fav ? p1 : p2, winProb: Math.max(win1, win2) };
  const underNode = { club: isC1Fav ? c2 : c1, profile: isC1Fav ? p2 : p1, winProb: Math.min(win1, win2) };

  // Generate completely unique narrative structures
  const summary = randomChoice(NarrativeLibrary.intro)(favNode, underNode, ctx);
  const tacticalContent = randomChoice(NarrativeLibrary.tactical)(favNode, underNode);
  const offensiveContent = randomChoice(NarrativeLibrary.offensive)(favNode, underNode);
  const defensiveContent = randomChoice(NarrativeLibrary.defensive)(favNode, underNode);
  const factorsContent = randomChoice(NarrativeLibrary.factors)(favNode, underNode, ctx);

  const scenarioOptions = [
    `Le match devrait se décanter très rapidement. Si ${favNode.club.name} parvient à imposer sa loi au milieu dès le coup d'envoi, le bloc de ${underNode.club.name} risque de s'effriter sous la pression. L'intensité des 20 premières minutes sera cruciale.`,
    `Attendez-vous à un véritable round d'observation. ${underNode.club.name} va délibérément casser le rythme pour frustrer l'animation de ${favNode.club.name}. L'ouverture du score pourrait venir d'une erreur d'inattention ou d'une fulgurance individuelle.`,
    `Un bras de fer tactique pur et dur. Les deux équipes vont se livrer un combat athlétique au milieu de terrain. La différence se fera probablement en seconde période, lorsque la fatigue étirera les lignes et offrira des espaces aux joueurs de rupture.`
  ];

  // 3. Advanced Metrics Simulator
  // Simulate highly realistic data based on profiles
  const basePossession1 = p1.playstyle.includes("possession") || p1.playstyle.includes("contrôle") ? 60 : 45;
  const basePossession2 = p2.playstyle.includes("possession") || p2.playstyle.includes("contrôle") ? 60 : 45;
  
  let poss1 = Math.round((basePossession1 / (basePossession1 + basePossession2)) * 100);
  let poss2 = 100 - poss1;
  // Add some slight randomness
  poss1 = Math.max(25, Math.min(75, poss1 + (Math.random() * 6 - 3)));
  poss2 = 100 - poss1;

  // xG (Expected Goals)
  const xG1 = Math.max(0.5, expectedGoals1 + (Math.random() * 0.4 - 0.2)).toFixed(2);
  const xG2 = Math.max(0.5, expectedGoals2 + (Math.random() * 0.4 - 0.2)).toFixed(2);

  // xT (Expected Threat - measures danger created via passes/dribbles)
  const xT1 = Math.max(0.8, (parseFloat(xG1) * 1.3) + (poss1 / 100)).toFixed(2);
  const xT2 = Math.max(0.8, (parseFloat(xG2) * 1.3) + (poss2 / 100)).toFixed(2);

  // PPDA (Passes Allowed Per Defensive Action - lower is better pressing)
  const ppdaBase1 = p1.pressing.includes("intense") || p1.pressing.includes("Gegenpressing") ? 7 : 12;
  const ppdaBase2 = p2.pressing.includes("intense") || p2.pressing.includes("Gegenpressing") ? 7 : 12;
  
  const ppda1 = Math.max(5, ppdaBase1 + (Math.random() * 3 - 1.5)).toFixed(1);
  const ppda2 = Math.max(5, ppdaBase2 + (Math.random() * 3 - 1.5)).toFixed(1);

  const advancedMetrics = {
    possession: { team1: Math.round(poss1), team2: Math.round(poss2) },
    xG: { team1: parseFloat(xG1), team2: parseFloat(xG2) },
    xT: { team1: parseFloat(xT1), team2: parseFloat(xT2) },
    ppda: { team1: parseFloat(ppda1), team2: parseFloat(ppda2) }
  };

  return {
    score: `${isC1Fav ? gs1 : gs2} - ${isC1Fav ? gs2 : gs1}`,
    confidence: Math.min(confidence, 99),
    winProb: win1,
    drawProb: draw,
    loseProb: win2,
    favorite: favNode.club,
    underdog: underNode.club,
    summary,
    scenario: randomChoice(scenarioOptions),
    advancedMetrics,
    sections: [
      { title: "Rapport Tactique & Opposition", icon: "Brain", content: tacticalContent },
      { title: "Modèles Offensifs & Création (xG)", icon: "Zap", content: offensiveContent },
      { title: "Structures Défensives & PPDA", icon: "Shield", content: defensiveContent },
      { title: "Facteurs X & Contextes", icon: "Users", content: factorsContent }
    ]
  };
}
