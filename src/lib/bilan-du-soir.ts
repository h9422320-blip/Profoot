/**
 * LE CHIFFRE DE LA JOURNÉE, TOUS LES SOIRS, SANS AVOIR À LE DEMANDER.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────
 *
 * Demande du propriétaire, le 10 septembre 2026 : « je veux que ça soit une
 * habitude, je veux que ça soit un programme, tous les jours à partir de
 * vingt-trois heures cinquante-neuf, tu me dis aujourd'hui vous avez fait tel
 * chiffre d'affaires, sans rien oublier, et que la page admin soit à jour et
 * cohérente en fonction des chiffres de MakeTou ».
 *
 * ── LES TROIS NOMBRES, ET POURQUOI ILS DIFFÈRENT TOUS LES TROIS ──────────
 *
 * Une même journée s'écrit de trois façons, et les confondre a fait douter le
 * propriétaire de ses propres écrans devant l'influenceur qu'il rémunère :
 *
 *   CHEZ MAKETOU     ce que l'acheteur a payé — le prix plus 2 %. C'est le
 *                    nombre lisible sur leur tableau de bord, et le seul qui
 *                    puisse se comparer à l'œil.
 *   PRIX DE VENTE    ce que le projet a vendu. C'est la base de la commission
 *                    du partenaire : les 2 % de la boutique ne sont jamais
 *                    entrés dans la caisse.
 *   NET              le prix de vente moins la commission du vendeur. C'est
 *                    le « solde en attente » de la boutique.
 *
 * ── LA VÉRIFICATION QUI ACCOMPAGNE LE CHIFFRE ────────────────────────────
 *
 * Un bilan qui se contente de recopier la base ne prouve rien : si une vente
 * n'y est jamais entrée, il l'ignorera aussi sereinement que la page. Le
 * journal du pulse garde les cent derniers messages reçus de la boutique ; on
 * compte donc les ventes qu'il annonce pour la journée et on les confronte à
 * ce que la base a retenu. Un écart est écrit en toutes lettres.
 *
 * C'est exactement ce qui manquait le 9 septembre : une vente réglée 2 500 F
 * depuis le Cameroun a été refusée par le contrôle de montant, n'a été
 * inscrite nulle part, et l'écart n'a été découvert que le lendemain, par le
 * propriétaire, sur le tableau de bord de la boutique.
 */

import {
  recettesParJour,
  surcoutAcheteurMaketou,
  tauxMaketou,
  totalMaketou,
  type RecettesParJour,
} from './recettes-boutique';
import { DERNIER_JOUR_CHARIOW } from './recettes-histoire';
import { lireReserve } from './api-football';

/** Clé du journal du pulse — la même que celle de la route. */
const CLE_JOURNAL = 'maketou:pulse:recus';

export interface BilanDuSoir {
  jour: string;
  ventes: number;
  chezMaketou: number;
  prixDeVente: number;
  commission: number;
  net: number;
  /** Depuis l'ouverture de MakeTou. */
  cumulVentes: number;
  cumulChezMaketou: number;
  cumulPrixDeVente: number;
  cumulNet: number;
  /** Ce que le journal du pulse a vu passer ce jour-là, ou `null` s'il est illisible. */
  vuesAuPulse: number | null;
  /** Ventes annoncées par la boutique et absentes de la base, ce jour-là. */
  manquantes: number;
  /** Les identifiants de ces ventes, pour pouvoir les retrouver. */
  identifiantsManquants: string[];
}

/** Le jour courant, dans le même repère que tout le reste du projet. */
export function jourDuBilan(quand: Date = new Date()): string {
  return quand.toISOString().slice(0, 10);
}

/**
 * Ce que le journal du pulse a vu ce jour-là, et ce qui manque à la base.
 *
 * Ne lève jamais : un journal illisible rend `null`, et le bilan le dit au
 * lieu d'affirmer qu'il n'y a rien à signaler.
 */
async function confronterAuPulse(
  jour: string,
  saleIdsEnBase: Set<string>
): Promise<{ vues: number | null; manquantes: string[] }> {
  try {
    const journal = (await lireReserve<any[]>(CLE_JOURNAL))?.contenu;
    if (!Array.isArray(journal)) return { vues: null, manquantes: [] };

    const duJour = journal.filter(
      (e: any) =>
        e?.evenement === 'SUCCESSFUL_SALE' &&
        e?.identifie === true &&
        String(e?.recuLe ?? '').slice(0, 10) === jour &&
        e?.vente
    );

    // Un même message peut arriver deux fois : on compte des VENTES, pas des
    // messages.
    const identifiants = [...new Set(duJour.map((e: any) => String(e.vente)))];
    return {
      vues: identifiants.length,
      manquantes: identifiants.filter((id) => !saleIdsEnBase.has(id)),
    };
  } catch {
    return { vues: null, manquantes: [] };
  }
}

