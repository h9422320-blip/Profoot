/**
 * Montre, dans l'ordre réel, ce que les deux listes de la page d'analyse
 * proposent : la sélection du jour et le carrousel des grands matchs.
 *
 * Sert à vérifier de l'extérieur ce que l'abonné voit en haut de son écran,
 * sans avoir à ouvrir une session.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const { lireSelectionDuJour } = await import('../src/lib/selection-du-jour.js');
const { matchsDuJour } = await import('../src/lib/grands-matchs-du-jour.js');

const sel = await lireSelectionDuJour();
console.log('\n=== LES MATCHS LES MIEUX CERNES ===');
const liste = (sel as any)?.matchs ?? (sel as any)?.selection ?? [];
if (liste.length === 0) console.log('  (vide)');
for (const m of liste) {
  console.log(
    `  ${String(m.championnat).padEnd(26)} ${String(m.dom?.name ?? m.equipe1 ?? '').slice(0, 20).padEnd(21)} ${String(m.ext?.name ?? m.equipe2 ?? '').slice(0, 20).padEnd(21)} ${m.fiabilite} %`
  );
}

const car = await matchsDuJour();
console.log(`\n=== PROCHAINS GRANDS MATCHS (aujourd'hui : ${car.aujourdhui}) ===`);
if (car.matchs.length === 0) console.log('  (vide)');
for (const m of car.matchs) {
  console.log(
    `  ${String(m.championnat).padEnd(26)} ${String(m.dom.name).slice(0, 20).padEnd(21)} ${String(m.ext.name).slice(0, 20).padEnd(21)} ${m.fiabilite ?? '—'}`
  );
}
