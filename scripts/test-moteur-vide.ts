/**
 * LE MOTEUR SORT-IL TOUJOURS LE MÊME SCORE QUAND LES DONNÉES MANQUENT ?
 *
 * Le 20 août 2026, toutes les analyses annonçaient 2-1, en moins de deux
 * secondes, sans consommer un centime chez le fournisseur d'IA. Trois signes
 * d'un moteur qui ne calcule plus rien et sert une valeur de repli.
 *
 * Ce script pose la question directement : à données vides, que répond-il ?
 * Lecture seule, aucun appel réseau.
 */
import { calculerScoreProbable } from '../src/lib/score-probable';

const montrer = (titre: string, r: any) => {
  console.log(`\n  ${titre}`);
  console.log(`     score    : ${r.buts1} - ${r.buts2}`);
  console.log(`     probas   : ${Math.round(r.probaVictoire1)}% / ${Math.round(r.probaNul)}% / ${Math.round(r.probaVictoire2)}%`);
  console.log(`     confiance: ${r.confiance}`);
};

// Les champs attendus sont des TOTAUX de saison, pas des moyennes.
const zero: any = {};
const vide: any = { butsMarques: 0, butsEncaisses: 0, matchsJoues: 0 };
const fort: any = { butsMarques: 72, butsEncaisses: 21, matchsJoues: 30 };   // 2,4 / 0,7
const faible: any = { butsMarques: 24, butsEncaisses: 63, matchsJoues: 30 }; // 0,8 / 2,1
const moyen: any = { butsMarques: 42, butsEncaisses: 39, matchsJoues: 30 };  // 1,4 / 1,3

console.log('\n  CE QUE RÉPOND LE MOTEUR SELON CE QU\'IL REÇOIT\n');

montrer('objets totalement vides       ->', calculerScoreProbable(zero, zero, true, false));
montrer('moyennes à zéro               ->', calculerScoreProbable(vide, vide, true, false));
montrer('fort (dom.) contre faible     ->', calculerScoreProbable(fort, faible, true, false));
montrer('faible (dom.) contre fort     ->', calculerScoreProbable(faible, fort, true, false));
montrer('deux équipes moyennes         ->', calculerScoreProbable(moyen, moyen, true, false));
montrer('lieu inconnu, données vides   ->', calculerScoreProbable(zero, zero, null as any, false));

console.log('\n  Si les trois premières lignes donnent le MÊME score, le repli est identifié.\n');
