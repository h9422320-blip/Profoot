/**
 * CE QUE L'ENTREPRISE DÉPENSE POUR TOURNER, ET QUI LE VOIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Supabase, Vercel, OpenRouter, Anthropic : sans eux, l'application ne
 * calcule rien et ne s'affiche nulle part. Ces factures étaient payées sur la
 * part du propriétaire, alors que ce sont des frais de l'entreprise — au même
 * titre que la commission de la boutique, qui est déduite, elle, depuis le
 * premier jour.
 *
 * Décision du propriétaire, le 25 septembre 2026 : ces dépenses se retirent du
 * chiffre d'affaires du mois AVANT le partage. Le partenaire participe donc
 * aux frais à hauteur de sa part — et c'est précisément pour cela qu'il doit
 * les voir, ligne par ligne. Un « −25 000 FCFA » sans explication se lit comme
 * une retenue arbitraire ; « Supabase — abonnement mensuel, 25 $ » se
 * comprend.
 *
 * ── OÙ ELLES SONT RANGÉES, ET POURQUOI LÀ ─────────────────────────────────
 *
 * Dans `webhook_events`, la table des événements du serveur, sous le
 * fournisseur `depense`. Ce n'est pas un détournement : une dépense EST un
 * événement daté, et cette table a exactement ce qu'il faut — un identifiant
 * UNIQUE par ligne, qui rend l'enregistrement idempotent. Une facture notée
 * deux fois ne peut pas fausser les comptes, et c'est la première exigence
 * quand on retire de l'argent à quelqu'un.
 *
 * Créer une table demanderait une migration passée à la main dans Supabase.
 * Le jour où il y en aura une à faire pour autre chose, celle-ci suivra ; en
 * attendant, les comptes ne peuvent pas attendre.
 *
 * ── LA CONVERSION EN FRANCS ───────────────────────────────────────────────
 *
 * Les factures arrivent en dollars, les recettes sont en francs CFA. Le taux
 * RÉELLEMENT appliqué est enregistré avec chaque dépense : une dépense de
 * septembre ne doit pas changer de montant parce que le dollar a bougé en
 * novembre. Un historique qui se réécrit tout seul n'est pas un historique.
 */
import { createAdminClient } from './supabase-admin';

/**
 * Le taux retenu, en francs CFA pour un dollar.
 *
 * Le franc CFA est arrimé à l'euro (1 € = 655,957 FCFA) ; le dollar, lui,
 * flotte. Six cents francs est la valeur retenue le 26 septembre 2026, à la
 * fois proche du marché et facile à vérifier de tête. Chaque dépense garde le
 * taux qui lui a été appliqué : changer celui-ci ne réécrit rien.
 */
export const TAUX_USD_XOF = 600;

/**
 * Le premier jour compté. Décision du propriétaire : le suivi des dépenses
 * commence le 26 septembre 2026 — rien d'antérieur ne vient réduire un
 * partage déjà annoncé.
 */
export const DEBUT_DU_SUIVI = '2026-09-26';

/**
 * ── LE TAUX EST MODIFIABLE, SANS TOUCHER AU PASSÉ ────────────────────────
 *
 * Demande du propriétaire, le 26 septembre 2026 : lui seul peut changer le
 * taux. Il est rangé dans la même table que les dépenses, sous le fournisseur
 * `reglage`, et une nouvelle valeur ne réécrit RIEN : chaque dépense garde le
 * taux qui lui a été appliqué le jour de son paiement. Changer le taux
 * n'influence donc que les dépenses à venir — c'est la seule façon d'avoir une
 * comptabilité qui ne bouge pas dans le dos du partenaire.
 */
const CLE_TAUX = 'reglage-taux-usd-xof';

