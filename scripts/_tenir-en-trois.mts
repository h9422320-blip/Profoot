/**
 * UNE COUCHE QUI GAGNE TIENT-ELLE EN TROIS MORCEAUX ?
 *
 * ── POURQUOI CE RELEVÉ EXISTE ─────────────────────────────────────────────
 *
 * La porte exige plus de vainqueurs justes dans les DEUX moitiés. Sous l'effet
 * du hasard seul, une couche sans aucun effet a environ une chance sur quatre
 * de réussir ce test. Sur une couche qui ne touche que quelques centaines de
 * rencontres, cela ne suffit pas à conclure.
 *
 * Constaté le 14 septembre 2026 sur `memoire-releve-mince` : elle passe la
 * porte à seuil 10 et 12, échoue à 14 et 16, repasse à 20. Un vrai effet ne se
 * comporte pas ainsi — il forme un plateau, comme l'élan et le terrain.
 *
 * Ce relevé découpe en TROIS tranches de temps égales et demande que la couche
 * gagne dans chacune. C'est une exigence plus dure que la porte, et elle ne
 * remplace pas la porte : elle sert à départager un signal d'un coup de chance
 * AVANT d'envisager une mise en ligne.
 *
 *   npx tsx scripts/_tenir-en-trois.mts <resultat.json>
 */
import fs from 'node:fs';
import type { Pronostic } from './challenger/porte.js';

const res: { variantes: Record<string, Pronostic[]>; actifs?: Record<string, number[]> } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);
const champ = res.variantes.champion;
if (!champ?.length) {
  console.log('aucun moteur de référence dans ce résultat');
  process.exit(1);
}

const parDate = (l: Pronostic[]) => [...l].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
const justes = (l: Pronostic[]) => l.filter((p) => p.parScore === p.reel).length;

console.log('\n  essai                              tranche 1   tranche 2   tranche 3   total   tient');
for (const [nom, liste] of Object.entries(res.variantes)) {
  if (nom === 'champion') continue;
  const ids = res.actifs?.[nom];
  const garde = ids ? new Set(ids.map(Number)) : null;
  const a = parDate(garde ? champ.filter((p) => garde.has(Number(p.id))) : champ);
  const b = parDate(garde ? liste.filter((p) => garde.has(Number(p.id))) : liste);
  if (a.length !== b.length || !a.length) continue;

  const t = Math.floor(a.length / 3);
  const ecarts: number[] = [];
  for (let i = 0; i < 3; i++) {
    const de = i * t;
    const a_ = i === 2 ? a.length : de + t;
    ecarts.push(justes(b.slice(de, a_)) - justes(a.slice(de, a_)));
  }
  const total = ecarts.reduce((x, y) => x + y, 0);
  const tient = ecarts.every((e) => e > 0);
  console.log(
    `  ${nom.padEnd(34)} ` +
      ecarts.map((e) => `${e >= 0 ? '+' : ''}${e}`.padStart(9)).join('   ') +
      `   ${total >= 0 ? '+' : ''}${String(total).padStart(4)}   ${tient ? 'OUI' : 'non'}`
  );
}
console.log('');
