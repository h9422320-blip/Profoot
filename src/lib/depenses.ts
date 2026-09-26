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

/** Les fournisseurs connus, pour que l'affichage soit toujours nommé pareil. */
export const FOURNISSEURS = {
  supabase: 'Supabase — base de données et comptes',
  vercel: 'Vercel — hébergement de l’application',
  openrouter: 'OpenRouter — modèles d’analyse',
  anthropic: 'Anthropic — Agent VIP',
  apifootball: 'API-Football — données des matchs',
  meta: 'Meta — publicité',
  maketou: 'MakeTou — frais de boutique',
  autre: 'Autre dépense',
} as const;

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
export function cleDeDepense(d: Pick<Depense, 'jour' | 'fournisseur' | 'montant' | 'devise'>): string {
  const mois = String(d.jour ?? '').slice(0, 7);
  return `depense-${d.fournisseur}-${mois}-${d.devise}-${Math.round(Number(d.montant) * 100)}`;
}

/**
 * Inscrit une dépense. Rend ce qui s'est passé, sans jamais lever : une
 * écriture comptable qui échoue doit se voir, pas casser l'appel.
 */
export async function inscrireDepense(
  d: Omit<Depense, 'montantXof' | 'taux'> & { taux?: number }
): Promise<'inscrite' | 'deja-connue' | 'refusee'> {
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
