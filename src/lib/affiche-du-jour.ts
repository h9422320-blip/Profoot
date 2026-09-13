/* Pas de `server-only` ici : ce module est aussi lu par le script de contrôle
   `scripts/_apercu-affiche.mts`, hors de Next. Il ne contient aucun secret —
   une liste d'adresses, des règles de conformité et une lecture filtrée. */

/**
 * ── L'AFFICHE DU JOUR ──────────────────────────────────────────────────────
 *
 * Une image que l'abonné peut partager sur son statut WhatsApp : elle raconte
 * son ACTIVITÉ D'ANALYSE du jour, et rien d'autre. Chaque partage promène la
 * marque ProFoot AI ; c'est là tout son intérêt commercial.
 *
 * ── LA RÈGLE ABSOLUE, GARANTIE PAR CONSTRUCTION ───────────────────────────
 *
 * L'affiche ne doit JAMAIS montrer un résultat, un score annoncé, une analyse
 * « réussie », un pronostic, un gain ni un taux de réussite. Uniquement
 * l'activité : matchs analysés, statistiques, tendances, séries.
 *
 * Ce n'est pas qu'une consigne de rédaction : la lecture en base ne demande QUE
 * les colonnes autorisées (`LECTURE_AUTORISEE`). Le score, la confiance, les
 * probabilités et le résumé ne sortent donc pas de la base — on ne peut pas
 * divulguer ce qu'on n'a pas reçu. Et `verifierConformite` refuse de composer
 * une image qui contiendrait un mot interdit.
 *
 * ── ACCÈS, POUR L'INSTANT ─────────────────────────────────────────────────
 *
 * Essai privé : seules les adresses de `ESSAI_PRIVE` voient le bouton et
 * peuvent produire l'image. Tous les autres comptes n'en ont aucune trace.
 * Le jour où le propriétaire le décide, `AFFICHE_PUBLIQUE = true` l'ouvre d'un
 * coup à tous les abonnés payants — sans rien changer d'autre.
 */

/**
 * L'INTERRUPTEUR. À `false`, l'affiche n'existe que pour `ESSAI_PRIVE`.
 * À `true`, elle s'ouvre à tous les abonnés payants (droit `premium`).
 *
 * Ne pas passer à `true` sans l'accord explicite du propriétaire.
 */
export const AFFICHE_PUBLIQUE = false;

/** Qui y a accès pendant l'essai privé. */
export const ESSAI_PRIVE: readonly string[] = ['h9422320@gmail.com'];

/**
 * Les colonnes d'`analysis_history` que l'affiche a le droit de lire.
 *
 * Volontairement limitées aux deux équipes et à l'heure. La table contient
 * aussi `score`, `confidence`, `win_prob`, `draw_prob`, `lose_prob`,
 * `predicted_winner`, `summary` et `analysis_data` : rien de tout cela ne doit
 * approcher une image destinée à un réseau social.
 */
export const LECTURE_AUTORISEE = 'created_at, team1_name, team1_logo, team2_name, team2_logo' as const;

/**
 * Les mots qui n'ont rien à faire sur l'affiche.
 *
 * Comparés sans accents ni casse. La liste couvre le pari, le pronostic, le
 * résultat et la réussite — y compris en anglais, parce que la table et
 * certaines étiquettes du projet sont en anglais.
 */
export const MOTS_INTERDITS: readonly string[] = [
  'pari',
  'paris',
  'parier',
  'bet',
  'betting',
  'cote',
  'cotes',
  'odds',
  'pronostic',
  'pronostics',
  'prediction',
  'predictions',
  'predit',
  'predite',
  'gain',
  'gains',
  'gagne',
  'gagnant',
  'gagnee',
  'win',
  'wins',
  'won',
  'reussite',
  'reussi',
  'reussies',
  'succes',
  'taux',
  'score',
  'scores',
  'resultat',
  'resultats',
  'vainqueur',
  'perdu',
  'perdant',
  'mise',
  'mises',
  'benefice',
  'profit',
  'roi',
  'jackpot',
];

