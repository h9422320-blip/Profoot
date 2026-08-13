import { createAdminClient } from '@/lib/supabase-admin';
import { getRevenusMatchsUniques } from './match-unique';
import { ACCES_OFFERTS, niveauOffert, normalizePlan, PLANS, PlanKey, PlanTier } from '@/lib/subscription';
import { TAUX_POUR_MILLE_USD, TAUX_XOF } from '@/lib/partenaires';
import { getPrecisionReelle } from '@/lib/precision-reelle';

/**
 * Statistiques réelles de ProFoot AI, lues directement dans la base.
 *
 * Tout ce que renvoie ce module provient de `auth.users`, `subscriptions`,
 * `analysis_history` et `webhook_events`. Aucune valeur n'est inventée,
 * estimée ni arrondie « pour faire joli » : un tableau de bord qui ment est
 * pire qu'un tableau de bord vide, car il oriente de vraies décisions.
 * Quand une donnée n'existe pas, le champ vaut 0 et la page le dit.
 */

// ───────────────────────────── Périodes ─────────────────────────────

export type CleePeriode = '7j' | '30j' | '90j' | '12m' | 'tout' | 'perso';

export interface Periode {
  cle: CleePeriode;
  debut: Date;
  fin: Date;
  libelle: string;
  /** Pas des graphiques : un point par jour ou par mois. */
  granularite: 'jour' | 'mois';
}

const LIBELLES: Record<Exclude<CleePeriode, 'perso'>, string> = {
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  '90j': '90 derniers jours',
  '12m': '12 derniers mois',
  tout: 'Depuis le début',
};

