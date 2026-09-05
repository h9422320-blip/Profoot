/**
 * LA BANDE-ANNONCE : CE QU'UN VISITEUR NON ABONNÉ LIT AVANT DE PAYER.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * L'aperçu gratuit servait le « Résumé rapide » de l'analyse complète. Ce
 * résumé désigne le favori, cite les buts attendus chiffrés, et annonce parfois
 * le score : « Les buts attendus penchent vers Marseille : 1.9 contre 1.36 ».
 * Un visiteur avait donc la réponse sans payer. Les ventes se sont arrêtées.
 *
 * CE QU'UNE BONNE BANDE-ANNONCE FAIT, ET NE FAIT PAS
 *
 * Elle ne résume pas le film : elle donne envie de le voir. Trois exigences,
 * dans cet ordre :
 *
 *   SPÉCIFIQUE — deux matchs différents ne peuvent pas produire le même texte.
 *     Une phrase générique se repère au premier coup d'œil et ne vend rien ;
 *     pire, elle donne l'impression que rien n'a été calculé.
 *
 *   ÉQUILIBRÉE — chaque équipe reçoit un argument crédible, y compris celle
 *     qui va perdre. C'est la condition pour qu'on ne puisse PAS deviner le
 *     verdict. Une bande-annonce qui laisse deviner la fin ne fait pas payer.
 *
 *   VRAIE — chaque affirmation sort des données réellement observées : forme
 *     récente, buts marqués, buts encaissés, matchs sans encaisser, possession.
 *     Rien n'est inventé. Un visiteur qui connaît son équipe repère
 *     immédiatement une flatterie fausse, et il a raison de ne plus rien
 *     croire ensuite.
 *
 * AUCUN APPEL AU MODÈLE DE LANGAGE
 *
 * Ce texte est composé à partir de chiffres déjà en main. C'est instantané,
 * gratuit, et surtout ÇA NE PEUT PAS DÉRAPER : un modèle à qui l'on demande de
 * ne pas révéler le favori finit toujours par l'écrire d'une manière ou d'une
 * autre — « devrait dominer », « logiquement remporté par le favori ». Une
 * composition mécanique, elle, ne peut dire que ce qu'on l'autorise à dire.
 */

/**
 * Une entrée de forme récente, telle que l'application la produit.
 *
 * ── DEUX FORMATS, ET C'EST LE PIÈGE ─────────────────────────────────────
 *
 * Selon le chemin de code, `recentMatches` contient soit des lettres brutes
 * (« W », « D », « L »), soit des objets `{ opponent, score, result }`. La
 * première version ne lisait que les lettres : sur le format objet, chaque
 * entrée devenait « [object Object] », aucune ne commençait par W, et toute
 * équipe ressortait avec un bilan de 0-0-0.
 *
 * Le défaut ne plantait rien — il rendait simplement la forme muette, et le
 * texte se rabattait sur des formules vagues sans que personne ne sache
 * pourquoi.
 */
export type EntreeForme = string | { result?: string; opponent?: unknown; score?: unknown };

export interface FormeEquipe {
  recentMatches?: EntreeForme[];
  /** Buts marqués sur TOUTE la saison, pas sur les cinq derniers matchs. */
  goalsScored?: number;
  goalsConceded?: number;
  cleanSheets?: number;
  avgPossession?: number;
  /**
   * Nombre TOTAL de victoires de la saison — pas une série en cours.
   *
   * Le nom trompe, et il a trompé : lu comme une série, il a produit
   * « Rennes reste sur 17 victoires de rang » sous une forme V-N-D de 1-1-3.
   * Un lecteur qui suit ce club voit l'absurdité immédiatement, et cesse de
   * croire tout le reste de la page.
   */
  winStreak?: number;
  /** Matchs joués sur la saison. C'est LUI qui sert de diviseur. */
  played?: number;
  name?: string;
}

/** Bilan lu sur les cinq dernières rencontres. */
interface Bilan {
  v: number;
  n: number;
  d: number;
  /** Matchs joués sur la saison — le diviseur des moyennes. */
  joues: number;
  /** Nombre de matchs visibles dans la forme récente (cinq en général). */
  formeVus: number;
  butsPour: number;
  butsContre: number;
  clean: number;
  possession: number;
  /** Victoires sur toute la saison. */
  victoiresSaison: number;
}