/**
 * Les RACINES interdites, contrôlées en début de mot.
 *
 * Énumérer les mots ne suffit pas : « réussie », « réussies », « réussi »,
 * « gagnée », « gagnants » sont autant de formes du même interdit. Une racine
 * les couvre toutes, y compris celles auxquelles personne n'a pensé.
 */
export const RACINES_INTERDITES: readonly string[] = [
  'pari',
  'parie',
  'bet',
  'pronostic',
  'predi',
  'gain',
  'gagn',
  'reussi',
  'succes',
  'resultat',
  'vainqueur',
  'perdu',
  'perdant',
  'benefic',
  'profit',
  'jackpot',
];

const sansAccents = (x: string) =>
  String(x)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Un mot interdit se cache-t-il dans ces textes ?
 *
 * Rend la liste des mots trouvés. On compare sur les MOTS entiers : « paris »
 * est interdit, mais « Paris Saint-Germain » ne doit pas faire échouer une
 * affiche — d'où l'exception sur les noms de clubs, traités à part par
 * `verifierConformite`.
 */
export function motsInterditsTrouves(textes: readonly string[]): string[] {
  const trouves = new Set<string>();
  for (const texte of textes) {
    const mots = sansAccents(texte).split(/[^a-z0-9]+/).filter(Boolean);
    for (const mot of mots) {
      if (MOTS_INTERDITS.includes(mot)) trouves.add(mot);
      else if (RACINES_INTERDITES.some((racine) => mot.startsWith(racine))) trouves.add(mot);
    }
  }
  return [...trouves];
}

/**
 * Refuse de composer une affiche qui contiendrait un mot interdit.
 *
 * `nomsDeClubs` est la liste des noms d'équipes affichés : ils viennent du
 * fournisseur de données et peuvent contenir « Paris », « Racing »… On les
 * écarte du contrôle, sinon un Paris Saint-Germain — Lens bloquerait l'affiche
 * de quelqu'un qui n'a rien fait de mal.
 */
export function verifierConformite(textes: readonly string[], nomsDeClubs: readonly string[] = []): void {
  const clubs = new Set(nomsDeClubs.map((x) => sansAccents(x)));
  const aControler = textes.filter((t) => !clubs.has(sansAccents(t)));
  const trouves = motsInterditsTrouves(aControler);
  if (trouves.length)
    throw new Error(
      `Affiche refusée : elle contiendrait ${trouves.map((m) => `« ${m} »`).join(', ')}. ` +
        "L'affiche ne parle que d'activité d'analyse."
    );
}

/** Cette personne a-t-elle accès à l'affiche du jour ? */
export function afficheAutorisee(courriel: string | null | undefined, estPayant: boolean): boolean {
  if (AFFICHE_PUBLIQUE) return estPayant;
  const adresse = String(courriel ?? '').trim().toLowerCase();
  if (!adresse) return false;
  return ESSAI_PRIVE.includes(adresse);
}

