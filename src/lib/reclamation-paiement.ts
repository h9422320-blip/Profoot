/**
 * ── « J'AI PAYÉ AVEC UNE AUTRE ADRESSE » ──────────────────────────────────
 *
 * ── LE PROBLÈME, EN UNE PHRASE ────────────────────────────────────────────
 *
 * Un seul fil relie un paiement à un compte : l'adresse e-mail tapée sur la
 * boutique. Si elle diffère de celle du compte, le fil casse — l'argent est
 * encaissé, et l'abonné ne voit rien.
 *
 * C'est arrivé à un client en septembre 2026 : il a payé avec une première
 * adresse, l'accès a mis du temps à s'ouvrir, il est revenu se connecter avec
 * une SECONDE adresse, et il a conclu que son abonnement n'avait pas marché.
 * Il était bien ouvert — sur l'autre compte.
 *
 * ── POURQUOI ON NE PEUT PAS SIMPLEMENT CROIRE L'ADRESSE ANNONCÉE ─────────
 *
 * L'inscription n'exige aucune preuve de possession de l'adresse. Si l'on se
 * contentait de demander « quelle adresse as-tu utilisée ? » et d'ouvrir
 * l'accès, n'importe qui pourrait taper l'adresse d'un acheteur et lui voler
 * son abonnement. La même raison figure déjà dans
 * `api/paiement/verification` : l'e-mail seul ne suffit pas.
 *
 * ── LA PREUVE, SANS RIEN DEMANDER D'AUTRE ────────────────────────────────
 *
 * Le lien de confirmation part dans LA BOÎTE DU PAYEUR, pas ailleurs. Seul
 * quelqu'un qui relève réellement cette boîte peut cliquer. On n'a donc besoin
 * d'aucun mot de passe, d'aucune pièce justificative, d'aucune intervention
 * humaine — et personne ne peut se servir à la place d'un autre.
 *
 * ── CE QUI NE FUITE JAMAIS ───────────────────────────────────────────────
 *
 * La réponse est LA MÊME que l'adresse porte un paiement ou non. Sans cela,
 * cette page deviendrait un moyen de savoir qui est client de ProFoot : il
 * suffirait d'essayer des adresses une à une.
 *
 * ── CE QUE CE FILET NE PEUT PAS RATTRAPER ────────────────────────────────
 *
 * Une adresse mal orthographiée à la boutique — « @gmail.col » au lieu de
 * « @gmail.com », vu le 13 septembre 2026. La boîte n'existe pas : le lien de
 * confirmation ne peut arriver nulle part. Ces cas-là restent à traiter à la
 * main, et c'est assumé : aucune automatisation ne peut prouver la possession
 * d'une boîte qui n'existe pas.
 */

import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { lireReserve, ecrireReserve } from './api-football';
import { envoyerCourriel } from './courriel';
import { rattacherVentesOrphelines } from './maketou';

/** Préfixe des demandes en cours, dans la réserve partagée. */
const CLE_DEMANDE = 'reclamation-paiement:';

/** Préfixe du compteur anti-abus, par compte. */
const CLE_COMPTEUR = 'reclamation-compteur:';

/**
 * Trente minutes pour ouvrir sa boîte et cliquer.
 *
 * Assez pour aller chercher le courriel sur un autre téléphone ; assez court
 * pour qu'un lien oublié dans une boîte ne serve plus à rien des jours après.
 */
export const VALIDITE_MS = 30 * 60 * 1000;

/** Au plus cinq demandes par heure et par compte. */
export const DEMANDES_MAX = 5;
const FENETRE_COMPTEUR_MS = 60 * 60 * 1000;

/** Ce qu'on retient d'une demande, le temps qu'elle vive. */
interface Demande {
  /** Le compte qui recevra l'accès. */
  userId: string;
  /** La vente réclamée. */
  saleId: string;
  plan: string;
  /** L'adresse de paiement — celle qui reçoit le lien. */
  email: string;
  creeeLe: string;
  /** Posé à l'usage : un lien ne sert qu'une fois. */
  utiliseLe?: string;
}

const normaliser = (x: unknown) => String(x ?? '').trim().toLowerCase();

/** Une adresse plausible. Le contrôle fin appartient au fournisseur de mail. */
export function adressePlausible(email: unknown): boolean {
  const a = normaliser(email);
  return a.length >= 6 && a.length <= 254 && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(a);
}

/**
 * La vente payée que cette adresse peut réclamer, s'il y en a une.
 *
 * Trois conditions, toutes nécessaires :
 *
 *   1. la BOUTIQUE dit « completed » — on ne se fie pas à une intention de
 *      paiement créée au départ en caisse et jamais honorée ; il y en a des
 *      milliers, et aucune ne représente de l'argent entré ;
 *   2. le montant est strictement positif — un accès ouvert à la main ne se
 *      réclame pas ;
 *   3. aucun abonnement ni match débloqué ne porte déjà cet identifiant de
 *      vente — une vente déjà servie ne se sert pas deux fois.
 */
