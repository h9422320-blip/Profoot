/**
 * QUI SONT LES RENCONTRES OÙ LE MOTEUR N'A RIEN.
 *
 * ── LE CREUX, MESURÉ LE 15 SEPTEMBRE 2026 SUR LE BANC ALIGNÉ ──────────────
 *
 *     tirs + forces ajustées      3 833 rencontres   50,6 % justes
 *     forces seules              13 400 rencontres   50,3 %
 *     NI TIRS NI FORCES             796 rencontres   46,6 %
 *
 * Et le pire n'est pas là : sur ces 796, le moteur en met 266 EN AVANT — un
 * tiers, contre un cinquième ailleurs — pour 49,6 % de justesse, quand il tient
 * 68 % partout ailleurs. Il est au MAXIMUM de sa confiance au MINIMUM de sa
 * fiabilité.
 *
 * Première tentative : donner plus de voix à la mémoire des clubs. Elle n'a
 * touché que QUATORZE rencontres — sur ce creux, la mémoire est muette elle
 * aussi. Ces matchs n'ont donc rien du tout.
 *
 * Ce relevé dit ce qu'ils SONT, avant d'inventer quoi que ce soit : quelles
 * compétitions, quand dans la collecte, et ce que le moteur savait des clubs.
 *
 * ── VERDICT DU 15 SEPTEMBRE 2026 : CE CREUX N EXISTE PAS EN PRODUCTION ────
 *
 * Ce relevé a répondu, et la réponse est ailleurs que là où je cherchais.
 *
 * Ces 796 rencontres sont des OUVERTURES DE SAISON : 432 rien qu en août 2025,
 * le reste en février et mars pour les championnats à saison civile (Irlande,
 * Scandinavie). Sur 796, 690 ont moins de TROIS rencontres jouées par le club
 * le moins connu des deux.
 *
 * Et si `calculerForces` refuse de se prononcer, ce n est pas un défaut du
 * moteur : il exige cinquante rencontres dans la SAISON PRÉCÉDENTE du
 * championnat. La production les demande au fournisseur et les obtient. Le
 * banc, lui, ne collecte que depuis le 14 février 2025 : AUCUNE saison 2024
 * n y figure, pour aucun championnat.
 *
 * Le banc décrit donc, une sixième fois, un moteur plus faible que le vrai —
 * et précisément sur les journées d ouverture, là où `forces-equipes.ts` a été
 * écrit pour aider. Une couche bâtie ici comblerait un trou imaginaire.
 *
 * CE QU IL FAUDRAIT POUR LE COMBLER : collecter la saison précédente chez le
 * fournisseur. Tant que ce n est pas fait, toute mesure du banc sur les deux
 * ou trois premières journées d un championnat est à prendre pour ce qu elle
 * est — pessimiste.
 *
 *   npx tsx scripts/_le-creux-du-moteur.mts <resultat.json>
 */
import fs from 'node:fs';
import { GRANDS, COUPES_SUIVIES, TIRS_EN_PLUS, FICHIER_RENCONTRES } from './challenger/commun.mjs';
import type { Pronostic } from './challenger/porte.js';

const res: {
  variantes: Record<string, Pronostic[]>;
  contexte?: Record<string, [number, number, number, number]>;
} = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const champ = res.variantes.champion;
if (!champ?.length || !res.contexte) {
  console.log('résultat sans moteur de référence ou sans contexte.');
  process.exit(1);
}
const ctx = res.contexte;

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const parId = new Map(rencontres.map((m) => [String(m.id), m]));
const NOMS: Record<number, string> = { ...GRANDS, ...COUPES_SUIVIES, ...TIRS_EN_PLUS } as any;
const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');

const creux = champ.filter((p) => {
  const c = ctx[String(p.id)];
  return c && c[0] === 0 && c[1] === 0;
});

console.log(`\nRENCONTRES SANS TIRS NI FORCES AJUSTÉES : ${creux.length}\n`);

const compter = <T extends string | number>(cle: (p: Pronostic) => T) => {
  const m = new Map<T, { n: number; justes: number }>();
  for (const p of creux) {
    const k = cle(p);
    const x = m.get(k) ?? { n: 0, justes: 0 };
    x.n++;
    if (p.parScore === p.reel) x.justes++;
    m.set(k, x);
  }
  return [...m].sort((a, b) => b[1].n - a[1].n);
};

const avecMemoire = creux.filter((p) => ctx[String(p.id)][2] === 1).length;
console.log(`la mémoire des clubs parle sur ${avecMemoire} d'entre elles (${pc(avecMemoire, creux.length)})\n`);

console.log('PAR COMPÉTITION');
for (const [ligue, x] of compter((p) => Number(p.ligue)).slice(0, 12))
  console.log(`  ${(NOMS[ligue] ?? `compétition ${ligue}`).padEnd(30)} ${String(x.n).padStart(5)}   ${pc(x.justes, x.n)}`);

console.log('\nPAR MOIS');
for (const [mois, x] of compter((p) => p.date.slice(0, 7)).slice(0, 10))
  console.log(`  ${mois}   ${String(x.n).padStart(5)}   ${pc(x.justes, x.n)}`);

console.log('\nCE QUE LE MOTEUR SAVAIT DES DEUX CLUBS (le moins vu des deux)');
for (const [tranche, x] of compter((p) => {
  const j = ctx[String(p.id)][3];
  return j <= 2 ? 'moins de 3 rencontres' : j <= 5 ? '3 à 5' : j <= 10 ? '6 à 10' : 'plus de 10';
}))
  console.log(`  ${tranche.padEnd(24)} ${String(x.n).padStart(5)}   ${pc(x.justes, x.n)}`);

console.log('\nUNE POIGNÉE D’EXEMPLES');
for (const p of creux.slice(0, 8)) {
  const m = parId.get(String(p.id));
  console.log(
    `  ${p.date.slice(0, 10)}  ${String(m?.nomDom ?? '?').padEnd(22)} ${String(m?.nomExt ?? '?').padEnd(22)} ` +
      `saison ${m?.saison ?? '?'}  ${NOMS[Number(p.ligue)] ?? 'compétition ' + p.ligue}`
  );
}
console.log('');
