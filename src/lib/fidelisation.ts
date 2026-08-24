import { createAdminClient } from '@/lib/supabase-admin';
import { PLANS, type PlanKey } from '@/lib/subscription';

/**
 * LE PRODUIT RETIENT-IL, OU SE CONTENTE-T-IL D'ATTIRER ?
 *
 * ── LA QUESTION MAL POSÉE ─────────────────────────────────────────────────
 *
 * « Combien d'acheteurs rachètent ? » se répond tout seul, et la réponse ne
 * veut rien dire : mesuré le 24 août 2026, 14 clients sur 227 avaient payé
 * deux fois, soit 6 %. Sauf que la boutique avait dix-sept jours, qu'aucun
 * abonnement mensuel n'avait encore expiré — le premier arrivait à terme le
 * 6 septembre — et que treize de ces quatorze « rachats » étaient en réalité
 * des MONTÉES EN GAMME : 2 000 puis 5 000, ou 2 000 puis 15 000, en un jour
 * et demi de médiane. Personne n'avait racheté le même produit.
 *
 * Un taux de rachat brut, sur une boutique trop jeune, mesure surtout
 * l'impatience de celui qui le regarde.
 *
 * ── LA QUESTION QUI SE RÉPOND ─────────────────────────────────────────────
 *
 * Celle-ci : parmi ceux qui ont VRAIMENT épuisé leurs vingt analyses,
 * combien remettent la main à la poche ? Elle a un dénominateur honnête — on
 * ne reproche pas à quelqu'un de ne pas racheter s'il lui reste du crédit.
 *
 * Au 24 août 2026 : 16 % chez ceux qui étaient à sec, 1 % chez les autres.
 * Tomber à zéro multiplie par seize la chance qu'un client repaye. Ce n'est
 * pas la lassitude qui fait partir, c'est le compteur qui fait revenir.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────
 *
 * Il ne touche pas à l'argent. Les recettes ont leur source unique dans
 * `recettes-boutique.ts`, calée sur la boutique au franc près. Ici on compte
 * des COMPORTEMENTS, à partir des abonnements enregistrés par l'application —
 * les seuls qui portent un identifiant de compte, donc les seuls qu'on puisse
 * rapprocher des analyses consommées.
 */

/** Au-delà, on arrête de lire : le panneau doit rester rapide. */
const PLAFOND_LECTURE = 60000;

/** Un client qui vient d'épuiser son quota n'a pas encore eu le temps de choisir. */
const JOURS_POUR_DECIDER = 3;

export interface GroupeFidelisation {
  /** Combien d'abonnés dans ce groupe. */
  total: number;
  /** Combien ont repayé au moins une fois. */
  ontRepaye: number;
  /** En pourcentage, arrondi au dixième. */
  taux: number;
}

export interface BilanFidelisation {
  /** Vrai quand aucune donnée n'est encore disponible. */
  vide: boolean;

  /** Tous les acheteurs, tous produits confondus. */
  acheteurs: number;
  ontPayePlusieursFois: number;
  tauxBrut: number;

  /** Délai entre deux paiements du même client, en jours. */
  delaiMoyenJours: number | null;
  delaiMedianJours: number | null;

  /** Le cœur de la mesure : le rachat selon qu'on soit à sec ou non. */
  aSec: GroupeFidelisation;
  encoreDuCredit: GroupeFidelisation;

  /** Combien de temps tiennent les analyses incluses dans l'offre d'entrée. */
  dureeQuotaJours: { moyenne: number; mediane: number } | null;

  /** Parmi ceux qui sont à sec, combien l'ont été assez longtemps pour décider. */
  aSecDepuisAssezLongtemps: number;
  aSecTropRecemment: number;

  /** Ce qui se rachète après quoi, du plus fréquent au moins fréquent. */
  montees: { de: string; vers: string; nombre: number }[];

  /** L'évolution, semaine par semaine, depuis le premier paiement. */
  parSemaine: { debut: string; nouveaux: number; ontRepaye: number; taux: number }[];