export async function venteReclamable(
  admin: SupabaseClient,
  emailPaiement: string
): Promise<{ saleId: string; plan: string; montant: number } | null> {
  const email = normaliser(emailPaiement);
  if (!adressePlausible(email)) return null;

  const { data: ventes } = await admin
    .from('payment_intents')
    .select('sale_id, plan, amount, created_at')
    .eq('email', email)
    .eq('statut_boutique', 'completed')
    .gt('amount', 0)
    .order('created_at', { ascending: false })
    .limit(20);

  const candidates = (ventes ?? []) as any[];
  if (!candidates.length) return null;

  const identifiants = candidates.map((v) => String(v.sale_id));
  const [{ data: abos }, { data: matchs }] = await Promise.all([
    admin.from('subscriptions').select('chariow_sale_id').in('chariow_sale_id', identifiants),
    admin.from('matchs_debloques').select('sale_id').in('sale_id', identifiants),
  ]);
  const servies = new Set<string>([
    ...((abos ?? []) as any[]).map((a) => String(a.chariow_sale_id)),
    ...((matchs ?? []) as any[]).map((m) => String(m.sale_id)),
  ]);

  // La plus récente d'abord : si quelqu'un a payé deux fois, c'est le dernier
  // paiement qu'il a en tête quand il réclame.
  for (const v of candidates) {
    if (servies.has(String(v.sale_id))) continue;
    if (!v.plan) continue;
    return { saleId: String(v.sale_id), plan: String(v.plan), montant: Number(v.amount) };
  }
  return null;
}

/** Le message envoyé dans la boîte du payeur. */
export function messageReclamation(lien: string, montant: number): { sujet: string; texte: string } {
  return {
    sujet: 'ProFoot AI — confirmez votre paiement pour ouvrir votre accès',
    texte:
      `Bonjour,\n\n` +
      `Quelqu'un vient de nous indiquer avoir payé ${montant} F CFA avec cette adresse, ` +
      `et demande que l'accès soit ouvert sur son compte ProFoot AI.\n\n` +
      `Si c'est bien vous, cliquez sur ce lien — votre accès s'ouvre aussitôt :\n\n` +
      `${lien}\n\n` +
      `Ce lien est valable trente minutes et ne fonctionne qu'une seule fois.\n\n` +
      `Si ce n'est PAS vous, ignorez ce message : sans ce clic, rien ne se passe et ` +
      `votre paiement reste à vous.\n\n` +
      `— L'équipe ProFoot AI\nhttps://profootai.com`,
  };
}

/** Ce que la route rend au navigateur. Volontairement toujours identique. */
export interface ResultatDemande {
  /** Vrai dès que la demande est recevable — qu'une vente existe ou non. */
  recue: boolean;
  /** Rempli seulement quand la demande est refusée d'emblée. */
  motif?: 'adresse_invalide' | 'trop_de_demandes' | 'courriel_indisponible';
}

/**
 * Ouvre une demande de rattachement et envoie le lien de confirmation.
 *
 * Rend le MÊME résultat que l'adresse porte un paiement ou non : c'est ce qui
 * empêche d'utiliser cette route pour deviner qui est client.
 */