/** Le bilan d'une journée, prêt à être lu par un humain. */
export async function bilanDuSoir(jour = jourDuBilan()): Promise<BilanDuSoir> {
  const parJour: RecettesParJour = (await recettesParJour()) ?? {};
  const p = parJour[jour] ?? { xof: 0, ventes: 0, fraisXof: 0 };

  const prixDeVente = Math.round(p.xof);
  const commission = Math.round(p.fraisXof ?? 0);

  const mt = totalMaketou(parJour);

  // Les identifiants de vente enregistrés pour ce jour, pour la confrontation.
  const saleIds = new Set<string>();
  try {
    const { createAdminClient } = await import('./supabase-admin');
    const admin = createAdminClient();
    for (let de = 0; de < 20000; de += 1000) {
      const { data } = await admin
        .from('payment_intents')
        .select('sale_id, created_at')
        .gte('created_at', `${jour}T00:00:00Z`)
        .lte('created_at', `${jour}T23:59:59.999Z`)
        .range(de, de + 999);
      for (const v of data ?? []) saleIds.add(String(v.sale_id));
      if (!data || data.length < 1000) break;
    }
  } catch {
    // Base illisible : la confrontation ne se fera pas, et le bilan le dira.
  }

  const { vues, manquantes } = await confronterAuPulse(jour, saleIds);

  return {
    jour,
    ventes: p.ventes,
    chezMaketou: prixDeVente + surcoutAcheteurMaketou(prixDeVente),
    prixDeVente,
    commission,
    net: prixDeVente - commission,
    cumulVentes: mt.ventes,
    cumulChezMaketou: mt.xof + surcoutAcheteurMaketou(mt.xof),
    cumulPrixDeVente: mt.xof,
    cumulNet: mt.xof - mt.fraisXof,
    vuesAuPulse: vues,
    manquantes: manquantes.length,
    identifiantsManquants: manquantes,
  };
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

/** Le message du soir, en français, lisible sur un téléphone. */
export function messageBilanDuSoir(b: BilanDuSoir): { sujet: string; texte: string } {
  const lignes: string[] = [];

  lignes.push(`Journée du ${b.jour}`);
  lignes.push('');
  lignes.push(`${b.ventes} vente${b.ventes > 1 ? 's' : ''} aujourd'hui.`);
  lignes.push('');
  lignes.push(`Chez MakeTou      ${fcfa(b.chezMaketou)}`);
  lignes.push(`Prix de vente     ${fcfa(b.prixDeVente)}`);
  lignes.push(`Commission ${Math.round(tauxMaketou() * 100)} %     -${fcfa(b.commission)}`);
  lignes.push(`Net pour vous     ${fcfa(b.net)}`);
  lignes.push('');
  lignes.push('« Chez MakeTou » est le nombre exact lisible sur leur tableau');
  lignes.push('de bord : le prix plus les 2 % ajoutés aux acheteurs, qui ne');
  lignes.push('vous ont jamais appartenu. La commission du partenaire se');
  lignes.push('calcule sur le prix de vente.');
  lignes.push('');
  lignes.push('— DEPUIS L\'OUVERTURE DE MAKETOU —');
  lignes.push(`${b.cumulVentes} ventes`);
  lignes.push(`Chez MakeTou      ${fcfa(b.cumulChezMaketou)}`);
  lignes.push(`Prix de vente     ${fcfa(b.cumulPrixDeVente)}`);
  lignes.push(`Net               ${fcfa(b.cumulNet)}`);
  lignes.push('');

  // ── LA PARTIE QUI COMPTE VRAIMENT ────────────────────────────────────────
  if (b.vuesAuPulse == null) {
    lignes.push('VÉRIFICATION IMPOSSIBLE : le journal de la boutique n\'a pas pu');
    lignes.push('être relu. Les chiffres ci-dessus viennent de la base seule.');
  } else if (b.manquantes > 0) {
    lignes.push(`ATTENTION : ${b.manquantes} vente${b.manquantes > 1 ? 's' : ''} annoncée${b.manquantes > 1 ? 's' : ''} par la boutique`);
    lignes.push('ne figure' + (b.manquantes > 1 ? 'nt' : '') + ' pas dans les comptes.');
    for (const id of b.identifiantsManquants.slice(0, 5)) lignes.push(`  ${id}`);
    lignes.push('');
    lignes.push('Le total ci-dessus est donc SOUS-ÉVALUÉ.');
  } else {
    lignes.push(`Vérifié : les ${b.vuesAuPulse} vente${b.vuesAuPulse > 1 ? 's' : ''} annoncée${b.vuesAuPulse > 1 ? 's' : ''} par la boutique`);
    lignes.push('aujourd\'hui figure' + (b.vuesAuPulse > 1 ? 'nt' : '') + ' bien dans les comptes.');
  }

  return {
    sujet: `ProFoot — ${b.ventes} vente${b.ventes > 1 ? 's' : ''}, ${fcfa(b.chezMaketou)} chez MakeTou (${b.jour})`,
    texte: lignes.join('\n'),
  };
}