/**
 * ── LE RÉCAPITULATIF : L'ANALYSE FACE AU TERRAIN ─────────────────────────
 *
 * Ce que le propriétaire a demandé le 13 septembre 2026, en connaissance de
 * cause : montrer, à côté de chaque rencontre analysée, CE QUI S'EST
 * RÉELLEMENT PASSÉ. « Comme des preuves au fait. »
 *
 * ── POURQUOI CETTE LECTURE EST SÉPARÉE, ET PAS UN ÉLARGISSEMENT ─────────
 *
 * `LECTURE_AUTORISEE` garde son rôle intact : la liste des matchs du jour ne
 * voit toujours que des noms et des écussons. Une seconde liste, explicite et
 * bornée, sert le récapitulatif — et elle ne contient toujours PAS la
 * confiance, les probabilités, le résumé ni l'analyse complète, qui sont le
 * contenu payant.
 *
 * ── CE QUE CE CHOIX COÛTE, ET POURQUOI IL A ÉTÉ FAIT QUAND MÊME ─────────
 *
 * Un « annoncé 4-1 / réel 4-1 » sur une image qui circule est ce qui ressemble
 * le plus à une publicité de pari, et ce projet a perdu une boutique en août
 * 2026 sur ce motif. Le risque a été posé au propriétaire, qui a tranché :
 * le mur public de l'application publie DÉJÀ exactement cela, à la vue de
 * tous et indexé par les moteurs. L'affiche ne crée donc pas une catégorie de
 * contenu nouvelle ; elle met en image ce que le site montre déjà.
 *
 * Reste la règle qui n'a pas bougé d'un pouce : AUCUN TAUX. Ni pourcentage de
 * réussite, ni « analyses réussies », ni classement. Des faits, un par
 * rencontre, et rien qui les agrège.
 */
export const LECTURE_RECAP =
  'created_at, team1_name, team1_logo, team2_name, team2_logo, score, real_score, winner_correct' as const;

/** Une rencontre analysée, confrontée à ce qui s'est passé. */
export interface MatchCompare {
  domicile: string;
  logoDomicile: string | null;
  exterieur: string;
  logoExterieur: string | null;
  /** Le score annoncé avant le match, « 4 - 1 ». */
  annonce: string;
  /** Le score réel, « 4 - 1 ». */
  reel: string;
  /** L'issue annoncée était-elle la bonne ? */
  juste: boolean;
}

/**
 * Les dernières analyses de cette personne qui ont été confrontées au résultat.
 *
 * Les plus récentes d'abord, et une rencontre n'y paraît qu'une fois : rouvrir
 * une analyse crée une ligne de plus, et l'affiche montrerait deux fois le même
 * match.
 */
