/**
 * SUR COMBIEN DE MATCHS LE MOTEUR EST-IL AVEUGLE ? Lecture seule.
 *
 * La moitié « occasions » du calcul exige les DEUX clubs dans le relevé des
 * tirs (`butsAttendusOccasions`). Un seul absent — Sabah, un club roumain, un
 * tour préliminaire — et le moteur retombe sur les seuls buts, sans le dire.
 * C'est l'erreur Manchester United 0-3 Sabah du 10 septembre 2026.
 *
 *   npx tsx scripts/_combien-de-matchs-aveugles.mts
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS, GRANDS, COUPES_SUIVIES } from './challenger/commun.mjs';

chargerEnv();
const { forcesDepuisRencontres, butsAttendusOccasions } = await import('../src/lib/forme-occasions.js');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
rencontres.sort((a, b) => a.date.localeCompare(b.date));
const tirs: any[] = JSON.parse(fs.readFileSync(FICHIER_TIRS, 'utf8'));

const releves = new Map<string, any>();
const releveLaVeille = (jour: string) => {
  if (releves.has(jour)) return releves.get(jour);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  const liste = tirs.filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin).map((t) => ({ ...t }));
  const r = liste.length >= 100 ? forcesDepuisRencontres(liste as any, undefined, new Date(fin).toISOString()) : null;
  releves.set(jour, r);
  return r;
};

const suivies = new Set([...Object.keys(GRANDS), ...Object.keys(COUPES_SUIVIES)].map(Number));
const parCompetition = new Map<number, { n: number; aveugles: number }>();
let n = 0;
let aveugles = 0;
const clubsManquants = new Map<string, number>();

for (const m of rencontres) {
  if (!suivies.has(Number(m.ligue)) || m.date < '2026-02-15') continue;
  const jour = m.date.slice(0, 10);
  const releve = releveLaVeille(jour);
  const occ = butsAttendusOccasions(releve, m.nomDom, m.nomExt);
  n++;
  let c = parCompetition.get(Number(m.ligue));
  if (!c) { c = { n: 0, aveugles: 0 }; parCompetition.set(Number(m.ligue), c); }
  c.n++;
  if (!occ) {
    aveugles++;
    c.aveugles++;
    for (const nom of [m.nomDom, m.nomExt])
      if (!releve?.clubs?.[nom]) clubsManquants.set(nom, (clubsManquants.get(nom) ?? 0) + 1);
  }
}

const NOMS: Record<number, string> = { ...(GRANDS as any), ...(COUPES_SUIVIES as any) };
const pc = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : '—');
console.log(`Sur ${n} matchs rejoués depuis le 2026-02-15 : ${aveugles} AVEUGLES (${pc(aveugles, n)})\n`);
for (const [ligue, c] of [...parCompetition].sort((a, b) => b[1].aveugles - a[1].aveugles))
  if (c.aveugles) console.log(`  ${String(NOMS[ligue] ?? ligue).padEnd(22)} ${String(c.aveugles).padStart(3)} aveugles sur ${String(c.n).padStart(4)}  (${pc(c.aveugles, c.n)})`);
console.log(`\nLes clubs absents du relevé les plus souvent rencontrés :`);
for (const [nom, fois] of [...clubsManquants].sort((a, b) => b[1] - a[1]).slice(0, 20))
  console.log(`  ${String(fois).padStart(3)} fois  ${nom}`);