/**
 * La lettre de resultat d une entree de forme, quel que soit son format.
 *
 * Accepte « W » aussi bien que { result: "W" }. Voir EntreeForme.
 */
export const lettreDe = (m: unknown): string => {
  if (typeof m === "string") return m.toUpperCase().trim();
  const r = (m as any)?.result;
  return typeof r === "string" ? r.toUpperCase().trim() : "";
};

const nombre = (v: unknown, defaut = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : defaut;
};

function lireBilan(f: FormeEquipe | undefined): Bilan {
  const matchs = Array.isArray(f?.recentMatches) ? f!.recentMatches! : [];

  // ── LES LETTRES DE LA FORME ─────────────────────────────────────────────
  //
  // Le fournisseur écrit W (win), D (draw), L (loss). La première version
  // comptait « D » comme une défaite ET comme un nul selon la branche : un
  // match nul disparaissait ou devenait une défaite. On sépare proprement.
  const compter = (lettre: string) => matchs.filter((m) => lettreDe(m).startsWith(lettre)).length;

  // Les matchs joués de la SAISON servent de diviseur, jamais les cinq derniers.
  // Diviser un total de saison par cinq donnait « 11.8 buts par match ».
  const joues = Math.max(1, nombre(f?.played, matchs.length || 1));

  return {
    v: compter('W'),
    n: compter('D'),
    d: compter('L'),
    joues,
    formeVus: matchs.length,
    butsPour: nombre(f?.goalsScored),
    butsContre: nombre(f?.goalsConceded),
    clean: nombre(f?.cleanSheets),
    possession: nombre(f?.avgPossession),
    victoiresSaison: nombre(f?.winStreak),
  };
}

/**
 * La série de victoires RÉELLEMENT en cours, lue sur la forme récente.
 *
 * C'est la seule source honnête : le champ du fournisseur donne le total de la
 * saison, pas une série. On compte donc les V consécutives depuis le match le
 * plus récent.
 *
 * L'ordre du tableau est du PLUS RÉCENT au plus ancien.
 */
function serieEnCours(f: FormeEquipe | undefined): number {
  const matchs = Array.isArray(f?.recentMatches) ? f!.recentMatches! : [];
  let n = 0;
  for (const m of matchs) {
    if (lettreDe(m).startsWith('W')) n++;
    else break;
  }
  return n;
}

/**
 * Les atouts réels d'une équipe, du plus parlant au moins parlant.
 *
 * Chaque entrée est une affirmation VÉRIFIABLE sur les données. On n'en garde
 * que les deux premières : au-delà, le texte s'allonge et l'argument se dilue.
 *
 * L'ordre compte. Une série de victoires en cours frappe plus qu'une moyenne de
 * possession, et c'est ce qui doit sortir en premier quand il existe.
 */
