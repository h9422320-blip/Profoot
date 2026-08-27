/**
 * ENCAISSEMENT MOBILE MONEY PAR PAWAPAY.
 *
 * ── POURQUOI UNE SECONDE PASSERELLE ───────────────────────────────────────
 *
 * Mesuré le 26 août 2026 sur 384 refus analysés un par un chez la boutique
 * actuelle, la même offre ne se vend pas du tout selon le pays :
 *
 *     Côte d'Ivoire   66,5 % de réussite — les refus sont des soldes vides
 *     Guinée          16,4 % — Orange Money : 1 réussite sur 48 tentatives
 *     Mali            16,7 % — GATEWAY_INTERNAL_ERROR sur 8 refus sur 10
 *
 * Dans quatre pays, PAS UN SEUL refus pour solde insuffisant : les clients
 * avaient l'argent et la passerelle les rejetait. PawaPay couvre ces mêmes
 * opérateurs par une intégration unique.
 *
 * ── CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS ────────────────────────
 *
 * Il parle à PawaPay : initier un encaissement, en lire le statut, lister la
 * configuration active. Il ne décide RIEN sur les droits d'un client — c'est
 * `pawapay-activation.ts` qui le fait, et seulement sur un statut final lu
 * depuis l'API, jamais depuis un message reçu.
 *
 * ── SANDBOX ET PRODUCTION ─────────────────────────────────────────────────
 *
 * Rien dans ce fichier ne connaît l'environnement. Tout vient de deux
 * variables, et passer en production n'est donc qu'un changement de réglage :
 *
 *     PAWAPAY_BASE_URL    https://api.sandbox.pawapay.io  (par défaut)
 *                         https://api.pawapay.io          (production)
 *     PAWAPAY_API_TOKEN   un jeton DIFFÉRENT par environnement
 *
 * Le jeton ne doit jamais apparaître dans le code ni dans un dépôt. Il est lu
 * ici, une seule fois, et n'est jamais journalisé.
 */

import { avecDelai, DELAIS } from './delai-securite';

/** Sandbox par défaut : on ne bascule en production que volontairement. */
const BASE_PAR_DEFAUT = 'https://api.sandbox.pawapay.io';

export function baseUrl(): string {
  return (process.env.PAWAPAY_BASE_URL || BASE_PAR_DEFAUT).replace(/\/+$/, '');
}

/** Vrai quand on parle à la vraie passerelle, pas au bac à sable. */
export function estProduction(): boolean {
  return !baseUrl().includes('sandbox');
}

export function pawapayConfigure(): boolean {
  return !!process.env.PAWAPAY_API_TOKEN;
}

export function callbackUrl(): string {
  return process.env.PAWAPAY_CALLBACK_URL || 'https://profootai.com/api/pawapay/callback';
}

/** Statuts d'un encaissement. Seuls COMPLETED et FAILED sont définitifs. */
export type StatutDepot =
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'IN_RECONCILIATION'
  | 'COMPLETED'
  | 'FAILED';

export const STATUTS_FINAUX: StatutDepot[] = ['COMPLETED', 'FAILED'];

export interface DepotDemande {
  /** UUID v4, généré par nous. C'est notre clé d'idempotence. */
  depositId: string;
  montant: number;
  devise: string;
  /** Numéro au format international, sans « + » ni espaces. */
  telephone: string;
  /** Code opérateur PawaPay, ex. « MTN_MOMO_CIV ». */
  operateur: string;
  /** Notre propre référence — l'identifiant de l'intention de paiement. */
  reference?: string;
  /** Texte affiché au client sur son téléphone. 4 à 22 caractères. */
  messageClient?: string;
}

export interface ReponseDepot {
  accepte: boolean;
  statut: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED' | 'ERREUR';
  depositId: string;
  motif?: string;
  codeEchec?: string;
}

/**
 * Appel authentifié, avec délai et sans jamais laisser fuiter le jeton.
 *
 * Le jeton n'est pas journalisé, même en cas d'erreur : un message d'erreur
 * finit dans les journaux de l'hébergeur, qui ne sont pas le bon endroit pour
 * un secret.
 */