  /** De quoi juger si les chiffres sont mûrs. */
  ageBoutiqueJours: number;
  premierPaiement: string | null;
  /** Date à laquelle le tout premier abonnement mensuel arrive à terme. */
  premierRenouvellementPossible: string | null;
  /** Vrai tant qu'aucun abonnement n'a pu expirer : le taux brut n'a alors aucun sens. */
  tropJeunePourJuger: boolean;
}

const vide = (): BilanFidelisation => ({
  vide: true,
  acheteurs: 0,
  ontPayePlusieursFois: 0,
  tauxBrut: 0,
  delaiMoyenJours: null,
  delaiMedianJours: null,
  aSec: { total: 0, ontRepaye: 0, taux: 0 },
  encoreDuCredit: { total: 0, ontRepaye: 0, taux: 0 },
  dureeQuotaJours: null,
  aSecDepuisAssezLongtemps: 0,
  aSecTropRecemment: 0,
  montees: [],
  parSemaine: [],
  ageBoutiqueJours: 0,
  premierPaiement: null,
  premierRenouvellementPossible: null,
  tropJeunePourJuger: true,
});

const arrondi = (n: number, decimales = 1) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

const part = (n: number, sur: number) => (sur > 0 ? arrondi((n / sur) * 100) : 0);

/** Le libellé lisible d'une offre, sans exposer sa clé technique. */
function libelleOffre(plan: string | null | undefined, montant: unknown): string {
  const cle = String(plan ?? '') as PlanKey;
  if (cle in PLANS) return PLANS[cle].label;
  const n = Number(montant);
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString('fr-FR')} F` : 'Offre inconnue';
}

/**
 * Lit une table page par page.
 *
 * Supabase rend mille lignes au maximum par requête, silencieusement. Une
 * lecture sans pagination donnait ici des durées calculées sur le premier
 * millier d'analyses — soit un tiers du total, et des moyennes fausses sans
 * qu'aucune erreur ne le signale.
 */
async function lireTout<T>(
  table: string,
  colonnes: string,
  ordonner?: { colonne: string; croissant: boolean },
  /** Restreint la lecture à ces comptes. Absent, on lit toute la table. */
  comptes?: string[]
): Promise<T[]> {
  const admin = createAdminClient();
  const tout: T[] = [];

  // Une clause `in` trop longue finit par dépasser la taille d'URL admise :
  // on la découpe. Cent identifiants par requête tiennent largement.
  const paquets = comptes ? decouper(comptes, 100) : [null];

  for (const paquet of paquets) {
    for (let de = 0; de < PLAFOND_LECTURE; de += 1000) {
      let requete = admin.from(table).select(colonnes).range(de, de + 999);
      if (ordonner) requete = requete.order(ordonner.colonne, { ascending: ordonner.croissant });
      if (paquet) requete = requete.in('user_id', paquet);

      const { data, error } = await requete;
      if (error) throw error;
      if (!data?.length) break;

      tout.push(...(data as T[]));
      if (data.length < 1000) break;
    }
  }

  return tout;
}

function decouper<T>(liste: T[], taille: number): T[][] {
  const paquets: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) paquets.push(liste.slice(i, i + taille));
  return paquets;
}

type LigneAbonnement = {
  user_id: string;
  plan: string | null;
  amount: number | null;
  created_at: string;
};
type LigneUsage = { user_id: string; created_at: string };

export async function lireBilanFidelisation(): Promise<BilanFidelisation> {
  let abos: LigneAbonnement[];
  let usage: LigneUsage[];

  try {
    abos = await lireTout<LigneAbonnement>(
      'subscriptions',
      'user_id, plan, amount, created_at',
      { colonne: 'created_at', croissant: true }
    );

    // ── ON NE LIT QUE LES ANALYSES QUI SERVENT ────────────────────────────
    //
    // Seuls les comptes ayant payé entrent dans cette mesure. Lire la table
    // entière était juste au premier jour et le resterait longtemps, mais la
    // lecture grossit avec l'usage et non avec le nombre de clients : à
    // soixante mille analyses, le panneau aurait enchaîné soixante requêtes à
    // chaque ouverture de l'administration.
    const comptes = [...new Set(abos.map((a) => a.user_id).filter(Boolean))];
    usage = comptes.length
      ? await lireTout<LigneUsage>(
          'analysis_usage',
          'user_id, created_at',
          { colonne: 'created_at', croissant: true },
          comptes
        )
      : [];
  } catch (e) {
    console.error('[FIDELISATION] Lecture impossible:', e);
    return vide();
  }

  return calculerFidelisation(abos, usage, Date.now());
}

/**
 * Le calcul, séparé de la lecture.
 *
 * Séparé pour être vérifiable : les épreuves de `fidelisation.test.ts` lui
 * donnent des abonnés fabriqués et contrôlent que le dénominateur reste
 * honnête. Une fonction qui parle à la base ne se teste pas.
 *
 * `maintenant` est passé plutôt que lu : sans quoi une épreuve écrite
 * aujourd'hui échouerait dans un mois, quand le premier abonnement aura
 * expiré pour de bon.
 */
export function calculerFidelisation(
  abos: LigneAbonnement[],
  usage: LigneUsage[],
  maintenant: number
): BilanFidelisation {
  if (!abos.length) return vide();

  // Les paquets reviennent chacun trié : il faut retrier l'ensemble, sans quoi
  // la vingtième analyse d'un compte ne serait pas la bonne.
  usage = [...usage].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  abos = [...abos].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  // ── Chaque client, ses paiements dans l'ordre ───────────────────────────
  const paiements = new Map<string, LigneAbonnement[]>();
  for (const a of abos) {
    if (!a.user_id) continue;
    const liste = paiements.get(a.user_id);
    if (liste) liste.push(a);
    else paiements.set(a.user_id, [a]);
  }
  for (const liste of paiements.values()) {
    liste.sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
  }

  const clients = [...paiements.values()];
  const revenus = clients.filter((l) => l.length > 1);

  // ── Le délai entre deux paiements ───────────────────────────────────────
  const delais: number[] = [];
  for (const l of revenus) {
    for (let i = 1; i < l.length; i++) {
      const j = (Date.parse(l[i].created_at) - Date.parse(l[i - 1].created_at)) / 86_400_000;
      if (Number.isFinite(j) && j >= 0) delais.push(j);
    }
  }
  delais.sort((a, b) => a - b);
  const delaiMoyenJours = delais.length
    ? arrondi(delais.reduce((s, x) => s + x, 0) / delais.length)
    : null;
  const delaiMedianJours = delais.length ? arrondi(delais[Math.floor(delais.length / 2)]) : null;

  // ── Ce qui se rachète après quoi ────────────────────────────────────────
  const suites = new Map<string, { de: string; vers: string; nombre: number }>();
  for (const l of revenus) {
    for (let i = 1; i < l.length; i++) {
      const de = libelleOffre(l[i - 1].plan, l[i - 1].amount);
      const vers = libelleOffre(l[i].plan, l[i].amount);
      const cle = `${de}→${vers}`;
      const dejaVu = suites.get(cle);
      if (dejaVu) dejaVu.nombre++;
      else suites.set(cle, { de, vers, nombre: 1 });
    }
  }

  // ── La consommation, compte par compte ──────────────────────────────────
  //
  // On compte les analyses de TOUTE la vie du compte, pas seulement celles de
  // la période en cours : la question posée est « a-t-il fini son crédit »,
  // et un abonné qui a consommé vingt analyses les a consommées.
  const consommees = new Map<string, number>();
  const vingtieme = new Map<string, string>();
  for (const u of usage) {
    const n = (consommees.get(u.user_id) ?? 0) + 1;
    consommees.set(u.user_id, n);
    if (n === PLANS.essential_monthly.analysisLimit) vingtieme.set(u.user_id, u.created_at);
  }

  // ── Ceux qui sont entrés par l'offre Essentiel ──────────────────────────
  //
  // Eux seuls ont un quota assez court pour l'épuiser en quelques jours. Les
  // abonnés Pro ou VIP ne peuvent pas répondre à la question — mélanger les
  // trois ferait paraître la rétention meilleure qu'elle n'est.
  const quota = PLANS.essential_monthly.analysisLimit;
  const entresParEssentiel = clients.filter((l) => l[0].plan === 'essential_monthly');

  const aSecListe = entresParEssentiel.filter((l) => (consommees.get(l[0].user_id) ?? 0) >= quota);
  const creditListe = entresParEssentiel.filter((l) => (consommees.get(l[0].user_id) ?? 0) < quota);

  const groupe = (liste: LigneAbonnement[][]): GroupeFidelisation => {
    const ontRepaye = liste.filter((l) => l.length > 1).length;
    return { total: liste.length, ontRepaye, taux: part(ontRepaye, liste.length) };
  };

  // ── Combien de temps tient le crédit d'entrée ───────────────────────────
  const premiereAnalyse = new Map<string, string>();
  for (const u of usage) if (!premiereAnalyse.has(u.user_id)) premiereAnalyse.set(u.user_id, u.created_at);

  const durees: number[] = [];
  for (const l of aSecListe) {
    const debut = premiereAnalyse.get(l[0].user_id);
    const fin = vingtieme.get(l[0].user_id);
    if (!debut || !fin) continue;
    const j = (Date.parse(fin) - Date.parse(debut)) / 86_400_000;
    if (Number.isFinite(j) && j >= 0) durees.push(j);
  }
  durees.sort((a, b) => a - b);
  const dureeQuotaJours = durees.length
    ? {
        moyenne: arrondi(durees.reduce((s, x) => s + x, 0) / durees.length),
        mediane: arrondi(durees[Math.floor(durees.length / 2)]),
      }
    : null;

  // ── Sont-ils à sec depuis assez longtemps pour avoir décidé ? ───────────
  let aSecDepuisAssezLongtemps = 0;
  let aSecTropRecemment = 0;
  for (const l of aSecListe) {
    const fin = vingtieme.get(l[0].user_id);
    if (!fin) continue;
    if ((maintenant - Date.parse(fin)) / 86_400_000 >= JOURS_POUR_DECIDER) aSecDepuisAssezLongtemps++;
    else aSecTropRecemment++;
  }

  // ── L'évolution, semaine par semaine ────────────────────────────────────
  //
  // Par semaine et non par mois : la boutique n'a pas encore vécu deux mois,
  // un découpage mensuel donnerait une seule barre et ne montrerait aucune
  // évolution.
  const semaines = new Map<string, { nouveaux: number; ontRepaye: number }>();
  for (const l of clients) {
    const d = new Date(l[0].created_at);
    if (Number.isNaN(d.getTime())) continue;
    // On recule jusqu'au lundi précédent.
    const jour = (d.getUTCDay() + 6) % 7;
    const lundi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - jour));
    const cle = lundi.toISOString().slice(0, 10);
    const e = semaines.get(cle) ?? { nouveaux: 0, ontRepaye: 0 };
    e.nouveaux++;
    if (l.length > 1) e.ontRepaye++;
    semaines.set(cle, e);
  }

  const parSemaine = [...semaines.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([debut, e]) => ({
      debut,
      nouveaux: e.nouveaux,
      ontRepaye: e.ontRepaye,
      taux: part(e.ontRepaye, e.nouveaux),
    }));

  // ── L'âge de la boutique, et ce qu'il autorise à conclure ───────────────
  const premierPaiement = abos[0]?.created_at ?? null;
  const ageBoutiqueJours = premierPaiement
    ? Math.max(0, Math.round((maintenant - Date.parse(premierPaiement)) / 86_400_000))
    : 0;

  const premierRenouvellementPossible = premierPaiement
    ? new Date(
        Date.parse(premierPaiement) + PLANS.essential_monthly.durationDays * 86_400_000
      ).toISOString()
    : null;

  return {
    vide: false,
    acheteurs: clients.length,
    ontPayePlusieursFois: revenus.length,
    tauxBrut: part(revenus.length, clients.length),
    delaiMoyenJours,
    delaiMedianJours,
    aSec: groupe(aSecListe),
    encoreDuCredit: groupe(creditListe),
    dureeQuotaJours,
    aSecDepuisAssezLongtemps,
    aSecTropRecemment,
    montees: [...suites.values()].sort((a, b) => b.nombre - a.nombre).slice(0, 8),
    parSemaine,
    ageBoutiqueJours,
    premierPaiement,
    premierRenouvellementPossible,
    tropJeunePourJuger: premierRenouvellementPossible
      ? Date.parse(premierRenouvellementPossible) > maintenant
      : true,
  };
}