function atouts(b: Bilan, nom: string, serie: number): string[] {
  const moyennePour = b.butsPour / b.joues;
  const moyenneContre = b.butsContre / b.joues;

  // ── UN SEUL ATOUT PAR FAMILLE ───────────────────────────────────────────
  //
  // « reste sur 4 victoires de rang » et « a gagné 4 de ses 5 derniers matchs »
  // sont la MÊME information dite deux fois. Les servir ensemble donne un texte
  // qui tourne à vide et fait douter du sérieux du reste.
  //
  // Chaque famille ne propose donc qu'une seule formule, la plus forte qui
  // s'applique, et l'on prend les deux meilleures familles disponibles.
  // La série vient de la forme récente, jamais du champ du fournisseur : celui-ci
  // donne le total de victoires de la saison, et le lire comme une série a
  // produit « reste sur 17 victoires de rang » sous un bilan de 1-1-3.
  const dynamique = (): string | null => {
    if (serie >= 3) return `${nom} reste sur ${serie} victoires consécutives`;
    if (serie === 2) return `${nom} vient d'enchaîner deux succès`;
    if (b.v >= 4 && b.formeVus >= 5)
      return `${nom} a gagné ${b.v} de ses ${b.formeVus} dernières sorties`;
    if (b.v === 3 && b.formeVus >= 5)
      return `${nom} arrive lancé avec 3 victoires sur ses ${b.formeVus} derniers matchs`;
    if (b.d >= 3 && b.formeVus >= 5)
      return `${nom} traverse une passe difficile (${b.v}-${b.n}-${b.d} sur ses ${b.formeVus} derniers)`;
    if (b.n >= 2) return `${nom} accroche régulièrement le nul (${b.v}-${b.n}-${b.d})`;
    return null;
  };

  // Une moyenne au-dessus de 4 buts par match n'existe pas en football : c'est
  // le signe que le diviseur est faux. On préfère alors ne rien dire plutôt
  // qu'écrire une absurdité — « 11.8 buts par match » a été affiché en ligne.
  const chiffreCredible = moyennePour > 0 && moyennePour < 4;

  const attaque = (): string | null => {
    if (!chiffreCredible) return null;
    if (moyennePour >= 2.2) return `son attaque tourne à ${moyennePour.toFixed(1)} buts par match`;
    if (moyennePour >= 1.6) return `son attaque trouve la faille presque à chaque sortie`;
    if (moyennePour >= 1.1) return `son attaque reste capable de faire la différence`;
    return null;
  };

  const defense = (): string | null => {
    if (b.clean >= 4) return `sa défense a tenu le zéro à ${b.clean} reprises`;
    if (b.clean >= 2) return `sa défense a déjà signé ${b.clean} matchs sans encaisser`;
    if (moyenneContre > 0 && moyenneContre <= 0.9)
      return `sa défense ne concède que ${moyenneContre.toFixed(1)} but par match`;
    if (moyenneContre >= 1.8 && moyenneContre < 4)
      return `sa défense reste perméable et devra hausser le ton`;
    return null;
  };

  const ballon = (): string | null => {
    if (b.possession >= 58) return `il impose son jeu avec ${Math.round(b.possession)} % de possession`;
    if (b.possession > 0 && b.possession <= 43)
      return `il assume un rôle de contre-attaquant, ballon laissé à l'adversaire`;
    return null;
  };

  const retenus = [dynamique(), attaque(), defense(), ballon()].filter(
    (x): x is string => !!x
  );

  // ── QUAND RIEN NE VA, IL RESTE À DIRE VRAI ──────────────────────────────
  //
  // Une équipe en pleine série noire n'a aucun atout statistique. Lui en
  // inventer un serait le plus sûr moyen de perdre le lecteur qui suit ce
  // club — il sait, lui, que son équipe va mal. On dit alors ce qui est
  // également vrai et qui garde la rencontre ouverte : une équipe sans
  // pression est imprévisible, et tout amateur de football le reconnaît.
  if (!retenus.length) {
    if (moyennePour >= 1) retenus.push(`${nom} continue de se créer des occasions`);
    else if (b.n >= 2) retenus.push(`${nom} sait accrocher le match nul`);
    else retenus.push(`${nom} joue sans pression et n'a plus rien à perdre`);
    retenus.push(moyenneContre >= 1.8 ? `il devra resserrer les lignes` : `il reste dangereux sur transition`);
  }

  // ── L'ÉQUIPE DOIT ÊTRE NOMMÉE ───────────────────────────────────────────
  //
  // Seule la famille « dynamique » porte le nom du club. Quand elle ne
  // s'applique pas — équipe sans série ni bilan marquant —, la phrase
  // commençait par « son attaque tourne à 2.5 buts par match » et l'on ne
  // savait plus de qui l'on parlait. Vu en production : « De son côté, son
  // attaque tourne… » sans que Manchester City ne soit jamais nommé.
  //
  // Le nom est donc greffé sur le premier atout s'il n'y figure pas déjà — en
  // transformant le possessif plutôt qu'en collant un deux-points, qui donnait
  // « Manchester City : son attaque tourne… », correct mais sec.
  if (retenus.length && !retenus[0].includes(nom)) {
    retenus[0] = retenus[0]
      .replace(/^son attaque/, `l'attaque de ${nom}`)
      .replace(/^sa défense/, `la défense de ${nom}`)
      .replace(/^il impose son jeu/, `${nom} impose son jeu`)
      .replace(/^il assume/, `${nom} assume`);
    // Aucune tournure reconnue : on nomme quand même, plutôt que de laisser
    // une phrase orpheline.
    if (!retenus[0].includes(nom)) retenus[0] = `${nom} — ${retenus[0]}`;
  }

  // Tous les atouts trouvés sont rendus, pas seulement les deux premiers :
  // c'est la composition qui choisit, et elle a besoin de marge pour éviter de
  // servir la même formule aux deux équipes.
  return retenus;
}

