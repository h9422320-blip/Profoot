/**
 * RELÈVE LES DERNIERS MATCHS DE SÉLECTIONS, RECALCULE LES NOTES ELO, ET LES
 * RANGE DANS LA RÉSERVE LUE PAR L'ANALYSE (`src/lib/forces-selections.ts`).
 *
 *   npx tsx scripts/challenger/elo-selections-publier.mts
 *
 * Lancé chaque jour par le challenger : pendant les fenêtres internationales,
 * les notes d'après la première journée de qualifications doivent être prêtes
 * avant la deuxième.
 *
 * La correspondance « écart de notes → probabilités » est apprise sur TOUS les
 * matchs connus : c'est la version de production. La mesure en marche avant,
 * elle, vit dans `elo-selections.mts`.
 */
import { chargerEnv } from './commun.mjs';
chargerEnv();
const { ramasserSelections } = await import('./selections.mjs');
const { matchsRetenus, rejouer } = await import('./elo-selections.mjs');
const { CLE_ELO_SELECTIONS } = await import('../../src/lib/forces-selections.js');
const { ecrireReserve } = await import('../../src/lib/api-football.js');

const collecte = await ramasserSelections();
const matchs = matchsRetenus();
const { note, joues, avant } = rejouer(matchs);

const tranches: Record<string, [number, number, number]> = {};
for (const m of matchs) {
  const k = String(Math.max(-12, Math.min(12, Math.round(avant.get(m.id)!.ecart / 50))));
  const r = m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2;
  tranches[k] ??= [0, 0, 0];
  tranches[k][r]++;
}

const contenu = {
  calculeLe: new Date().toISOString(),
  notes: Object.fromEntries([...note].map(([id, v]) => [String(id), Math.round(v * 10) / 10])),
  joues: Object.fromEntries([...joues].map(([id, n]) => [String(id), n])),
  tranches,
};
// Trente jours de conservation : une réserve un peu ancienne vaut mieux que rien.
await ecrireReserve(CLE_ELO_SELECTIONS, contenu, 30 * 24 * 3600 * 1000);
console.log(
  `[ELO SÉLECTIONS] ${collecte.matchs} matchs en réserve (${collecte.appels} appels) · ` +
    `${matchs.length} retenus · ${note.size} sélections notées · publié sous ${CLE_ELO_SELECTIONS}.`
);
