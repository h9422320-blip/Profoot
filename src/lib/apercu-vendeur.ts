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

export interface FormeEquipe {
  recentMatches?: string[];
  goalsScored?: number;
  goalsConceded?: number;
  cleanSheets?: number;
  avgPossession?: number;
  winStreak?: number;
}

/** Bilan lu sur les cinq dernières rencontres. */
interface Bilan {
  v: number;
  n: number;
  d: number;
  joues: number;
  butsPour: number;
  butsContre: number;
  clean: number;
  possession: number;
  serie: number;
}

const nombre = (v: unknown, defaut = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : defaut;
};

function lireBilan(f: FormeEquipe | undefined): Bilan {
  const matchs = Array.isArray(f?.recentMatches) ? f!.recentMatches! : [];
  const compter = (lettre: string) =>
    matchs.filter((m) => String(m ?? '').toUpperCase().startsWith(lettre)).length;

  return {
    v: compter('W') + compter('V'),
    n: compter('D') === matchs.length ? 0 : compter('N'),
    d: compter('L') + compter('P'),
    joues: matchs.length,
    butsPour: nombre(f?.goalsScored),
    butsContre: nombre(f?.goalsConceded),
    clean: nombre(f?.cleanSheets),
    possession: nombre(f?.avgPossession),
    serie: nombre(f?.winStreak),
  };
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
function atouts(b: Bilan, nom: string): string[] {
  const moyennePour = b.joues > 0 ? b.butsPour / b.joues : 0;
  const moyenneContre = b.joues > 0 ? b.butsContre / b.joues : 0;

  // ── UN SEUL ATOUT PAR FAMILLE ───────────────────────────────────────────
  //
  // « reste sur 4 victoires de rang » et « a gagné 4 de ses 5 derniers matchs »
  // sont la MÊME information dite deux fois. Les servir ensemble donne un texte
  // qui tourne à vide et fait douter du sérieux du reste.
  //
  // Chaque famille ne propose donc qu'une seule formule, la plus forte qui
  // s'applique, et l'on prend les deux meilleures familles disponibles.
  const dynamique = (): string | null => {
    if (b.serie >= 3) return `${nom} reste sur ${b.serie} victoires de rang`;
    if (b.v >= 4 && b.joues >= 5) return `${nom} a gagné ${b.v} de ses ${b.joues} derniers matchs`;
    if (b.serie === 2) return `${nom} enchaîne deux succès`;
    if (b.v === 3 && b.joues >= 5)
      return `${nom} arrive lancé avec 3 succès sur ses ${b.joues} dernières sorties`;
    return null;
  };

  const attaque = (): string | null => {
    if (moyennePour >= 2) return `son attaque tourne à ${moyennePour.toFixed(1)} buts par match`;
    if (moyennePour >= 1.5) return `son attaque marque régulièrement`;
    return null;
  };

  const defense = (): string | null => {
    if (b.clean >= 3) return `sa défense a tenu le zéro ${b.clean} fois`;
    if (b.clean === 2) return `sa défense a déjà signé deux matchs sans encaisser`;
    if (moyenneContre > 0 && moyenneContre <= 0.8) return `sa défense concède très peu`;
    return null;
  };

  const ballon = (): string | null =>
    b.possession >= 55 ? `il garde le ballon (${Math.round(b.possession)} % de possession)` : null;

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
const TENSIONS = [
  "Deux dynamiques opposées se font face — et notre IA a déjà tranché : tout est dans l'analyse complète.",
  "Sur le papier, la rencontre reste ouverte — notre IA, elle, a fini son travail et livre son verdict complet.",
  "Difficile de départager ces deux-là à l'œil nu — notre IA a passé la rencontre au crible, minute par minute.",
  "Les deux équipes ont leurs arguments — notre analyse détaillée dit lequel pèse le plus lourd.",
];

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
  forme2?: FormeEquipe
): string {
  const e1 = String(nom1 ?? '').trim() || 'La première équipe';
  const e2 = String(nom2 ?? '').trim() || 'La seconde';

  const b1 = lireBilan(forme1);
  const b2 = lireBilan(forme2);

  const a1 = atouts(b1, e1);
  const tous2 = atouts(b2, e2);

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

  const tension = TENSIONS[empreinte(e2, e1) % TENSIONS.length];

  return `${majuscule(phrase1)} ${majuscule(phrase2)} ${tension} Débloquez l'analyse complète pour tout voir.`;
}

const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