export async function lireTauxUsdXof(): Promise<number> {
  try {
    const { data } = await createAdminClient()
      .from('webhook_events')
      .select('payload, received_at')
      .eq('provider', 'reglage')
      .eq('event', 'taux-usd-xof')
      .order('received_at', { ascending: false })
      .limit(1);
    const t = Number((data ?? [])[0]?.payload?.taux);
    return Number.isFinite(t) && t > 0 ? t : TAUX_USD_XOF;
  } catch {
    return TAUX_USD_XOF;
  }
}

/** Change le taux. Rend le taux réellement en place après l'opération. */
export async function definirTauxUsdXof(taux: number, parQui: string): Promise<number> {
  const t = Number(taux);
  // Un taux absurde ferait entrer des sommes absurdes dans les comptes.
  if (!Number.isFinite(t) || t < 100 || t > 2000) return lireTauxUsdXof();
  try {
    await createAdminClient().from('webhook_events').insert({
      provider: 'reglage',
      delivery_id: `${CLE_TAUX}-${Date.now()}`,
      event: 'taux-usd-xof',
      payload: { taux: Math.round(t), parQui, le: new Date().toISOString() },
    });
  } catch (e: any) {
    console.error('[DÉPENSES] Taux non enregistré :', e?.message);
  }
  return lireTauxUsdXof();
}

/**
 * Les outils payés, dans L'ORDRE où le propriétaire veut les lire.
 *
 * Demande du 26 septembre 2026 : « tu commences par Claude, ensuite
 * OpenRouter, Supabase, Vercel ». L'ordre de cet objet EST l'ordre d'affichage.
 *
 * MakeTou n'y figure PLUS : sa commission est déjà retirée automatiquement,
 * vente par vente, sous le nom « frais de boutique ». L'inscrire aussi ici la
 * retirerait deux fois — et c'est le partenaire qui paierait l'erreur.
 */
export const FOURNISSEURS = {
  anthropic: 'Claude — Claude Code et Agent VIP',
  openrouter: 'OpenRouter — modèles d’analyse',
  supabase: 'Supabase — base de données et comptes',
  vercel: 'Vercel — hébergement de l’application',
  apifootball: 'API-Football — données des matchs',
  resend: 'Resend — envoi des courriels',
  meta: 'Meta — publicité',
  autre: 'Autre dépense',
} as const;

/**
 * Les lignes toujours affichées, même à zéro : les outils que l'application
 * paie chaque mois. Les autres (courriels, publicité, divers) n'apparaissent
 * que le mois où un paiement existe.
 */
export const OUTILS_TOUJOURS_AFFICHES = ['anthropic', 'openrouter', 'supabase', 'vercel', 'apifootball'] as const;

export type Fournisseur = keyof typeof FOURNISSEURS;

export interface Depense {
  /** Jour du paiement, AAAA-MM-JJ. C'est lui qui décide du mois imputé. */
  jour: string;
  fournisseur: Fournisseur;
  /** Ce que la ligne dit au partenaire : « abonnement mensuel », « crédits »… */
  libelle: string;
  /** Montant réglé, dans sa devise d'origine. */
  montant: number;
  devise: 'USD' | 'XOF' | 'EUR';
  /** Francs CFA pour une unité de la devise, tel qu'appliqué ce jour-là. */
  taux: number;
  /** Le montant en francs, arrondi : c'est lui qui entre dans les comptes. */
  montantXof: number;
  /** Revient-elle chaque mois ? Sert à prévoir, jamais à créer une ligne seule. */
  recurrente: boolean;
  /** D'où vient l'information : un reçu par courriel, ou une saisie. */
  source: string;
  /** Référence vérifiable : numéro de facture, identifiant du courriel… */
  reference: string | null;
}

export interface LigneDepense extends Depense {
  /** L'identifiant unique de l'écriture, pour ne jamais la compter deux fois. */
  cle: string;
  inscriteLe: string;
}

