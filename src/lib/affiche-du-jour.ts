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

/** Un match analysé, tel qu'il paraîtra : deux équipes, deux écussons. */
export interface MatchAnalyse {
  domicile: string;
  logoDomicile: string | null;
  exterieur: string;
  logoExterieur: string | null;
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
  maxMatchs = 5
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
  };
}