export async function recapitulatif(
  sb: { from: (t: string) => any },
  userId: string,
  max = 3
): Promise<MatchCompare[]> {
  const { data, error } = await sb
    .from('analysis_history')
    .select(LECTURE_RECAP)
    .eq('user_id', userId)
    .not('verified_at', 'is', null)
    .not('real_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return [];

  const vus = new Set<string>();
  const sortie: MatchCompare[] = [];
  for (const l of (data ?? []) as any[]) {
    const annonce = String(l.score ?? '').trim();
    const reel = String(l.real_score ?? '').trim();
    if (!annonce || !reel) continue;
    const cle = [String(l.team1_name ?? ''), String(l.team2_name ?? '')].sort().join(' · ').toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({
      domicile: String(l.team1_name ?? ''),
      logoDomicile: l.team1_logo ?? null,
      exterieur: String(l.team2_name ?? ''),
      logoExterieur: l.team2_logo ?? null,
      annonce,
      reel,
      juste: Boolean(l.winner_correct),
    });
    if (sortie.length >= max) break;
  }
  return sortie;
}

/** Un match analysé, tel qu'il paraîtra : deux équipes, deux écussons. */
export interface MatchAnalyse {
  domicile: string;
  logoDomicile: string | null;
  exterieur: string;
  logoExterieur: string | null;
  /** L'heure du coup d'envoi, « 21:00 ». Vide quand elle n'est pas connue. */
  heure?: string;
}

/**
 * ── LES RENCONTRES DU JOUR LES MIEUX CERNÉES, SANS LEUR POURCENTAGE ──────
 *
 * La section de la page d'analyse porte, à côté de chaque rencontre, la part
 * de pronostics justes observée — 90 %, 81 %, 74 %. Sur un écran privé, entre
 * un abonné et son application, c'est une information honnête.
 *
 * Sur une image qui part sur WhatsApp et TikTok, c'est autre chose : un
 * pourcentage à côté d'un match de football se lit comme une publicité de
 * pari. Ce projet a déjà perdu une boutique en août 2026 sur un contrôle
 * « produits interdits : paris sportifs, jeux de hasard ». Et la règle de
 * l'affiche, posée par le propriétaire, interdit tout taux.
 *
 * Cette fonction est donc le filtre : elle ne LAISSE PASSER que les deux
 * équipes, leurs écussons et l'heure. La fiabilité, la famille de match, le
 * nombre de rencontres mesurées n'en ressortent pas — on ne peut pas divulguer
 * ce qu'on n'a pas recopié. Même principe que `LECTURE_AUTORISEE`.
 */
export function rencontresMieuxCernees(
  selection: readonly any[] | null | undefined,
  max = 3
): MatchAnalyse[] {
  const heureDe = (iso: unknown): string => {
    const t = Date.parse(String(iso ?? ''));
    if (!Number.isFinite(t)) return '';
    // L'heure d'Abidjan, de Dakar et de Lomé : UTC. C'est celle de la très
    // grande majorité des abonnés, et une affiche ne connaît pas le fuseau de
    // celui qui la regardera.
    return new Date(t).toISOString().slice(11, 16);
  };

  return (selection ?? [])
    .filter((m: any) => m?.dom?.name && m?.ext?.name)
    .slice(0, Math.max(0, max))
    .map((m: any) => ({
      domicile: String(m.dom.name),
      logoDomicile: m.dom.logo ?? null,
      exterieur: String(m.ext.name),
      logoExterieur: m.ext.logo ?? null,
      heure: heureDe(m.kickoffISO),
    }));
}

/** Tout ce que l'affiche a besoin de savoir — et rien de plus. */
export interface DonneesAffiche {
  prenom: string;
  jour: string;
  analysesDuJour: number;
  analysesDuMois: number;
  /** Jours consécutifs avec au moins une analyse, celui-ci compris. */
  serie: number;
  equipePreferee: { nom: string; logo: string | null } | null;
  matchs: MatchAnalyse[];
  /**
   * Les rencontres du jour que le moteur cerne le mieux, sans aucun chiffre.
   *
   * C'est ce qui rend l'affiche PARTAGEABLE. Un bulletin d'activité — « j'ai
   * analysé cinq matchs » — ne fait rien demander à personne. Les affiches du
   * soir, elles, font écrire « et alors ? » — et c'est cette question-là qui
   * envoie les amis sur profootai.com.
   *
   * Vide quand la sélection du jour n'est pas disponible : l'affiche retombe
   * alors sur les matchs que l'abonné a lui-même analysés.
   */
  mieuxCernes: MatchAnalyse[];
  /**
   * Les dernières analyses confrontées à ce qui s'est réellement passé.
   *
   * C'est ce qui donne de la VALEUR à l'affiche : un rang flatte, une preuve
   * convainc. Vide tant qu'aucune analyse n'a encore été confrontée.
   */
  recap: MatchCompare[];
}

/** Le prénom à afficher : le premier mot du nom, sinon le début de l'adresse. */
export function prenomDe(nomComplet: unknown, courriel: unknown): string {
  const nom = String(nomComplet ?? '').trim();
  if (nom) {
    const premier = nom.split(/\s+/)[0];
    if (premier.length >= 2) return premier.slice(0, 18);
  }
  const adresse = String(courriel ?? '').trim();
  const avant = adresse.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  if (avant) return avant.split(/\s+/)[0].slice(0, 18);
  return 'Analyste';
}

/** Le jour d'une date, au format AAAA-MM-JJ. */
const jourDe = (quand: string | Date) => new Date(quand).toISOString().slice(0, 10);

/**
 * Combien de jours d'affilée cette personne a-t-elle analysé, en remontant
 * depuis `jour` ?
 *
 * Une journée sans analyse coupe la série. Le jour lui-même doit en compter au
 * moins une, sinon la série vaut zéro : on ne félicite pas quelqu'un pour une
 * assiduité qu'il n'a pas eue aujourd'hui.
 */
export function serieDepuis(joursAvecAnalyse: readonly string[], jour: string): number {
  const vus = new Set(joursAvecAnalyse);
  if (!vus.has(jour)) return 0;
  let serie = 0;
  const curseur = new Date(`${jour}T12:00:00Z`);
  while (vus.has(curseur.toISOString().slice(0, 10))) {
    serie++;
    curseur.setUTCDate(curseur.getUTCDate() - 1);
  }
  return serie;
}

/**
 * Les données de l'affiche, lues pour cette personne et ce jour.
 *
 * `sb` est un client Supabase déjà authentifié ; la lecture est filtrée sur
 * `user_id`, comme partout ailleurs. Seules les colonnes de
 * `LECTURE_AUTORISEE` sont demandées.
 */
export async function donneesAffiche(
  sb: { from: (t: string) => any },
  utilisateur: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
  jour: string,
  maxMatchs = 5,
  /**
   * La sélection du jour, FOURNIE et jamais relue ici.
   *
   * Elle vit dans la réserve partagée, hors de portée d'un test et du script
   * de contrôle. L'appelant la passe ; ce module se contente de la dépouiller
   * de ses chiffres avec `rencontresMieuxCernees`.
   */
  selectionDuJour: readonly any[] | null = null
): Promise<DonneesAffiche> {
  // Soixante jours suffisent pour le mois en cours ET pour une série crédible.
  const debut = new Date(`${jour}T00:00:00Z`);
  debut.setUTCDate(debut.getUTCDate() - 60);

  const { data, error } = await sb
    .from('analysis_history')
    .select(LECTURE_AUTORISEE)
    .eq('user_id', utilisateur.id)
    .gte('created_at', debut.toISOString())
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(`lecture de l'activité : ${error.message}`);

  const lignes: any[] = data ?? [];
  const mois = jour.slice(0, 7);
  const duMois = lignes.filter((l) => jourDe(l.created_at).slice(0, 7) === mois);

  // ── UN MATCH ANALYSÉ DEUX FOIS RESTE UN MATCH ──────────────────────────
  //
  // Rouvrir une analyse enregistre une ligne de plus. Sans ce regroupement,
  // l'affiche montrait deux fois Real Madrid — Rayo Vallecano et annonçait
  // « 3 matchs » pour deux rencontres : faux, et visible par tout le monde.
  // Le titre compte donc les RENCONTRES distinctes ; « analyses ce mois-ci »
  // compte bien les analyses, ce qu'il annonce.
  const vus = new Set<string>();
  const duJour: any[] = [];
  for (const l of lignes.filter((x) => jourDe(x.created_at) === jour)) {
    const cle = [String(l.team1_name ?? ''), String(l.team2_name ?? '')].sort().join(' · ').toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    duJour.push(l);
  }

  const metadonnees = (utilisateur.user_metadata ?? {}) as Record<string, any>;
  const preferee = metadonnees.equipe_preferee as { nom?: string; logo?: string | null } | undefined;

  return {
    prenom: prenomDe(metadonnees.full_name, utilisateur.email),
    jour,
    analysesDuJour: duJour.length,
    analysesDuMois: duMois.length,
    serie: serieDepuis(lignes.map((l) => jourDe(l.created_at)), jour),
    equipePreferee: preferee?.nom ? { nom: String(preferee.nom), logo: preferee.logo ?? null } : null,
    // Les plus récentes d'abord, au plus cinq : au-delà, l'affiche devient
    // illisible sur un écran de téléphone.
    matchs: duJour.slice(0, Math.max(0, maxMatchs)).map((l) => ({
      domicile: String(l.team1_name ?? ''),
      logoDomicile: l.team1_logo ?? null,
      exterieur: String(l.team2_name ?? ''),
      logoExterieur: l.team2_logo ?? null,
    })),
    mieuxCernes: rencontresMieuxCernees(selectionDuJour),
    recap: await recapitulatif(sb, utilisateur.id),
  };
}