/** Convertit en francs CFA, au taux donné, sans jamais rendre de décimale. */
export function enFrancs(montant: number, devise: Depense['devise'], taux = TAUX_USD_XOF): number {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return 0;
  if (devise === 'XOF') return Math.round(m);
  if (devise === 'EUR') return Math.round(m * 655.957);
  return Math.round(m * (Number(taux) > 0 ? Number(taux) : TAUX_USD_XOF));
}

/**
 * La clé d'une dépense : fournisseur, mois, et montant.
 *
 * Deux factures Supabase du même mois pour le même montant sont la même
 * facture notée deux fois — pas deux dépenses. Deux montants différents, en
 * revanche, sont deux dépenses (des crédits rechargés deux fois, par exemple).
 */
export function cleDeDepense(
  d: Pick<Depense, 'jour' | 'fournisseur' | 'montant' | 'devise'> & { reference?: string | null }
): string {
  const mois = String(d.jour ?? '').slice(0, 7);
  // ── UN SECOND PAIEMENT RÉEL DU MÊME MONTANT ──────────────────────────────
  //
  // Revue du 26 septembre 2026 : deux recharges de 10 $ chez OpenRouter dans
  // le même mois donnaient la même clé, et la seconde était refusée comme un
  // doublon — 6 000 francs de dépense réelle manquaient au partage. Quand une
  // référence existe (numéro de facture, ou date du paiement), elle entre dans
  // la clé : deux factures distinctes ont deux clés, la même facture relue
  // deux fois garde la sienne. Sans référence, la clé est celle d'avant.
  const ref = String(d.reference ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `depense-${d.fournisseur}-${mois}-${d.devise}-${Math.round(Number(d.montant) * 100)}${ref ? `-${ref}` : ''}`;
}

/**
 * Inscrit une dépense. Rend ce qui s'est passé, sans jamais lever : une
 * écriture comptable qui échoue doit se voir, pas casser l'appel.
 */
export async function inscrireDepense(
  d: Omit<Depense, 'montantXof' | 'taux'> & { taux?: number }
): Promise<'inscrite' | 'deja-connue' | 'refusee'> {
  // Un jour illisible imputerait la dépense au mauvais mois ; un fournisseur
  // inconnu (« maketou », par exemple, déjà retiré comme frais de boutique)
  // retirerait deux fois la même somme ; une date antérieure au début du suivi
  // modifierait un partage que personne n'a jamais vu bouger.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.jour))) return 'refusee';
  if (!Object.prototype.hasOwnProperty.call(FOURNISSEURS, d.fournisseur)) return 'refusee';
  if (String(d.jour) < DEBUT_DU_SUIVI) return 'refusee';

  const taux = Number(d.taux) > 0 ? Number(d.taux) : TAUX_USD_XOF;
  const montantXof = enFrancs(d.montant, d.devise, taux);
  if (!montantXof) return 'refusee';

  const ligne: Depense = { ...d, taux, montantXof };
  const cle = cleDeDepense(ligne);

  try {
    const { error } = await createAdminClient().from('webhook_events').insert({
      provider: 'depense',
      delivery_id: cle,
      event: ligne.fournisseur,
      payload: ligne,
    });
    if (!error) return 'inscrite';
    // 23505 : la clé existe déjà. C'est le comportement voulu, pas une panne.
    if (String((error as any).code) === '23505') return 'deja-connue';
    console.error('[DÉPENSES] Inscription impossible :', error.message);
    return 'refusee';
  } catch (e: any) {
    console.error('[DÉPENSES] Inscription impossible :', e?.message);
    return 'refusee';
  }
}

/**
 * Retire une dépense — une facture notée par erreur, ou imputée au mauvais
 * projet. Rien n'est effacé à l'aveugle : la clé est exigée entière.
 */
export async function retirerDepense(cle: string): Promise<boolean> {
  const c = String(cle ?? '').trim();
  if (!c.startsWith('depense-')) return false;
  try {
    const { error } = await createAdminClient()
      .from('webhook_events')
      .delete()
      .eq('provider', 'depense')
      .eq('delivery_id', c);
    return !error;
  } catch {
    return false;
  }
}

/** Toutes les dépenses inscrites, de la plus récente à la plus ancienne. */
export async function lireDepenses(depuis?: Date): Promise<LigneDepense[]> {
  try {
    let requete = createAdminClient()
      .from('webhook_events')
      .select('delivery_id, payload, received_at')
      .eq('provider', 'depense')
      .order('received_at', { ascending: false })
      .limit(2000);
    if (depuis) requete = requete.gte('received_at', depuis.toISOString());
    const { data, error } = await requete;
    if (error) {
      console.warn('[DÉPENSES] Lecture impossible :', error.message);
      return [];
    }
    return (data ?? [])
      .map((l: any) => ({ ...(l.payload ?? {}), cle: String(l.delivery_id), inscriteLe: String(l.received_at) }))
      .filter((d: any) => d.jour && Number(d.montantXof) > 0) as LigneDepense[];
  } catch (e: any) {
    console.warn('[DÉPENSES] Lecture impossible :', e?.message);
    return [];
  }
}

export interface MoisDeDepenses {
  /** AAAA-MM. */
  mois: string;
  totalXof: number;
  lignes: LigneDepense[];
}

/**
 * Les dépenses rangées par mois de PAIEMENT.
 *
 * Le mois imputé est celui du jour de paiement, jamais celui de l'inscription :
 * une facture de septembre notée le 2 octobre reste une dépense de septembre,
 * sans quoi le partage d'un mois clos bougerait après coup.
 */
export async function depensesParMois(depuis?: Date): Promise<Map<string, MoisDeDepenses>> {
  const lignes = await lireDepenses();
  const parMois = new Map<string, MoisDeDepenses>();
  for (const l of lignes) {
    const mois = String(l.jour).slice(0, 7);
    if (depuis && mois < depuis.toISOString().slice(0, 7)) continue;
    const poste = parMois.get(mois) ?? { mois, totalXof: 0, lignes: [] };
    poste.totalXof += Number(l.montantXof) || 0;
    poste.lignes.push(l);
    parMois.set(mois, poste);
  }
  for (const poste of parMois.values()) {
    poste.lignes.sort((a, b) => String(b.jour).localeCompare(String(a.jour)));
  }
  return parMois;
}

/** Le libellé complet d'une ligne, tel que le partenaire le lit. */
export function libelleDepense(d: Pick<Depense, 'fournisseur' | 'libelle' | 'montant' | 'devise'>): string {
  const nom = FOURNISSEURS[d.fournisseur] ?? FOURNISSEURS.autre;
  const somme =
    d.devise === 'XOF'
      ? `${Math.round(Number(d.montant)).toLocaleString('fr-FR')} FCFA`
      : `${Number(d.montant).toLocaleString('fr-FR')} ${d.devise === 'USD' ? '$' : '€'}`;
  return `${nom.split(' — ')[0]} — ${d.libelle} (${somme})`;
}

/**
 * ── LE TABLEAU DU MOIS, TEL QU'IL S'AFFICHE ───────────────────────────────
 *
 * Demande du propriétaire, le 26 septembre 2026 : pas de formulaire, une liste
 * ordonnée — un outil par ligne, du haut vers le bas, Claude d'abord, puis
 * OpenRouter, Supabase, Vercel — avec en face ce qui a été payé. C'est Claude
 * qui inscrit les paiements (voir `scripts/depense.mts`) ; la page ne fait que
 * lire.
 *
 * Fonction pure, pour être vérifiable par une épreuve. Une règle la tient :
 * le total du tableau est EXACTEMENT la somme de toutes les lignes du mois —
 * celle que le partage retire. Une ligne d'un fournisseur inconnu n'est donc
 * jamais perdue : elle tombe dans « Autre dépense ». Un tableau dont le total
 * ne coïncide pas avec la déduction serait pire que pas de tableau.
 */
export interface RangeeOutil {
  fournisseur: Fournisseur;
  /** « Claude », « Supabase »… */
  nom: string;
  /** Ce que l'outil fait pour l'application : « hébergement de l'application ». */
  role: string;
  /** Les paiements du mois, du plus récent au plus ancien. */
  paiements: LigneDepense[];
  /** Ce qui a été payé, dans la devise d'origine : « 25 $ », « 25 $ + 5 000 FCFA », ou « — ». */
  paye: string;
  /** La somme en francs, celle qui sort du chiffre d'affaires. */
  montantXof: number;
}

export interface TableauDuMois {
  mois: string;
  rangees: RangeeOutil[];
  paye: string;
  totalXof: number;
}

const DEVISES: Depense['devise'][] = ['USD', 'EUR', 'XOF'];

/** « 25 $ + 5 000 FCFA » : ce qui a été réellement payé, sans conversion. */
export function sommeParDevise(lignes: Pick<Depense, 'montant' | 'devise'>[]): string {
  const par: Record<string, number> = { USD: 0, EUR: 0, XOF: 0 };
  for (const l of lignes) {
    const m = Number(l.montant);
    if (DEVISES.includes(l.devise) && Number.isFinite(m) && m > 0) par[l.devise] += m;
  }
  const morceaux: string[] = [];
  // Arrondi au centime : 0,1 + 0,2 ne doit jamais s'afficher 0,30000000000000004.
  const cent = (n: number) => Math.round(n * 100) / 100;
  const fr = (n: number) => cent(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  if (par.USD > 0) morceaux.push(`${fr(par.USD)} $`);
  if (par.EUR > 0) morceaux.push(`${fr(par.EUR)} €`);
  if (par.XOF > 0) morceaux.push(`${Math.round(par.XOF).toLocaleString('fr-FR')} FCFA`);
  return morceaux.length ? morceaux.join(' + ') : '—';
}

export function tableauDuMois(mois: string, lignes: LigneDepense[]): TableauDuMois {
  const duMois = lignes.filter((l) => String(l.jour).slice(0, 7) === mois);

  // Chaque ligne va dans la rangée de son fournisseur ; un fournisseur inconnu
  // va dans « Autre dépense », jamais nulle part.
  const cleDe = (l: LigneDepense): Fournisseur =>
    (Object.prototype.hasOwnProperty.call(FOURNISSEURS, l.fournisseur) ? l.fournisseur : 'autre') as Fournisseur;

  const parOutil = new Map<Fournisseur, LigneDepense[]>();
  for (const l of duMois) {
    const c = cleDe(l);
    parOutil.set(c, [...(parOutil.get(c) ?? []), l]);
  }

  // L'ordre : les outils de tous les mois d'abord, dans l'ordre demandé ; puis
  // les autres, dans l'ordre de FOURNISSEURS, seulement s'ils ont un paiement.
  const ordre: Fournisseur[] = [
    ...OUTILS_TOUJOURS_AFFICHES,
    ...(Object.keys(FOURNISSEURS) as Fournisseur[]).filter(
      (c) => !(OUTILS_TOUJOURS_AFFICHES as readonly string[]).includes(c) && parOutil.has(c)
    ),
  ];

  const rangees = ordre.map((fournisseur): RangeeOutil => {
    const paiements = [...(parOutil.get(fournisseur) ?? [])].sort((a, b) => String(b.jour).localeCompare(String(a.jour)));
    const [nom, role = ''] = FOURNISSEURS[fournisseur].split(' — ');
    return {
      fournisseur,
      nom,
      role,
      paiements,
      paye: sommeParDevise(paiements),
      montantXof: paiements.reduce((s, p) => s + (Number(p.montantXof) || 0), 0),
    };
  });

  return {
    mois,
    rangees,
    paye: sommeParDevise(duMois),
    totalXof: duMois.reduce((s, p) => s + (Number(p.montantXof) || 0), 0),
  };
}