/**
 * Une phrase pour chaque équipe, cousues sans jamais les comparer.
 *
 * La comparaison est précisément ce qu'il faut éviter : « A domine, B subit »
 * désigne le vainqueur aussi sûrement qu'un score. Chaque camp est donc décrit
 * pour lui-même, et le lien entre les deux reste neutre.
 */
const LIENS = [
  'En face,',
  'De son côté,',
  'Face à lui,',
];

/**
 * Les formules de tension, tirées au sort de façon STABLE.
 *
 * Le tirage suit le nom des équipes : la même affiche donne toujours la même
 * phrase, deux affiches différentes en donnent de différentes. Sans cela, deux
 * consultations du même match afficheraient deux textes distincts — et la
 * variation ferait douter de tout le reste.
 */
/**
 * ── CES PHRASES DOIVENT PASSER LEUR PROPRE GARDE-FOU ──────────────────────
 *
 * Une première version annonçait « notre analyse complète donne le favori, le
 * score attendu… ». Le contrôle anti-fuite l'a rejetée — à raison : les mots
 * « favori » et « vainqueur » figurent dans la liste des termes interdits au
 * modèle, et le filet de secours ne peut pas s'autoriser ce qu'il refuse à
 * l'IA. Un gabarit qui échoue à son propre contrôle est un gabarit qui, le
 * jour où il sert, laisse passer ce qu'il devait retenir.
 *
 * Ces formulations disent donc qu'un verdict EXISTE sans employer aucun des
 * mots qui le nomment.
 */
/**
 * ── UNE SEULE FIN, ET C'EST VOULU ─────────────────────────────────────────
 *
 * Quatre formules de clôture se relayaient, tirées au sort selon les noms des
 * équipes. Décision du propriétaire, le 5 septembre 2026 : il n'en garde
 * qu'une, celle-ci, parce qu'elle vend mieux que les trois autres — elle dit
 * que le travail EST FAIT et qu'il ne reste qu'à l'ouvrir, là où « notre
 * analyse détaillée dit lequel pèse le plus lourd » promet encore.
 *
 * Un appel à l'action qui change d'une visite à l'autre se mesure mal, aussi :
 * on ne saura jamais lequel convertit si chacun ne sert qu'un quart du temps.
 */
const CLOTURE = 'notre IA, elle, a fini son travail et livre son verdict complet.';

/**
 * ── LE DÉBUT, LUI, SUIT LA RENCONTRE ──────────────────────────────────────
 *
 * « Sur le papier, la rencontre reste ouverte » sonnait faux devant un texte
 * qui vient d'expliquer qu'une équipe écrase l'autre. Ces trois ouvertures
 * sont donc choisies sur l'écart de forme des cinq derniers matchs, et non
 * tirées au sort.
 *
 * Aucune ne nomme un vainqueur, et c'est une contrainte, pas une élégance :
 * « favori » et « vainqueur » figurent dans les termes interdits, et l'aperçu
 * gratuit ne doit rien livrer de ce que l'accès payant contient.
 */
const OUVERTURES = {
  contraste: 'Deux dynamiques opposées se font face —',
  nuance: 'Les deux équipes ont leurs arguments —',
  serre: 'Sur le papier, la rencontre reste ouverte —',
} as const;

/**
 * Une empreinte stable, et surtout BIEN RÉPARTIE.
 *
 * Une première version multipliait par 31 en partant de zéro : sur des noms
 * d'équipes, les trois affiches testées tombaient toutes sur la même phrase de
 * tension. Un texte censé varier qui ne varie pas est pire que rien — il
 * signale que la variation est feinte.
 *
 * Celle-ci mélange les bits à chaque tour (décalages et ou-exclusif), ce qui
 * répartit convenablement des chaînes même très proches.
 */
