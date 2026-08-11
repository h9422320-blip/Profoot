/**
 * D'où viennent les acheteurs.
 *
 * Cette lecture s'appuie sur notre propre trace, écrite au moment où l'acheteur
 * demande à payer — pas sur ce que le prestataire de paiement affiche. C'est
 * délibéré : pendant plusieurs jours, son tableau de ventes a indiqué
 * « États-Unis » pour tout le monde, parce qu'il géolocalisait notre serveur.
 * Une donnée qu'on ne maîtrise pas peut redevenir fausse sans prévenir.
 *
 * Le second rôle de ce module est de surveiller la détection elle-même. Le
 * défaut d'origine n'a été découvert qu'en lisant un tableau à la main ; il ne
 * doit plus jamais pouvoir passer inaperçu.
 */

import { createAdminClient } from './supabase-admin';

export interface PaysAcheteurs {
  code: string;
  /** Nom en français, obtenu du système : aucune liste à maintenir. */
  nom: string;
  drapeau: string;
  nombre: number;
  /** Part des intentions, de 0 à 100. */
  part: number;
}

export interface IntentionRecente {
  saleId: string;
  email: string | null;
  plan: string;
  pays: string | null;
  paysNom: string;
  drapeau: string;
  source: string | null;
  /** Vraie quand la vente a effectivement débouché sur un abonnement. */
  honoree: boolean;
  creeeLe: string;
}

export interface OrigineAcheteurs {
  /** Intentions portant une origine. Les plus anciennes n'en ont pas. */
  total: number;
  /** Intentions enregistrées avant que l'origine ne soit collectée. */
  sansOrigine: number;
  pays: PaysAcheteurs[];
  /** Détections obtenues autrement que par l'adresse IP — donc approchées. */
  approchees: number;
  /** Détections où aucun indice n'a fonctionné. Doit rester à zéro. */
  enEchec: number;
  recentes: IntentionRecente[];
}

/** Drapeau déduit du code ISO : deux lettres, deux symboles régionaux. */
export function drapeau(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '🌍';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((l) => 0x1f1e6 + l.charCodeAt(0) - 65)
  );
}

/**
 * Nom du pays en français. `Intl` le fournit déjà — maintenir une liste à la
 * main reviendrait à recopier une donnée que le système connaît mieux que nous.
 */
export function nomDuPays(code: string | null | undefined): string {
  if (!code) return 'Origine inconnue';
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export async function getOrigineAcheteurs(limite = 300): Promise<OrigineAcheteurs> {
  const vide: OrigineAcheteurs = {
    total: 0, sansOrigine: 0, pays: [], approchees: 0, enEchec: 0, recentes: [],
  };

  const { data, error } = await createAdminClient()
    .from('payment_intents')
    .select('sale_id, email, plan, pays, pays_source, consumed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    // La colonne n'existe pas encore : la migration n'a pas été appliquée. Ce
    // n'est pas une erreur à faire remonter comme une panne.
    console.warn('[ORIGINE] Lecture impossible :', error.message);
    return vide;
  }

  const lignes = data ?? [];
  const avecOrigine = lignes.filter((l) => l.pays);
  if (!lignes.length) return vide;

  const compte = new Map<string, number>();
  for (const l of avecOrigine) compte.set(l.pays!, (compte.get(l.pays!) ?? 0) + 1);

  return {
    total: avecOrigine.length,
    sansOrigine: lignes.length - avecOrigine.length,
    pays: [...compte.entries()]
      .map(([code, nombre]) => ({
        code,
        nom: nomDuPays(code),
        drapeau: drapeau(code),
        nombre,
        part: Math.round((nombre / avecOrigine.length) * 1000) / 10,
      }))
      .sort((a, b) => b.nombre - a.nombre),
    approchees: avecOrigine.filter((l) => l.pays_source && l.pays_source !== 'ip').length,
    enEchec: avecOrigine.filter((l) => l.pays_source === 'defaut').length,
    recentes: lignes.slice(0, 40).map((l) => ({
      saleId: l.sale_id,
      email: l.email ?? null,
      plan: l.plan,
      pays: l.pays ?? null,
      paysNom: nomDuPays(l.pays),
      drapeau: drapeau(l.pays),
      source: l.pays_source ?? null,
      honoree: !!l.consumed_at,
      creeeLe: l.created_at,
    })),
  };
}
