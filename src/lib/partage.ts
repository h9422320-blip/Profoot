/**
 * LE PARTAGE D'UN MOIS — UN SEUL ENDROIT, UN SEUL CALCUL.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Le montant dû au partenaire s'affichait à trois endroits — la liste, sa
 * fiche, le bandeau du mois en cours — et chacun refaisait la soustraction.
 * Le 20 septembre 2026, deux de ces endroits annonçaient des chiffres
 * différents pour le même mois : 56 472 francs d'écart, sur la carte de la
 * personne qu'on paie. Un écart entre deux lignes d'une même page ne
 * s'explique pas, il se soupçonne.
 *
 * Le calcul vit donc ICI, une seule fois, et les pages ne font que l'afficher.
 *
 * ── LA RÈGLE, TELLE QUE LE PROPRIÉTAIRE L'A POSÉE (26 SEPTEMBRE 2026) ─────
 *
 *     bénéfice = chiffre d'affaires − commission de la boutique − dépenses
 *     part du partenaire = bénéfice × son pourcentage
 *
 * Son exemple, qui sert d'épreuve : 2 000 000 de recettes, 200 000 de
 * dépenses, donc 1 800 000 de bénéfice. Rien d'autre à comprendre, et c'est
 * exactement ce que le partenaire doit pouvoir refaire de tête.
 *
 * ── LES ARRONDIS ──────────────────────────────────────────────────────────
 *
 * Le franc CFA n'a pas de centime : tout est arrondi au franc, une seule fois,
 * au moment de la part. Et ce qui reste au fondateur est calculé PAR
 * SOUSTRACTION du montant versé — jamais par un second pourcentage, sinon les
 * deux parts ne totalisent plus le bénéfice, à un franc près, et ce franc
 * manquant se voit.
 */

export interface EntreesDuMois {
  /** Recettes encaissées dans le mois, en francs CFA. */
  recettesXof: number;
  /** Ce que la boutique a prélevé (MakeTou, Chariow avant elle). */
  fraisBoutiqueXof?: number;
  /** Ce que l'entreprise a dépensé pour tourner : hébergement, modèles, base. */
  depensesXof?: number;
  /** La part convenue avec le partenaire, en pourcentage du bénéfice. */
  partPct: number;
}

export interface PartageDuMois {
  recettesXof: number;
  fraisBoutiqueXof: number;
  depensesXof: number;
  /** Ce qui reste une fois la boutique ET les dépenses payées. Jamais négatif. */
  beneficeXof: number;
  partPct: number;
  /** Ce qui est dû au partenaire pour ce mois. */
  duPartenaireXof: number;
  /** Ce qui reste au fondateur, par soustraction. */
  restantFondateurXof: number;
}

const entier = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/**
 * Le partage d'un mois. Fonction pure : mêmes entrées, mêmes sorties, aucune
 * lecture de base — c'est ce qui la rend vérifiable par une épreuve.
 */
export function partagerLeMois(e: EntreesDuMois): PartageDuMois {
  const recettesXof = entier(e.recettesXof);
  const fraisBoutiqueXof = entier(e.fraisBoutiqueXof);
  const depensesXof = entier(e.depensesXof);

  // Jamais en dessous de zéro : un mois qui coûte plus qu'il ne rapporte ne
  // doit pas produire une part négative à réclamer au partenaire.
  const beneficeXof = Math.max(0, recettesXof - fraisBoutiqueXof - depensesXof);

  // Un pourcentage hors de [0, 100] est une faute de saisie, pas une consigne.
  const brut = Number(e.partPct);
  const partPct = Number.isFinite(brut) ? Math.min(100, Math.max(0, brut)) : 0;

  const duPartenaireXof = Math.round((beneficeXof * partPct) / 100);
  return {
    recettesXof,
    fraisBoutiqueXof,
    depensesXof,
    beneficeXof,
    partPct,
    duPartenaireXof,
    restantFondateurXof: beneficeXof - duPartenaireXof,
  };
}

/**
 * Le dernier jour du mois, celui où le partage se fait.
 *
 * Demande du propriétaire : « à la fin de chaque mois, le 30 ou le 31 selon le
 * mois ». On le calcule au lieu de le supposer — février existe.
 */
export function dernierJourDuMois(mois: string): string {
  const [an, m] = String(mois).split('-').map(Number);
  if (!an || !m) return mois;
  const fin = new Date(Date.UTC(an, m, 0));
  return fin.toISOString().slice(0, 10);
}

/**
 * Le mois est-il clos, donc payable ?
 *
 * Un mois en cours peut encore monter : son montant est une estimation, pas
 * une dette. Le dire évite la question « pourquoi le chiffre a changé ? ».
 */
export function moisClos(mois: string, aujourdhui = new Date()): boolean {
  return String(mois) < aujourdhui.toISOString().slice(0, 7);
}
