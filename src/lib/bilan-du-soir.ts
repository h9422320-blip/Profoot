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

/**
 * Les francs, en chiffres qu'on lit sans effort.
 *
 * L'espace est une espace ORDINAIRE, et c'est voulu : `toLocaleString`
 * emploie une espace insécable étroite, que certains téléphones affichent en
 * carré vide dans un courriel en texte simple.
 */
const fcfa = (n: number) =>
  `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F`;

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « jeudi 10 septembre 2026 » — une date qu'on lit, pas qu'on déchiffre. */
export function dateEnToutesLettres(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return jour;
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Une ligne de tableau : libellé à gauche, montant aligné à droite. */
function ligne(libelle: string, montant: string, largeur = 44): string {
  const points = Math.max(1, largeur - libelle.length - montant.length);
  return `${libelle} ${'.'.repeat(points)} ${montant}`;
}

/**
 * LE MESSAGE DU SOIR.
 *
 * ── CE QUI A ÉTÉ REFAIT, ET POURQUOI ─────────────────────────────────────
 *
 * La première version alignait « Chez MakeTou », « Prix de vente »,
 * « Commission », « Net pour vous » — quatre termes de comptable, dont trois
 * désignent presque la même somme. Le propriétaire l'a lu à voix haute et
 * s'est perdu dans ses propres chiffres.
 *
 * Sa consigne, le 10 septembre 2026 : « tu mets ça de façon professionnelle,
 * pour que quand je le donne à mon frère de cinq ans, il comprenne ».
 *
 * Donc : une seule idée par ligne, dans l'ordre où l'argent circule.
 *
 *     ce que les clients ont payé
 *   − ce que la boutique garde
 *   = ce qui vous revient
 *
 * Ces trois lignes se suivent et se vérifient à la main. Le prix de vente —
 * qui sert à payer le partenaire — vient APRÈS, dans son propre encadré, avec
 * la phrase qui dit à quoi il sert. Et le nombre à confronter au tableau de
 * bord de la boutique est désigné nommément, pour qu'aucun doute ne renaisse.
 */
export function messageBilanDuSoir(b: BilanDuSoir): { sujet: string; texte: string } {
  const L: string[] = [];
  const gardeBoutique = b.chezMaketou - b.net;
  const s = b.ventes > 1 ? 's' : '';

  L.push('═══════════════════════════════════════════');
  L.push(`  BILAN DU ${dateEnToutesLettres(b.jour).toUpperCase()}`);
  L.push('═══════════════════════════════════════════');
  L.push('');

  if (b.ventes === 0) {
    L.push('  Aucun abonnement vendu aujourd’hui.');
    L.push('');
  } else {
    L.push(`  ${b.ventes} abonnement${s} vendu${s} aujourd’hui.`);
    L.push('');
    L.push('  L’ARGENT DE LA JOURNÉE');
    L.push('');
    L.push('  ' + ligne('Vos clients ont payé', fcfa(b.chezMaketou)));
    L.push('  ' + ligne('MakeTou garde', `- ${fcfa(gardeBoutique)}`));
    L.push('  ' + '─'.repeat(46));
    L.push('  ' + ligne('IL VOUS REVIENT', fcfa(b.net)));
    L.push('');
  }

  L.push('  ─────────────────────────────────────────');
  L.push('  À COMPARER AVEC MAKETOU');
  L.push('');
  L.push(`  Ouvrez MakeTou, ligne « Revenus totaux ».`);
  L.push(`  Vous devez y lire, pour tout le mois :`);
  L.push('');
  L.push('  ' + ligne('Revenus totaux', fcfa(b.cumulChezMaketou)));
  L.push('  ' + ligne('Nombre de commandes', String(b.cumulVentes)));
  L.push('');
  L.push('  Si vous lisez autre chose, dites-le moi :');
  L.push('  c’est qu’une vente manque quelque part.');
  L.push('');

  L.push('  ─────────────────────────────────────────');
  L.push('  POUR PAYER VOTRE PARTENAIRE');
  L.push('');
  L.push('  ' + ligne('Prix de vente du jour', fcfa(b.prixDeVente)));
  L.push('  ' + ligne('Prix de vente depuis le début', fcfa(b.cumulPrixDeVente)));
  L.push('');
  L.push('  C’est le prix de vos offres, SANS les 2 %');
  L.push('  que MakeTou ajoute aux acheteurs. Cet');
  L.push('  argent-là n’est jamais entré chez vous :');
  L.push('  c’est donc sur ce montant, et pas sur');
  L.push('  l’autre, que se calcule sa commission.');
  L.push('');

  L.push('  ─────────────────────────────────────────');
  L.push('  VÉRIFICATION');
  L.push('');
  if (b.vuesAuPulse == null) {
    L.push('  ⚠ IMPOSSIBLE À VÉRIFIER CE SOIR.');
    L.push('');
    L.push('  Le journal de la boutique n’a pas pu être');
    L.push('  relu. Les chiffres ci-dessus viennent de');
    L.push('  nos comptes seuls, sans contrôle.');
  } else if (b.manquantes > 0) {
    L.push(`  ⚠ ATTENTION — ${b.manquantes} VENTE${b.manquantes > 1 ? 'S' : ''} MANQUE${b.manquantes > 1 ? 'NT' : ''}.`);
    L.push('');
    L.push(`  MakeTou a annoncé ${b.vuesAuPulse} vente${b.vuesAuPulse > 1 ? 's' : ''} aujourd’hui.`);
    L.push(`  ${b.vuesAuPulse - b.manquantes} seulement figure${b.vuesAuPulse - b.manquantes > 1 ? 'nt' : ''} dans vos comptes.`);
    L.push('');
    L.push('  Les montants ci-dessus sont donc TROP BAS.');
    L.push('  Vente' + (b.manquantes > 1 ? 's' : '') + ' concernée' + (b.manquantes > 1 ? 's' : '') + ' :');
    for (const id of b.identifiantsManquants.slice(0, 5)) L.push(`    ${id}`);
  } else {
    L.push(`  ✓ Tout est là.`);
    L.push('');
    L.push(`  MakeTou a annoncé ${b.vuesAuPulse} vente${b.vuesAuPulse > 1 ? 's' : ''} aujourd’hui,`);
    L.push(`  et les ${b.vuesAuPulse} sont dans vos comptes.`);
  }
  L.push('');
  L.push('═══════════════════════════════════════════');
  L.push('  Message automatique, envoyé chaque soir');
  L.push('  à 23 h 59.');

  const sujet =
    b.ventes === 0
      ? `ProFoot — aucune vente le ${b.jour}`
      : `ProFoot — ${b.ventes} vente${s} aujourd’hui, ${fcfa(b.net)} pour vous`;

  return { sujet, texte: L.join('\n') };
}