async function appeler<T>(
  chemin: string,
  options: { methode?: 'GET' | 'POST'; corps?: unknown; delaiMs?: number },
  repli: T
): Promise<T> {
  const jeton = process.env.PAWAPAY_API_TOKEN;
  if (!jeton) {
    console.error(
      '[PAWAPAY] PAWAPAY_API_TOKEN absent : aucun appel ne partira. ' +
        "Ajoutez-le dans les variables d'environnement du projet."
    );
    return repli;
  }

  const travail = (async () => {
    const r = await fetch(`${baseUrl()}${chemin}`, {
      method: options.methode ?? 'GET',
      headers: {
        Authorization: `Bearer ${jeton}`,
        Accept: 'application/json',
        ...(options.corps ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
      cache: 'no-store',
    });
    const texte = await r.text();
    let json: any = null;
    try {
      json = texte ? JSON.parse(texte) : null;
    } catch {
      /* réponse non JSON : on le signale plus bas */
    }
    if (!r.ok) {
      console.error(
        `[PAWAPAY] ${options.methode ?? 'GET'} ${chemin} → HTTP ${r.status} : ` +
          String(texte).slice(0, 300)
      );
    }
    return { http: r.status, json } as any;
  })();

  return (await avecDelai(travail, options.delaiMs ?? DELAIS.page, repli, `pawapay ${chemin}`)) as T;
}

/**
 * Initie un encaissement mobile money.
 *
 * L'ACCEPTATION N'EST PAS UN PAIEMENT. « ACCEPTED » signifie seulement que
 * PawaPay a pris la demande en charge ; le client doit encore valider sur son
 * téléphone. C'est le statut final, lu plus tard, qui fait foi — et c'est la
 * confusion entre les deux qui ouvre un accès à quelqu'un qui n'a rien payé.
 */
export async function initierDepot(d: DepotDemande): Promise<ReponseDepot> {
  const corps: Record<string, unknown> = {
    depositId: d.depositId,
    amount: String(d.montant),
    currency: d.devise,
    payer: {
      type: 'MMO',
      accountDetails: {
        phoneNumber: d.telephone.replace(/[^0-9]/g, ''),
        provider: d.operateur,
      },
    },
  };
  if (d.reference) corps.clientReferenceId = d.reference;
  // Quatre à vingt-deux caractères, sinon la demande est refusée.
  if (d.messageClient) corps.customerMessage = d.messageClient.slice(0, 22);

  const { http, json } = await appeler<any>(
    '/v2/deposits',
    { methode: 'POST', corps },
    { http: 0, json: null }
  );

  if (!json) {
    return {
      accepte: false,
      statut: 'ERREUR',
      depositId: d.depositId,
      motif: http ? `La passerelle a répondu ${http}.` : 'La passerelle n’a pas répondu.',
    };
  }

  const statut = String(json.status ?? 'ERREUR') as ReponseDepot['statut'];
  return {
    accepte: statut === 'ACCEPTED' || statut === 'DUPLICATE_IGNORED',
    statut,
    depositId: json.depositId ?? d.depositId,
    motif: json.failureReason?.failureMessage,
    codeEchec: json.failureReason?.failureCode,
  };
}

export interface StatutLu {
  trouve: boolean;
  statut?: StatutDepot;
  montant?: string;
  devise?: string;
  reference?: string;
  codeEchec?: string;
  messageEchec?: string;
  telephone?: string;
  operateur?: string;
}

/**
 * Lit le statut d'un encaissement chez PawaPay.
 *
 * C'EST LA SEULE SOURCE DE VÉRITÉ. Un message reçu sur notre adresse de rappel
 * peut être fabriqué par n'importe qui ; une réponse à cet appel est
 * authentifiée par notre propre jeton et vient forcément de PawaPay.
 */
export async function lireStatutDepot(depositId: string): Promise<StatutLu> {
  const { json } = await appeler<any>(
    `/v2/deposits/${encodeURIComponent(depositId)}`,
    {},
    { http: 0, json: null }
  );

  if (!json || json.status !== 'FOUND' || !json.data) return { trouve: false };

  const d = json.data;
  return {
    trouve: true,
    statut: d.status as StatutDepot,
    montant: d.amount,
    devise: d.currency,
    reference: d.clientReferenceId,
    codeEchec: d.failureReason?.failureCode,
    messageEchec: d.failureReason?.failureMessage,
    telephone: d.payer?.accountDetails?.phoneNumber,
    operateur: d.payer?.accountDetails?.provider,
  };
}

export interface OperateurDisponible {
  pays: string;
  operateur: string;
  devise: string;
  min?: string;
  max?: string;
  etat?: string;
}

/**
 * Les pays et opérateurs réellement ouverts sur ce compte.
 *
 * Lue depuis PawaPay plutôt qu'écrite en dur : la liste des opérateurs et leur
 * état — ouvert, ralenti, fermé — changent sans nous prévenir, et une liste
 * figée dans le code proposerait un jour un opérateur en panne.
 */
export async function operateursDisponibles(): Promise<OperateurDisponible[]> {
  const { json } = await appeler<any>('/v2/active-conf', {}, { http: 0, json: null });
  if (!json?.countries) return [];

  const sortie: OperateurDisponible[] = [];
  for (const pays of json.countries) {
    for (const p of pays.providers ?? []) {
      const depot = (p.currencies ?? []).find((c: any) =>
        (c.operationTypes ?? []).some((o: any) => o.operationType === 'DEPOSIT')
      );
      const conf = depot?.operationTypes?.find((o: any) => o.operationType === 'DEPOSIT');
      sortie.push({
        pays: pays.country,
        operateur: p.provider,
        devise: depot?.currency ?? '',
        min: conf?.minAmount,
        max: conf?.maxAmount,
        etat: conf?.status,
      });
    }
  }
  return sortie;
}
