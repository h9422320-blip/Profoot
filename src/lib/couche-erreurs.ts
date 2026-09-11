/**
 * LA COUCHE DES ERREURS APPRISES : LE MOTEUR TIRE LES LEÇONS DE SES PROPRES MATCHS.
 *
 * ── CE QU'ELLE SAIT, ET QUE PERSONNE D'AUTRE NE SAIT ──────────────────────
 *
 * Chaque pronostic de ProFoot est confronté au résultat réel. Pour un club,
 * on peut donc mesurer ce qu'aucune source extérieure ne donne : l'écart
 * moyen entre les buts que CE moteur lui annonçait et les buts qu'il a
 * réellement marqués et encaissés. Un club que le moteur sous-estime
 * régulièrement en attaque, ou dont il surestime la défense, le sera encore
 * demain si rien ne change.
 *
 * ── CE QU'ELLE FAIT ───────────────────────────────────────────────────────
 *
 * Elle rend deux corrections, en buts, que `calculerScoreProbable` ajoute aux
 * buts attendus APRÈS tout le calcul existant. Elle ne remplace rien : c'est
 * une couche posée par-dessus, décision du propriétaire du 11 septembre 2026
 * — on ajoute, on ne modifie jamais un réglage existant.
 *
 * ── LA PRUDENCE ───────────────────────────────────────────────────────────
 *
 * Un écart mesuré sur trois matchs est surtout du hasard. La leçon de chaque
 * club est donc modérée par le nombre de matchs qui l'ont enseignée —
 * `n / (n + retrecissement)` —, puis pondérée. Et le moteur borne toute
 * correction à un demi-but.
 *
 * Fonctions pures : ni réseau, ni base. La même sert au banc d'essai, qui
 * rejoue le passé, et à la production.
 */

export type JugementPourCouche = {
  /** Identifiant du club qui reçoit. */
  dom: string;
  /** Identifiant du club qui se déplace. */
  ext: string;
  /** Buts attendus annoncés par le moteur, pour chacun. */
  attenduDom: number;
  attenduExt: number;
  /** Buts réellement marqués. */
  reelDom: number;
  reelExt: number;
};

export type ErreurClub = {
  /** Matchs jugés qui l'ont enseignée. */
  n: number;
  /** Buts marqués moins buts annoncés, en moyenne. */
  attaque: number;
  /** Buts encaissés moins buts annoncés contre lui, en moyenne. */
  defense: number;
};

export type ReglageCouche = {
  /** Combien de matchs il faut pour qu'une leçon pèse à moitié. */
  retrecissement: number;
  /** Part de la leçon réellement appliquée. */
  poids: number;
};

const cle = (id: string | number) => String(id ?? '').trim().toLowerCase();

/** Ce que les matchs jugés enseignent sur chaque club. */
export function apprendreErreurs(jugements: JugementPourCouche[]): Map<string, ErreurClub> {
  const sommes = new Map<string, { n: number; att: number; def: number }>();
  const ajouter = (club: string, att: number, def: number) => {
    const k = cle(club);
    if (!k) return;
    const s = sommes.get(k) ?? { n: 0, att: 0, def: 0 };
    s.n++;
    s.att += att;
    s.def += def;
    sommes.set(k, s);
  };
  for (const j of jugements) {
    if (![j.attenduDom, j.attenduExt, j.reelDom, j.reelExt].every((v) => Number.isFinite(Number(v)))) continue;
    ajouter(j.dom, j.reelDom - j.attenduDom, j.reelExt - j.attenduExt);
    ajouter(j.ext, j.reelExt - j.attenduExt, j.reelDom - j.attenduDom);
  }
  const out = new Map<string, ErreurClub>();
  for (const [k, s] of sommes) out.set(k, { n: s.n, attaque: s.att / s.n, defense: s.def / s.n });
  return out;
}

/**
 * Les deux corrections, en buts, pour une rencontre — ou `null` quand le
 * moteur n'a jamais jugé aucun des deux clubs : alors il ne change rien.
 */
export function correctionPour(
  clubs: Map<string, ErreurClub> | null | undefined,
  dom: string | number,
  ext: string | number,
  reglage: ReglageCouche
): { domicile: number; exterieur: number } | null {
  if (!clubs) return null;
  const a = clubs.get(cle(dom));
  const b = clubs.get(cle(ext));
  if (!a && !b) return null;
  const confiance = (e?: ErreurClub) => (e ? e.n / (e.n + reglage.retrecissement) : 0);
  const moyenne = (termes: number[]) => (termes.length ? termes.reduce((x, y) => x + y, 0) / termes.length : 0);
  // Les buts du club qui reçoit : ce que le moteur rate sur son attaque, et
  // ce qu'il rate sur la défense de l'adversaire. Et inversement.
  const dDom = moyenne([...(a ? [confiance(a) * a.attaque] : []), ...(b ? [confiance(b) * b.defense] : [])]);
  const dExt = moyenne([...(b ? [confiance(b) * b.attaque] : []), ...(a ? [confiance(a) * a.defense] : [])]);
  return { domicile: reglage.poids * dDom, exterieur: reglage.poids * dExt };
}
