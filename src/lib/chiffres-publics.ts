/**
 * LES CHIFFRES QUE LA PAGE D'ACCUEIL A LE DROIT D'ANNONCER.
 *
 * ── CE QU'ELLE ANNONÇAIT AVANT ────────────────────────────────────────────
 *
 *     500K+   MATCHS ANALYSÉS
 *
 * La base en contenait 21 140. Le chiffre était faux d'un facteur vingt-quatre,
 * et il était écrit en gros sur la page d'entrée du site.
 *
 * Ce n'est pas un détail de communication. Le 1er septembre 2026, on a retiré
 * du mur des preuves seize cartes annonçant des matchs joués avant que
 * l'application n'existe — dont un Liverpool — Barcelone de 2019 présenté comme
 * « score exact annoncé avant le match ». Le même jour, la page d'accueil
 * inventait un demi-million d'analyses et faisait parler huit clients qui
 * n'existent pas.
 *
 * Un visiteur qui prend une seule de ces exagérations en défaut cesse de croire
 * tout le reste — y compris ce qui est vrai, et il y en a.
 *
 * ── POURQUOI ON COMPTE DES MATCHS ET NON DES LIGNES ───────────────────────
 *
 * Le même match est analysé des dizaines de fois par des gens différents. En
 * comptant les lignes :
 *
 *     18 831 vérifiées → 68 % d'issues correctes, 18,5 % de scores exacts
 *
 * En comptant les rencontres DISTINCTES :
 *
 *      1 995 vérifiées → 56 % d'issues correctes, 14,0 % de scores exacts
 *
 * L'écart n'est pas du bruit : les rencontres populaires sont analysées le plus
 * souvent, et ce sont aussi les plus faciles à prévoir — un grand favori à
 * domicile. Compter les lignes revient donc à compter plusieurs fois les matchs
 * qu'on devine, et une seule fois ceux qui résistent.
 *
 * 68 % serait le chiffre flatteur. 56 % est le chiffre vrai — et il reste
 * remarquable : le hasard donne 33 % sur une issue à trois portes.
 *
 * ── POURQUOI CE CALCUL DORT VINGT-QUATRE HEURES ───────────────────────────
 *
 * Il lit l'historique entier pour dédoublonner. La page d'accueil se
 * reconstruit toutes les quinze minutes et reçoit tous les nouveaux visiteurs :
 * refaire ce calcul à chaque fois coûterait plus cher que tout le reste du
 * site. Un taux de réussite ne bouge pas d'un point en une journée.
 *
 * La réserve périmée est SERVIE QUAND MÊME, et le recalcul est déclenché
 * derrière. Un chiffre d'hier vaut infiniment mieux qu'une page qui attend
 * quinze secondes — ou qui n'affiche rien.
 */

import { lireReserve, ecrireReserve } from './api-football';
import { createAdminClient } from './supabase-admin';

const CLE = 'chiffres-publics-v1';

/** Un jour. Le taux de réussite d'un moteur ne se déplace pas en une matinée. */
const DUREE_MS = 24 * 60 * 60 * 1000;

export interface ChiffresPublics {
  /** Rencontres analysées, doublons retirés. */
  matchsAnalyses: number;
  /** Parmi elles, celles dont le résultat est tombé et a été confronté. */
  matchsVerifies: number;
  /** Part des vérifiées où le vainqueur annoncé était le bon, en pourcentage. */
  tauxIssue: number;
  /** Part des vérifiées où le score exact est tombé pile, en pourcentage. */
  tauxScoreExact: number;
  /** Compétitions distinctes couvertes. */
  competitions: number;
}

/**
 * Ce qu'on affiche si la base ne répond pas.
 *
 * Ces valeurs sont un relevé réel du 1er septembre 2026, pas une invention. Une
 * page d'accueil qui n'affiche aucun chiffre vaut mieux qu'une page qui en
 * affiche un faux — mais un chiffre vrai devenu vieux vaut mieux que les deux.
 */
const DERNIER_RELEVE: ChiffresPublics = {
  matchsAnalyses: 21140,
  matchsVerifies: 1995,
  tauxIssue: 56,
  tauxScoreExact: 14,
  competitions: 15,
};