/** Début de journée en heure locale, pour que « aujourd'hui » veuille dire aujourd'hui. */
function debutDeJour(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function resoudrePeriode(params: {
  periode?: string;
  du?: string;
  au?: string;
}): Periode {
  const maintenant = new Date();
  const finParDefaut = new Date(maintenant.getTime());

  // Plage saisie à la main dans le calendrier : elle a la priorité.
  if (params.du && params.au) {
    const debut = debutDeJour(new Date(params.du));
    const fin = new Date(params.au);
    fin.setHours(23, 59, 59, 999);
    if (!isNaN(debut.getTime()) && !isNaN(fin.getTime()) && debut <= fin) {
      const jours = (fin.getTime() - debut.getTime()) / 86400000;
      return {
        cle: 'perso',
        debut,
        fin,
        libelle: `Du ${formaterDateCourte(debut)} au ${formaterDateCourte(fin)}`,
        granularite: jours > 120 ? 'mois' : 'jour',
      };
    }
  }

  const cle = (['7j', '30j', '90j', '12m', 'tout'] as const).includes(params.periode as never)
    ? (params.periode as Exclude<CleePeriode, 'perso'>)
    : '30j';

  const joursParCle: Record<Exclude<CleePeriode, 'perso'>, number | null> = {
    '7j': 7, '30j': 30, '90j': 90, '12m': 365, tout: null,
  };

  const nbJours = joursParCle[cle];
  const debut = nbJours === null
    ? new Date(0)
    : debutDeJour(new Date(maintenant.getTime() - (nbJours - 1) * 86400000));

  return {
    cle,
    debut,
    fin: finParDefaut,
    libelle: LIBELLES[cle],
    granularite: cle === '12m' || cle === 'tout' ? 'mois' : 'jour',
  };
}

function formaterDateCourte(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ───────────────────────────── Types ─────────────────────────────

export interface Point {
  /** Clé ISO du jour (2026-08-08) ou du mois (2026-08). */
  cle: string;
  libelle: string;
  valeur: number;
}

export interface LigneUtilisateur {
  id: string;
  email: string;
  inscritLe: string;
  derniereConnexion: string | null;
  emailConfirme: boolean;
  offre: PlanTier;
  offreLibelle: string;
  estAdmin: boolean;
  expireLe: string | null;
  montantPaye: number;
  nbAnalyses: number;
}

export interface LignePartenaire {
  /** Null tant que l adresse n a pas servi a creer un compte. */
  userId: string | null;
  email: string;
  niveau: 'VIP' | 'PRO';
  /** Faux tant que l'adresse n'a pas servi à créer un compte. */
  inscrit: boolean;
  inscritLe: string | null;
  derniereConnexion: string | null;
  nbAnalyses: number;
}

export interface LigneAbonnement {
  id: string;
  /** Compte rattache : permet d ouvrir sa fiche depuis n importe quelle liste. */
  userId: string;
  email: string;
  offre: string;
  offreLibelle: string;
  montant: number;
  devise: string;
  statut: string;
  souscritLe: string;
  expireLe: string | null;
  actif: boolean;
  fournisseur: string | null;
}

export interface LigneAnalyse {
  id: string;
  userId: string;
  email: string;
  match: string;
  competition: string | null;
  score: string | null;
  confiance: number | null;
  termine: boolean;
  date: string;
}

export interface EvenementPaiement {
  id: string;
  /**
   * Compte correspondant a l adresse du payeur, quand elle en designe un.
   * Null pour un achat fait directement en boutique avec une autre adresse :
   * mieux vaut une adresse non cliquable qu un lien vers le mauvais compte.
   */
  userId: string | null;
  fournisseur: string;
  evenement: string;
  recuLe: string;
  montant: number | null;
  devise: string | null;
  email: string | null;
}

export interface Classement {
  nom: string;
  valeur: number;
  detail?: string;
}

export interface AdminMetrics {
  periode: { libelle: string; cle: CleePeriode; debut: string; fin: string; granularite: 'jour' | 'mois' };

  utilisateurs: {
    total: number;
    nouveaux: number;
    nouveauxPrecedent: number;
    actifs: number;
    jamaisConnectes: number;
    emailsNonConfirmes: number;
    serie: Point[];
  };

  abonnements: {
    actifs: number;
    total: number;
    nouveaux: number;
    expires: number;
    expirentBientot: number;
    parOffre: { tier: PlanTier; libelle: string; nombre: number; revenu: number }[];
    serie: Point[];
    liste: LigneAbonnement[];
  };

  revenus: {
    totalCumule: number;
    surPeriode: number;
    surPeriodePrecedente: number;
    panierMoyen: number;
    /** Revenu mensuel normalisé : un abonnement annuel compte pour 1/12. */
    revenuMensuelRecurrent: number;
    devise: string;
    serie: Point[];
    /**
     * Achats a l unite, comptes a part.
     *
     * Les fondre dans le total masquerait ce qu on cherche justement a
     * mesurer : la petite porte fait-elle entrer des gens qui n auraient
     * jamais pris d abonnement ?
     */
    matchsUniques: {
      nombre: number;
      totalXof: number;
      acheteursSansAbonnement: number;
    };
  };

  analyses: {
    total: number;
    surPeriode: number;
    surPeriodePrecedente: number;
    moyenneParJour: number;
    confianceMoyenne: number | null;
    serie: Point[];
    topCompetitions: Classement[];
    topClubs: Classement[];
    topUtilisateurs: Classement[];
    dernieres: LigneAnalyse[];
  };

  /**
   * Accès offerts (influenceurs, partenaires du lancement).
   *
   * Ils ne paient pas, donc ils n'apparaissent ni dans les revenus ni dans les
   * abonnements. Ce bloc existe pour qu'ils cessent d'être invisibles : combien
   * ont été accordés, combien ont réellement créé leur compte, et ce qu'ils
   * font du produit.
   */
  partenaires: {
    total: number;
    inscrits: number;
    /** Accès accordés à des adresses qui n'ont pas encore créé de compte. */
    enAttente: number;
    analysesCumulees: number;
    liste: LignePartenaire[];
  };

  /**
   * Les rapports entre les chiffres.
   *
   * Pris isolément, « 20 comptes » et « 20 000 FCFA » ne disent rien : c'est
   * leur rapport qui informe. Ce bloc rassemble les liens que chaque page
   * affichait jusqu'ici séparément, ou pas du tout — combien de visiteurs
   * deviennent abonnés, ce que rapporte un compte, si l'assurance affichée par
   * l'IA correspond à sa précision constatée, et ce qu'il reste une fois les
   * partenaires payés.
   */
  liens: {
    /** Part des comptes inscrits qui ont souscrit. */
    tauxConversion: number;
    /** Part des comptes qui se sont déjà connectés au moins une fois. */
    tauxActivation: number;
    /** Recette moyenne par compte inscrit, abonnés ou non. */
    revenuParCompte: number;
    /** Recette moyenne par abonné actif. */
    revenuParAbonne: number;
    /** Analyses lancées rapportées au nombre d'abonnés actifs. */
    analysesParAbonne: number;
    /** Part des comptes ayant lancé au moins une analyse. */
    tauxUsage: number;
    /** Assurance que l'IA s'attribue à elle-même. */
    confianceIA: number | null;
    /** Précision réellement constatée, une fois les matchs joués. */
    precisionReelle: number | null;
    /** Nombre de pronostics déjà confrontés à un résultat. */
    pronosticsVerifies: number;
    /** Écart entre l'assurance affichée et la précision constatée. */
    ecartConfiance: number | null;
    /** Coût des partenaires influenceurs, forfaits et vues confondus. */
    coutPartenairesXof: number;
    /** Recettes encaissées moins coût des partenaires. */
    resultatNetXof: number;
    /** Part des événements de paiement qui ont produit un abonnement. */
    tauxAboutissementPaiements: number;
  };

  paiements: EvenementPaiement[];

  listeUtilisateurs: LigneUtilisateur[];

  /** Signale une troncature de lecture, pour ne jamais présenter un total partiel comme complet. */
  avertissements: string[];
}

// ───────────────────────────── Utilitaires ─────────────────────────────

const ADMIN_EMAILS = ['h9422320@gmail.com'];

function cleGranulaire(d: Date, granularite: 'jour' | 'mois'): string {
  const iso = d.toISOString();
  return granularite === 'jour' ? iso.slice(0, 10) : iso.slice(0, 7);
}

/** Squelette de série : chaque intervalle existe, même à zéro — sinon un creux ressemble à une absence de données. */
function construireSerie(periode: Periode, dates: Date[]): Point[] {
  const compte = new Map<string, number>();
  const debut = periode.debut.getTime() === 0
    ? (dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date())
    : periode.debut;

  const curseur = new Date(debut);
  if (periode.granularite === 'mois') curseur.setDate(1);
  curseur.setHours(0, 0, 0, 0);

  while (curseur <= periode.fin) {
    compte.set(cleGranulaire(curseur, periode.granularite), 0);
    if (periode.granularite === 'jour') curseur.setDate(curseur.getDate() + 1);
    else curseur.setMonth(curseur.getMonth() + 1);
  }

  for (const d of dates) {
    const k = cleGranulaire(d, periode.granularite);
    if (compte.has(k)) compte.set(k, (compte.get(k) ?? 0) + 1);
  }

  return [...compte.entries()].map(([cle, valeur]) => ({
    cle,
    libelle: periode.granularite === 'jour'
      ? new Date(cle + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      : new Date(cle + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    valeur,
  }));
}

/** Même construction, mais en additionnant des montants au lieu de compter des lignes. */
function construireSerieMontants(
  periode: Periode,
  entrees: { date: Date; montant: number }[]
): Point[] {
  const base = construireSerie(periode, []);
  const index = new Map(base.map((p) => [p.cle, p]));
  for (const e of entrees) {
    const p = index.get(cleGranulaire(e.date, periode.granularite));
    if (p) p.valeur += e.montant;
  }
  return base;
}

function dansPeriode(d: Date | null, periode: Periode): boolean {
  if (!d) return false;
  return d >= periode.debut && d <= periode.fin;
}

/** Période immédiatement antérieure, de même durée, pour calculer une évolution honnête. */
function periodePrecedente(periode: Periode): { debut: Date; fin: Date } | null {
  if (periode.debut.getTime() === 0) return null;
  const duree = periode.fin.getTime() - periode.debut.getTime();
  return {
    debut: new Date(periode.debut.getTime() - duree),
    fin: new Date(periode.debut.getTime() - 1),
  };
}

function classer(compte: Map<string, number>, limite: number): Classement[] {
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([nom, valeur]) => ({ nom, valeur }));
}

// ───────────────────────────── Lecture ─────────────────────────────

const LIMITE_LECTURE = 10000;

/** Tous les comptes, page par page : `listUsers` plafonne à 1000 par appel. */
async function lireTousLesComptes(supabase: ReturnType<typeof createAdminClient>) {
  const comptes: { id: string; email: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const lot = data?.users ?? [];
    comptes.push(...lot.map((u) => ({
      id: u.id,
      email: u.email ?? '(sans e-mail)',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
    })));
    if (lot.length < 1000) break;
  }
  return comptes;
}

export interface Alerte {
  id: string;
  niveau: 'info' | 'attention' | 'urgent';
  titre: string;
  detail: string;
  lien?: string;
}

/**
 * Alertes affichées dans l'en-tête de l'administration.
 *
 * Requête volontairement légère : elle s'exécute sur chaque page de l'admin.
 * Chaque alerte correspond à un fait vérifiable en base — aucune notification
 * décorative.
 */
export async function getAlertes(): Promise<Alerte[]> {
  const alertes: Alerte[] = [];

  try {
    const supabase = createAdminClient();
    const maintenant = Date.now();
    const dansSeptJours = new Date(maintenant + 7 * 86400000).toISOString();

    const [abosRes, comptesRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('user_id, plan, expires_at')
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .lte('expires_at', dansSeptJours)
        .gte('expires_at', new Date(maintenant).toISOString()),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const expirants = abosRes.data ?? [];
    if (expirants.length > 0) {
      alertes.push({
        id: 'expirations',
        niveau: 'urgent',
        titre: `${expirants.length} abonnement${expirants.length > 1 ? 's' : ''} expire${expirants.length > 1 ? 'nt' : ''} sous 7 jours`,
        detail: 'Pensez à relancer ces clients avant la coupure de leur accès.',
        lien: '/admin/finances',
      });
    }

    const comptes = comptesRes.data?.users ?? [];
    const debutDuJour = new Date();
    debutDuJour.setHours(0, 0, 0, 0);

    const nouveauxAujourdhui = comptes.filter(
      (u) => new Date(u.created_at) >= debutDuJour
    ).length;
    if (nouveauxAujourdhui > 0) {
      alertes.push({
        id: 'nouveaux',
        niveau: 'info',
        titre: `${nouveauxAujourdhui} nouvelle${nouveauxAujourdhui > 1 ? 's' : ''} inscription${nouveauxAujourdhui > 1 ? 's' : ''} aujourd'hui`,
        detail: "Consultez la liste des comptes pour voir qui vient d'arriver.",
        lien: '/admin/users',
      });
    }

    const nonConfirmes = comptes.filter((u) => !u.email_confirmed_at).length;
    if (nonConfirmes > 0) {
      alertes.push({
        id: 'non-confirmes',
        niveau: 'attention',
        titre: `${nonConfirmes} adresse${nonConfirmes > 1 ? 's' : ''} e-mail non confirmée${nonConfirmes > 1 ? 's' : ''}`,
        detail: 'Ces comptes ne pourront pas récupérer leur mot de passe.',
        lien: '/admin/users?filtre=non-confirmes',
      });
    }

    // Configuration manquante : mieux vaut l'apprendre ici qu'au moment où un
    // client tente de payer.
    const manquantes: string[] = [];
    if (!process.env.CHARIOW_API_KEY) manquantes.push('clé API Chariow');
    if (!process.env.CHARIOW_WEBHOOK_SECRET) manquantes.push('secret des webhooks');
    if (!process.env.CHARIOW_PRODUCT_ID_ESSENTIAL) manquantes.push('produit Essentiel');
    if (!process.env.GEMINI_API_KEY) manquantes.push('clé Gemini');
    if (manquantes.length > 0) {
      alertes.push({
        id: 'config',
        niveau: 'urgent',
        titre: 'Configuration incomplète',
        detail: `Manquant : ${manquantes.join(', ')}.`,
        lien: '/admin/settings',
      });
    }
  } catch {
    // Une erreur de lecture ne doit pas empêcher l'administration de s'afficher.
    return alertes;
  }

  return alertes;
}

export async function getAdminMetrics(periode: Periode): Promise<AdminMetrics> {
  const supabase = createAdminClient();
  const avertissements: string[] = [];

  const [comptes, abosRes, analysesRes, webhooksRes] = await Promise.all([
    lireTousLesComptes(supabase),
    supabase
      .from('subscriptions')
      .select('id, user_id, plan, status, amount, currency, created_at, expires_at, provider')
      .order('created_at', { ascending: false })
      .limit(LIMITE_LECTURE),
    supabase
      .from('analysis_history')
      .select('id, user_id, team1_name, team2_name, competition, score, confidence, is_finished, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMITE_LECTURE),
    supabase
      .from('webhook_events')
      .select('id, provider, event, payload, received_at')
      .order('received_at', { ascending: false })
      .limit(100),
  ]);

  const abos = abosRes.data ?? [];
  const analyses = analysesRes.data ?? [];
  const webhooks = webhooksRes.data ?? [];

  if (abosRes.error) avertissements.push(`Abonnements illisibles : ${abosRes.error.message}`);
  if (analysesRes.error) avertissements.push(`Analyses illisibles : ${analysesRes.error.message}`);
  if (webhooksRes.error) avertissements.push(`Événements de paiement illisibles : ${webhooksRes.error.message}`);
  if (abos.length === LIMITE_LECTURE) avertissements.push(`Seuls les ${LIMITE_LECTURE} abonnements les plus récents sont pris en compte.`);
  if (analyses.length === LIMITE_LECTURE) avertissements.push(`Seules les ${LIMITE_LECTURE} analyses les plus récentes sont prises en compte.`);

  const emailParId = new Map(comptes.map((c) => [c.id, c.email]));
  const maintenant = Date.now();
  const precedente = periodePrecedente(periode);

  // ── Utilisateurs ──
  const datesInscription = comptes.map((c) => new Date(c.created_at));
  const nouveaux = comptes.filter((c) => dansPeriode(new Date(c.created_at), periode)).length;
  const nouveauxPrecedent = precedente
    ? comptes.filter((c) => {
        const d = new Date(c.created_at);
        return d >= precedente.debut && d <= precedente.fin;
      }).length
    : 0;
  const actifs = comptes.filter((c) => dansPeriode(c.last_sign_in_at ? new Date(c.last_sign_in_at) : null, periode)).length;

  // Comptés à part des abonnements : ce sont deux gestes commerciaux
  // différents, et les additionner rendrait le premier invisible.
  const revenusMatchs = await getRevenusMatchsUniques();

  // ── Abonnements ──
  const abosEnrichis: LigneAbonnement[] = abos.map((s) => {
    const cle = normalizePlan(s.plan);
    const config = cle ? PLANS[cle] : null;
    const actif =
      s.status === 'active' &&
      (s.expires_at ? new Date(s.expires_at).getTime() > maintenant : s.plan === 'lifetime');
    return {
      id: s.id,
      userId: s.user_id,
      email: emailParId.get(s.user_id) ?? '(compte supprimé)',
      offre: s.plan,
      offreLibelle: config?.label ?? s.plan,
      montant: Number(s.amount) || 0,
      devise: s.currency || 'XOF',
      statut: s.status,
      souscritLe: s.created_at,
      expireLe: s.expires_at,
      actif,
      fournisseur: s.provider,
    };
  });

  const abosActifs = abosEnrichis.filter((s) => s.actif);
  const nouveauxAbos = abosEnrichis.filter((s) => dansPeriode(new Date(s.souscritLe), periode));

  const parOffre: AdminMetrics['abonnements']['parOffre'] = (
    ['ESSENTIAL', 'PRO', 'VIP'] as PlanTier[]
  ).map((tier) => {
    const cle = (Object.keys(PLANS) as PlanKey[]).find((k) => PLANS[k].tier === tier)!;
    const lignes = abosActifs.filter((s) => normalizePlan(s.offre) === cle);
    return {
      tier,
      libelle: PLANS[cle].label,
      nombre: lignes.length,
      revenu: lignes.reduce((t, s) => t + s.montant, 0),
    };
  });

  const septJours = maintenant + 7 * 86400000;
  const expirentBientot = abosActifs.filter(
    (s) => s.expireLe && new Date(s.expireLe).getTime() <= septJours
  ).length;

  // ── Revenus ──
  const totalCumule = abosEnrichis.reduce((t, s) => t + s.montant, 0);
  const surPeriode = nouveauxAbos.reduce((t, s) => t + s.montant, 0);
  const surPeriodePrecedente = precedente
    ? abosEnrichis
        .filter((s) => {
          const d = new Date(s.souscritLe);
          return d >= precedente.debut && d <= precedente.fin;
        })
        .reduce((t, s) => t + s.montant, 0)
    : 0;

  // Revenu mensuel normalisé : le VIP annuel est ramené au douzième.
  const revenuMensuelRecurrent = Math.round(
    abosActifs.reduce((t, s) => {
      const cle = normalizePlan(s.offre);
      if (!cle) return t;
      const jours = PLANS[cle].durationDays;
      return t + (s.montant * 30) / jours;
    }, 0)
  );

  // ── Analyses ──
  const analysesPeriode = analyses.filter((a) => dansPeriode(new Date(a.created_at), periode));
  const analysesPrecedent = precedente
    ? analyses.filter((a) => {
        const d = new Date(a.created_at);
        return d >= precedente.debut && d <= precedente.fin;
      }).length
    : 0;

  const confiances = analysesPeriode
    .map((a) => (typeof a.confidence === 'number' ? a.confidence : null))
    .filter((c): c is number => c !== null);

  const parCompetition = new Map<string, number>();
  const parClub = new Map<string, number>();
  const parUtilisateur = new Map<string, number>();
  for (const a of analysesPeriode) {
    if (a.competition) parCompetition.set(a.competition, (parCompetition.get(a.competition) ?? 0) + 1);
    for (const club of [a.team1_name, a.team2_name]) {
      if (club) parClub.set(club, (parClub.get(club) ?? 0) + 1);
    }
    const email = emailParId.get(a.user_id) ?? '(compte supprimé)';
    parUtilisateur.set(email, (parUtilisateur.get(email) ?? 0) + 1);
  }

  const nbJoursPeriode = Math.max(
    1,
    Math.round(
      ((periode.debut.getTime() === 0
        ? maintenant - (datesInscription.length ? Math.min(...datesInscription.map((d) => d.getTime())) : maintenant)
        : periode.fin.getTime() - periode.debut.getTime()) / 86400000)
    )
  );

  // ── Analyses par utilisateur, pour la liste des comptes ──
  const analysesParCompte = new Map<string, number>();
  for (const a of analyses) {
    analysesParCompte.set(a.user_id, (analysesParCompte.get(a.user_id) ?? 0) + 1);
  }

  const meilleurAboParCompte = new Map<string, LigneAbonnement>();
  const RANG: Record<PlanTier, number> = { FREE: 0, ESSENTIAL: 1, PRO: 2, VIP: 3 };
  for (const s of abosActifs) {
    const compte = comptes.find((c) => c.email === s.email);
    if (!compte) continue;
    const cle = normalizePlan(s.offre);
    if (!cle) continue;
    const actuel = meilleurAboParCompte.get(compte.id);
    const rangActuel = actuel ? RANG[PLANS[normalizePlan(actuel.offre)!].tier] : -1;
    if (RANG[PLANS[cle].tier] > rangActuel) meilleurAboParCompte.set(compte.id, s);
  }

  const listeUtilisateurs: LigneUtilisateur[] = comptes
    .map((c) => {
      const estAdmin = ADMIN_EMAILS.includes(c.email.toLowerCase());
      const abo = meilleurAboParCompte.get(c.id);
      const cle = abo ? normalizePlan(abo.offre) : null;
      // Un accès offert ne laisse aucune trace dans les abonnements : sans ce
      // rattrapage, un partenaire apparaîtrait ici en « Gratuit » alors qu'il
      // dispose de tout le produit.
      const offert = estAdmin ? null : niveauOffert(c.email);
      const tier: PlanTier = estAdmin ? 'VIP' : offert ?? (cle ? PLANS[cle].tier : 'FREE');
      return {
        id: c.id,
        email: c.email,
        inscritLe: c.created_at,
        derniereConnexion: c.last_sign_in_at,
        emailConfirme: !!c.email_confirmed_at,
        offre: tier,
        offreLibelle: estAdmin
          ? 'Administrateur'
          : offert
            ? `Partenaire (${offert})`
            : cle
              ? PLANS[cle].label
              : 'Gratuit',
        estAdmin,
        expireLe: abo?.expireLe ?? null,
        montantPaye: abosEnrichis
          .filter((s) => s.email === c.email)
          .reduce((t, s) => t + s.montant, 0),
        nbAnalyses: analysesParCompte.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => +new Date(b.inscritLe) - +new Date(a.inscritLe));

  // ── Partenaires ──
  // On part de la liste des accès accordés, et non des comptes existants :
  // c'est le seul moyen de voir un accès accordé mais jamais utilisé, qui est
  // précisément l'information utile pour relancer un partenaire.
  const compteParEmail = new Map(comptes.map((c) => [c.email.toLowerCase(), c]));

  const listePartenaires: LignePartenaire[] = ACCES_OFFERTS.map(({ email, niveau }) => {
    const compte = compteParEmail.get(email);
    return {
      userId: compte?.id ?? null,
      email,
      niveau,
      inscrit: !!compte,
      inscritLe: compte?.created_at ?? null,
      derniereConnexion: compte?.last_sign_in_at ?? null,
      nbAnalyses: compte ? analysesParCompte.get(compte.id) ?? 0 : 0,
    };
  }).sort((a, b) => Number(b.inscrit) - Number(a.inscrit) || a.email.localeCompare(b.email));

  const partenaires = {
    total: listePartenaires.length,
    inscrits: listePartenaires.filter((p) => p.inscrit).length,
    enAttente: listePartenaires.filter((p) => !p.inscrit).length,
    analysesCumulees: listePartenaires.reduce((t, p) => t + p.nbAnalyses, 0),
    liste: listePartenaires,
  };

  // ── Les rapports entre les chiffres ──
  // Un total isolé ne dit rien. « 20 comptes » prend son sens rapporté aux
  // 3 abonnés, et « 20 000 FCFA » rapporté au coût des partenaires.

  // Coût des partenaires : lu directement plutôt que via le module dédié, qui
  // recharge toute la liste des comptes — déjà chargée ici.
  let coutPartenairesXof = 0;
  try {
    const [{ data: contrats }, { data: relevesPartenaires }] = await Promise.all([
      supabase.from('partners').select('amount, currency'),
      supabase.from('partner_reports').select('views'),
    ]);
    for (const c of contrats ?? []) {
      coutPartenairesXof += Number((c as any).amount ?? 0) * (TAUX_XOF[(c as any).currency] ?? 0);
    }
    const vues = (relevesPartenaires ?? []).reduce((t, r: any) => t + (r.views ?? 0), 0);
    coutPartenairesXof += (vues / 1000) * TAUX_POUR_MILLE_USD * (TAUX_XOF.USD ?? 0);
  } catch {
    // Table absente : le coût reste nul, aucune page ne doit tomber pour ça.
  }

  const precision = await getPrecisionReelle().catch(() => null);
  const confianceIA = confiances.length
    ? Math.round((confiances.reduce((t, c) => t + c, 0) / confiances.length) * 10) / 10
    : null;

  const comptesAyantAnalyse = new Set(analyses.map((a) => a.user_id)).size;
  const abonnesActifs = abosActifs.length;

  const pourcent = (part: number, total: number) =>
    total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

  const liens = {
    tauxConversion: pourcent(abonnesActifs, comptes.length),
    tauxActivation: pourcent(comptes.length - comptes.filter((c) => !c.last_sign_in_at).length, comptes.length),
    revenuParCompte: comptes.length ? Math.round(totalCumule / comptes.length) : 0,
    revenuParAbonne: abonnesActifs ? Math.round(totalCumule / abonnesActifs) : 0,
    analysesParAbonne: abonnesActifs
      ? Math.round((analyses.length / abonnesActifs) * 10) / 10
      : 0,
    tauxUsage: pourcent(comptesAyantAnalyse, comptes.length),
    confianceIA,
    precisionReelle: precision?.vainqueurCorrect ?? null,
    pronosticsVerifies: precision?.verifiees ?? 0,
    // L'écart n'a de sens qu'une fois la précision mesurée : comparer une
    // assurance déclarée à une valeur inexistante produirait un faux constat.
    ecartConfiance:
      confianceIA !== null && precision?.vainqueurCorrect != null
        ? Math.round((confianceIA - precision.vainqueurCorrect) * 10) / 10
        : null,
    coutPartenairesXof: Math.round(coutPartenairesXof),
    resultatNetXof: Math.round(totalCumule - coutPartenairesXof),
    tauxAboutissementPaiements: pourcent(abosEnrichis.length, webhooks.length),
  };

  // ── Paiements ──
  const idParEmail = new Map(comptes.map((c) => [c.email.toLowerCase(), c.id]));
  const paiements: EvenementPaiement[] = webhooks.map((w) => {
    const p: any = w.payload ?? {};
    const vente = p.sale ?? p.data?.sale ?? {};
    const email = p.customer?.email ?? vente?.customer?.email ?? null;
    return {
      id: w.id,
      userId: email ? idParEmail.get(String(email).toLowerCase()) ?? null : null,
      fournisseur: w.provider,
      evenement: w.event,
      recuLe: w.received_at,
      montant: typeof vente?.amount?.value === 'number' ? vente.amount.value : null,
      devise: vente?.amount?.currency ?? null,
      email,
    };
  });

  return {
    periode: {
      libelle: periode.libelle,
      cle: periode.cle,
      debut: periode.debut.toISOString(),
      fin: periode.fin.toISOString(),
      granularite: periode.granularite,
    },

    utilisateurs: {
      total: comptes.length,
      nouveaux,
      nouveauxPrecedent,
      actifs,
      jamaisConnectes: comptes.filter((c) => !c.last_sign_in_at).length,
      emailsNonConfirmes: comptes.filter((c) => !c.email_confirmed_at).length,
      serie: construireSerie(periode, datesInscription.filter((d) => dansPeriode(d, periode))),
    },

    abonnements: {
      actifs: abosActifs.length,
      total: abosEnrichis.length,
      nouveaux: nouveauxAbos.length,
      expires: abosEnrichis.filter((s) => !s.actif).length,
      expirentBientot,
      parOffre,
      serie: construireSerie(periode, nouveauxAbos.map((s) => new Date(s.souscritLe))),
      liste: abosEnrichis,
    },

    revenus: {
      matchsUniques: {
        nombre: revenusMatchs.nombre,
        totalXof: revenusMatchs.totalXof,
        acheteursSansAbonnement: revenusMatchs.acheteursSansAbonnement,
      },
      totalCumule,
      surPeriode,
      surPeriodePrecedente,
      panierMoyen: abosEnrichis.length ? Math.round(totalCumule / abosEnrichis.length) : 0,
      revenuMensuelRecurrent,
      devise: abosEnrichis[0]?.devise ?? 'XOF',
      serie: construireSerieMontants(
        periode,
        nouveauxAbos.map((s) => ({ date: new Date(s.souscritLe), montant: s.montant }))
      ),
    },

    analyses: {
      total: analyses.length,
      surPeriode: analysesPeriode.length,
      surPeriodePrecedente: analysesPrecedent,
      moyenneParJour: Math.round((analysesPeriode.length / nbJoursPeriode) * 10) / 10,
      confianceMoyenne: confiances.length
        ? Math.round((confiances.reduce((t, c) => t + c, 0) / confiances.length) * 10) / 10
        : null,
      serie: construireSerie(periode, analysesPeriode.map((a) => new Date(a.created_at))),
      topCompetitions: classer(parCompetition, 8),
      topClubs: classer(parClub, 10),
      topUtilisateurs: classer(parUtilisateur, 10),
      dernieres: analysesPeriode.slice(0, 50).map((a) => ({
        id: a.id,
        userId: a.user_id,
        email: emailParId.get(a.user_id) ?? '(compte supprimé)',
        match: `${a.team1_name ?? '?'} — ${a.team2_name ?? '?'}`,
        competition: a.competition,
        score: a.score,
        confiance: typeof a.confidence === 'number' ? a.confidence : null,
        termine: !!a.is_finished,
        date: a.created_at,
      })),
    },

    partenaires,
    liens,
    paiements,
    listeUtilisateurs,
    avertissements,
  };
}
