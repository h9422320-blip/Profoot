/**
 * L'INDEX SUR `cache_api(cle)` EST-IL BIEN LÀ ? Lecture seule.
 *
 * Le serveur ne livre pas son plan d'exécution et la clé REST ne permet pas
 * d'interroger `pg_indexes`. On compare donc, sous la MÊME charge, des
 * lectures par `cle` et des lectures par `ecrit_le` — une colonne dont on sait
 * qu'elle n'est pas indexée. Avec un index sur `cle`, l'écart doit être franc.
 *
 *   npx tsx scripts/_vitesse-reserve.mts
 */
import { chargerEnv } from './challenger/commun.mjs';

chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data: echantillon } = await sb.from('cache_api').select('cle, ecrit_le').limit(40);
const lignes = (echantillon ?? []) as any[];
if (lignes.length < 10) throw new Error('échantillon trop maigre');

const chrono = async (quoi: 'cle' | 'ecrit_le') => {
  const temps: number[] = [];
  for (const l of lignes.slice(0, 10)) {
    const t0 = Date.now();
    await sb.from('cache_api').select('cle').eq(quoi, l[quoi]).limit(1);
    temps.push(Date.now() - t0);
  }
  temps.sort((a, b) => a - b);
  return { mediane: temps[5], min: temps[0], max: temps[9] };
};

// Alternées, pour que la charge du moment pèse pareil sur les deux.
const parCle = await chrono('cle');
const parDate = await chrono('ecrit_le');
const parCle2 = await chrono('cle');

console.log(`par « cle »      : médiane ${parCle.mediane} ms (puis ${parCle2.mediane} ms), de ${parCle.min} à ${parCle.max} ms`);
console.log(`par « ecrit_le » : médiane ${parDate.mediane} ms, de ${parDate.min} à ${parDate.max} ms   ← colonne SANS index`);

// ── CE QUE CETTE MESURE PEUT ET NE PEUT PAS DIRE ─────────────────────────
//
// Constaté le 12 septembre 2026 : `cache_api` ne compte que 23 359 lignes.
// À cette taille, la base parcourt la table en quelques millisecondes, et
// l'aller-retour réseau (environ 140 ms depuis Abidjan) écrase tout le reste.
// Les deux colonnes répondent donc pareil, avec ou sans index : cette mesure
// ne PROUVE pas l'absence d'index, et l'index n'était pas la cause des
// lectures lentes. Ce qu'elle sait dire, c'est si une lecture dépasse le
// garde-temps de 1,5 s de `lireReserve` — ce qui arrive sous la charge de
// notre propre relevé des cotes (83 fois le 12 septembre à 12 h 21), et
// jamais au repos.
const lentes = [parCle, parCle2, parDate].filter((x) => x.max > 1500).length;
console.log(
  lentes
    ? `
AU MOINS UNE LECTURE A DÉPASSÉ 1,5 s : la réserve rend « rien » et la demande repart chez le fournisseur.`
    : `
Aucune lecture au-dessus du garde-temps de 1,5 s : la réserve répond. (Table de 23 359 lignes : cette mesure ne dit RIEN de la présence d'un index, voir le commentaire ci-dessus.)`
);