/** Clé de dédoublonnage : deux équipes, un jour. L'ordre des équipes ne compte pas. */
function cleRencontre(a: {
  team1_name: string | null;
  team2_name: string | null;
  created_at: string | null;
}): string {
  const equipes = [String(a.team1_name ?? ''), String(a.team2_name ?? '')].sort();
  return `${equipes[0]}|${equipes[1]}|${String(a.created_at ?? '').slice(0, 10)}`;
}

async function calculer(): Promise<ChiffresPublics> {
  const sb = createAdminClient();

  // ── LA LECTURE EST PAGINÉE, SANS EXCEPTION ──────────────────────────────
  //
  // Supabase rend mille lignes et s'arrête, sans le dire. Une lecture naïve
  // aurait mesuré le taux de réussite sur les mille analyses les plus
  // anciennes — celles de juillet, quand le moteur n'était pas réglé.
  const lignes: {
    team1_name: string | null;
    team2_name: string | null;
    competition: string | null;
    created_at: string | null;
    verified_at: string | null;
    winner_correct: boolean | null;
    score_correct: boolean | null;
  }[] = [];

  for (let depart = 0; depart < 200_000; depart += 1000) {
    const { data, error } = await sb
      .from('analysis_history')
      .select('team1_name, team2_name, competition, created_at, verified_at, winner_correct, score_correct')
      .range(depart, depart + 999);
    if (error) throw new Error(error.message);
    lignes.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const rencontres = new Map<string, (typeof lignes)[number]>();
  const competitions = new Set<string>();

  for (const l of lignes) {
    competitions.add(String(l.competition ?? '').trim().toLowerCase());
    const cle = cleRencontre(l);
    const connue = rencontres.get(cle);
    // Entre deux analyses de la même rencontre, on garde celle qui a été
    // vérifiée : c'est la seule qui apporte une information au taux.
    if (!connue || (!connue.verified_at && l.verified_at)) rencontres.set(cle, l);
  }
  competitions.delete('');

  const toutes = [...rencontres.values()];
  const verifiees = toutes.filter((r) => r.verified_at);
  const bonnes = verifiees.filter((r) => r.winner_correct).length;
  const exacts = verifiees.filter((r) => r.score_correct).length;

  // Un taux calculé sur rien n'est pas zéro : il n'existe pas. On rend le
  // dernier relevé connu plutôt qu'un « 0 % de réussite » catastrophique.
  if (!verifiees.length) return { ...DERNIER_RELEVE, matchsAnalyses: toutes.length };

  return {
    matchsAnalyses: toutes.length,
    matchsVerifies: verifiees.length,
    tauxIssue: Math.round((100 * bonnes) / verifiees.length),
    tauxScoreExact: Math.round((100 * exacts) / verifiees.length),
    competitions: competitions.size,
  };
}

/**
 * Les chiffres à afficher, jamais périmés de plus d'un jour, jamais faux.
 *
 * Ne lève pas : la page d'accueil ne doit pas tomber parce qu'une statistique
 * n'a pas pu être calculée.
 */
export async function chiffresPublics(): Promise<ChiffresPublics> {
  try {
    const reserve = await lireReserve<ChiffresPublics>(CLE);

    // ── UNE RÉSERVE PÉRIMÉE EST SERVIE, PUIS RAFRAÎCHIE DERRIÈRE ──────────
    //
    // Faire attendre le visiteur pendant qu'on relit vingt et un mille lignes
    // reviendrait à punir celui qui arrive au mauvais moment. Il reçoit le
    // chiffre d'hier, qui est le même à un point près.
    if (reserve && !reserve.expiree) return reserve.contenu;

    if (reserve?.contenu) {
      void calculer()
        .then((frais) => ecrireReserve(CLE, frais, DUREE_MS))
        .catch(() => {});
      return reserve.contenu;
    }

    const frais = await calculer();
    await ecrireReserve(CLE, frais, DUREE_MS);
    return frais;
  } catch (e) {
    console.warn('[CHIFFRES] Calcul impossible, dernier relevé servi :', (e as Error)?.message);
    return DERNIER_RELEVE;
  }
}