const empreinte = (a: string, b: string): number => {
  const s = `${a}|${b}`.toLowerCase();
  let n = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    n ^= s.charCodeAt(i);
    n = Math.imul(n, 0x01000193) >>> 0;
  }
  n ^= n >>> 15;
  return n >>> 0;
};

/**
 * Compose la bande-annonce d'une rencontre.
 *
 * Ne révèle jamais : le favori, le score, les probabilités, les buts attendus,
 * la confiance, ni le moindre élément de scénario. Ces mots ne peuvent pas
 * apparaître, puisqu'aucune de ces valeurs n'entre dans cette fonction.
 */
export function composerApercu(
  nom1: string,
  nom2: string,
  forme1?: FormeEquipe,
  forme2?: FormeEquipe,
  /** Compétition et stade, quand ils sont connus : ils plantent le décor. */
  contexte?: { competition?: string | null; stade?: string | null }
): string {
  // ── LE NOM VIENT D'OÙ IL EXISTE ─────────────────────────────────────────
  //
  // En production, l'aperçu a affiché « La première équipe reste sur… ». La
  // cause : les noms n'étaient transmis nulle part — l'analyse ne porte pas de
  // champ `team1` au premier niveau, seulement `globalForm.team1`. On accepte
  // donc les deux sources, et le repli générique n'est plus qu'un dernier
  // recours qui ne devrait jamais servir.
  const e1 = String(nom1 || forme1?.name || '').trim() || 'La première équipe';
  const e2 = String(nom2 || forme2?.name || '').trim() || 'La seconde';

  const b1 = lireBilan(forme1);
  const b2 = lireBilan(forme2);

  const a1 = atouts(b1, e1, serieEnCours(forme1));
  const tous2 = atouts(b2, e2, serieEnCours(forme2));

  // ── JAMAIS LA MÊME FORMULE POUR LES DEUX ÉQUIPES ────────────────────────
  //
  // « Arsenal… son attaque marque régulièrement. De son côté, Coventry… son
  // attaque marque régulièrement. » Dans la même phrase, la répétition saute
  // aux yeux et donne un texte de machine — exactement l'impression qu'on
  // cherche à éviter.
  //
  // La seconde équipe pioche donc dans ses atouts en évitant ceux déjà servis.
  // Si tous sont pris, on garde les siens : mieux vaut répéter que mentir.
  const dejaDits = new Set(a1.slice(0, 2));
  const inedits = tous2.filter((x) => !dejaDits.has(x));
  const a2 = (inedits.length ? inedits : tous2).slice(0, 2);

  const deux1 = a1.slice(0, 2);
  const phrase1 = deux1.length > 1 ? `${deux1[0]}, et ${deux1[1]}.` : `${deux1[0]}.`;
  const lien = LIENS[empreinte(e1, e2) % LIENS.length];
  const phrase2 = a2.length > 1 ? `${lien} ${a2[0]}, et ${a2[1]}.` : `${lien} ${a2[0]}.`;

  // L'écart de forme sur les cinq derniers matchs, en victoires. Trois et
  // plus : les deux équipes ne vivent pas la même saison. Zéro ou un : rien ne
  // les sépare à l'œil nu.
  const ecartForme = Math.abs(b1.v - b2.v);
  const ouvertureTension =
    ecartForme >= 3 ? OUVERTURES.contraste : ecartForme >= 2 ? OUVERTURES.nuance : OUVERTURES.serre;
  const tension = `${ouvertureTension} ${CLOTURE}`;

  // Le décor, quand il est connu : la compétition et le stade situent la
  // rencontre en une ligne et donnent au texte l'allure d'un vrai chapeau
  // d'article plutôt que d'une fiche statistique.
  const comp = String(contexte?.competition ?? '').trim();
  const stade = String(contexte?.stade ?? '').trim();
  const ouverture = comp
    ? `${e1} reçoit ${e2}${stade ? ` au ${stade}` : ''} pour un match de ${comp}.`
    : '';

  return [ouverture, majuscule(phrase1), majuscule(phrase2), tension, "Débloquez l'analyse complète pour tout voir."]
    .filter(Boolean)
    .join(' ');
}

const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