export async function demanderRattachement(
  admin: SupabaseClient,
  userId: string,
  emailPaiement: string,
  baseUrl: string
): Promise<ResultatDemande> {
  if (!adressePlausible(emailPaiement)) return { recue: false, motif: 'adresse_invalide' };

  // ── L'ANTI-ABUS PRÉCÈDE TOUT ────────────────────────────────────────────
  //
  // Sans lui, un compte pourrait faire défiler des milliers d'adresses pour
  // découvrir lesquelles ont acheté — et arroser autant de boîtes de courriels
  // qu'elles n'ont pas demandés.
  const cleCompteur = `${CLE_COMPTEUR}${userId}`;
  const compteur = await lireReserve<{ n: number }>(cleCompteur).catch(() => null);
  const n = compteur?.contenu && !compteur.expiree ? Number(compteur.contenu.n) || 0 : 0;
  if (n >= DEMANDES_MAX) return { recue: false, motif: 'trop_de_demandes' };
  await ecrireReserve(cleCompteur, { n: n + 1 }, FENETRE_COMPTEUR_MS);

  const vente = await venteReclamable(admin, emailPaiement);

  // Aucune vente : on s'arrête ICI, sans le dire. Le compteur a déjà été
  // incrémenté — c'est justement le cas qu'il faut borner.
  if (!vente) return { recue: true };

  const jeton = randomBytes(24).toString('hex');
  const demande: Demande = {
    userId,
    saleId: vente.saleId,
    plan: vente.plan,
    email: normaliser(emailPaiement),
    creeeLe: new Date().toISOString(),
  };
  await ecrireReserve(`${CLE_DEMANDE}${jeton}`, demande, VALIDITE_MS);

  const lien = `${baseUrl.replace(/\/+$/, '')}/api/paiement/confirmer-reclamation?jeton=${jeton}`;
  const { sujet, texte } = messageReclamation(lien, vente.montant);
  const envoye = await envoyerCourriel({ a: demande.email, sujet, texte }).catch(() => false);

  if (!envoye) {
    console.error(
      `[RECLAMATION] Lien NON envoyé à ${demande.email} pour la vente ${vente.saleId}. ` +
        `Tant que ce message revient, personne ne peut rattacher un paiement fait avec une autre adresse.`
    );
    return { recue: true, motif: 'courriel_indisponible' };
  }

  console.log(`[RECLAMATION] Lien envoyé à ${demande.email} pour la vente ${vente.saleId}.`);
  return { recue: true };
}

export type IssueConfirmation =
  | { ok: true; plan: string }
  | { ok: false; raison: 'lien_inconnu' | 'lien_expire' | 'lien_deja_utilise' | 'vente_deja_servie' | 'echec' };

/**
 * Le clic dans la boîte du payeur : l'accès s'ouvre.
 *
 * Tout est revérifié — le lien vit encore, il n'a jamais servi, et la vente
 * n'a pas été servie entre-temps par une autre voie. Un lien ne fait pas foi
 * à lui seul de ce qu'il était au moment où il est parti.
 */
export async function confirmerRattachement(
  admin: SupabaseClient,
  jeton: string
): Promise<IssueConfirmation> {
  if (!/^[0-9a-f]{48}$/.test(String(jeton ?? ''))) return { ok: false, raison: 'lien_inconnu' };

  const cle = `${CLE_DEMANDE}${jeton}`;
  const garde = await lireReserve<Demande>(cle).catch(() => null);
  if (!garde?.contenu) return { ok: false, raison: 'lien_inconnu' };
  if (garde.expiree) return { ok: false, raison: 'lien_expire' };

  const demande = garde.contenu;
  if (demande.utiliseLe) return { ok: false, raison: 'lien_deja_utilise' };

  // La vente a-t-elle été servie entre l'envoi et le clic ? Le pulse peut
  // très bien être arrivé entre-temps, ou le compte avoir été rattaché à la
  // main. On ne double jamais un abonnement.
  const [{ data: abos }, { data: matchs }] = await Promise.all([
    admin.from('subscriptions').select('chariow_sale_id').eq('chariow_sale_id', demande.saleId).limit(1),
    admin.from('matchs_debloques').select('sale_id').eq('sale_id', demande.saleId).limit(1),
  ]);
  if ((abos ?? []).length || (matchs ?? []).length) {
    await ecrireReserve(cle, { ...demande, utiliseLe: new Date().toISOString() }, VALIDITE_MS);
    return { ok: false, raison: 'vente_deja_servie' };
  }

  // ── LE LIEN EST CONSOMMÉ AVANT L'OUVERTURE, ET NON APRÈS ────────────────
  //
  // Deux clics simultanés — le courriel ouvert sur le téléphone et sur
  // l'ordinateur — ouvriraient sinon deux fois le même abonnement.
  await ecrireReserve(cle, { ...demande, utiliseLe: new Date().toISOString() }, VALIDITE_MS);

  // L'accès est ouvert par la MÊME fonction que l'inscription, jamais par une
  // copie : une copie appliquerait ses propres règles de durée, qui
  // divergeraient au premier changement de tarif.
  const r = await rattacherVentesOrphelines(admin, demande.userId, demande.email, [
    { sale_id: demande.saleId, plan: demande.plan },
  ]);

  if (!r?.ouvert) {
    // L'ouverture a échoué : le lien est rendu, sinon le payeur reste sans
    // accès ET sans moyen de recommencer.
    await ecrireReserve(cle, { ...demande, utiliseLe: undefined }, VALIDITE_MS);
    console.error(`[RECLAMATION] Ouverture refusée pour la vente ${demande.saleId} — lien rendu.`);
    return { ok: false, raison: 'echec' };
  }

  console.warn(
    `[RECLAMATION] Vente ${demande.saleId} rattachée au compte ${demande.userId} ` +
      `après confirmation par ${demande.email}.`
  );
  return { ok: true, plan: demande.plan };
}
