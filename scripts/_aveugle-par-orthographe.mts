/**
 * COMBIEN DE MATCHS LE MOTEUR PERD-IL SUR UN SIMPLE ÉCART D'ORTHOGRAPHE ?
 * Lecture seule.
 *
 * Le relevé des tirs est indexé par NOM de club. `butsAttendusOccasions`
 * cherche `releve.clubs[nom]` : une majuscule, un accent, un point ou un « FC »
 * de différence, et le club est déclaré inconnu — le moteur jette alors TOUTE
 * la moitié occasions de son calcul, alors qu'il a les données sous la main.
 *
 * Ce script rejoue les matchs aveugles et regarde, pour chaque club introuvable,
 * s'il aurait été trouvé en comparant les noms SANS accents, sans ponctuation
 * et sans les mots de remplissage (FC, CF, AC, SC, club…).
 *
 *   npx tsx scripts/_aveugle-par-orthographe.mts
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS } from './challenger/commun.mjs';

chargerEnv();
const { forcesDepuisRencontres, butsAttendusOccasions } = await import('../src/lib/forme-occasions.js');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
rencontres.sort((a, b) => a.date.localeCompare(b.date));
const tirs: any[] = JSON.parse(fs.readFileSync(FICHIER_TIRS, 'utf8'));

/** Le nom réduit à ce qui compte : lettres et chiffres, sans accents ni bruit. */
const MOTS_DE_REMPLISSAGE = /\b(fc|cf|ac|sc|sk|fk|cd|sv|as|ss|ssc|afc|ufc|club|calcio|futbol|football|city|town|de|del|la|le|les|of)\b/g;
const reduire = (nom: string) =>
  String(nom)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(MOTS_DE_REMPLISSAGE, ' ')
    .replace(/\s+/g, '');

const releves = new Map<string, any>();
const releveLaVeille = (jour: string) => {
  if (releves.has(jour)) return releves.get(jour);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  const liste = tirs.filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin).map((t) => ({ ...t }));
  const r = liste.length >= 100 ? forcesDepuisRencontres(liste as any, undefined, new Date(fin).toISOString()) : null;
  releves.set(jour, r);
  return r;
};

let vus = 0;
let aveugles = 0;
let rattrapables = 0;
const exemples = new Map<string, { dans: string; fois: number }>();

for (const m of rencontres) {
  if (m.date < '2026-02-15') continue;
  const jour = m.date.slice(0, 10);
  const releve: any = releveLaVeille(jour);
  if (!releve?.clubs) continue;
  vus++;
  if (butsAttendusOccasions(releve, m.nomDom, m.nomExt)) continue;
  aveugles++;

  // Pour chaque club introuvable, un jumeau à l'orthographe près ?
  const index = new Map<string, string>();
  for (const nom of Object.keys(releve.clubs)) index.set(reduire(nom), nom);
  let tousRattrapes = true;
  const trouves: string[] = [];
  for (const nom of [m.nomDom, m.nomExt]) {
    if (releve.clubs[nom]) continue;
    const jumeau = index.get(reduire(nom));
    if (jumeau) trouves.push(`${nom} → ${jumeau}`);
    else tousRattrapes = false;
  }
  if (tousRattrapes && trouves.length) {
    rattrapables++;
    for (const t of trouves) {
      const [de, vers] = t.split(' → ');
      const e = exemples.get(de) ?? { dans: vers, fois: 0 };
      e.fois++;
      exemples.set(de, e);
    }
  }
}

const pc = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : '—');
console.log(`${vus} matchs examinés depuis le 2026-02-15 : ${aveugles} aveugles (${pc(aveugles, vus)}).`);
console.log(`Parmi eux, ${rattrapables} (${pc(rattrapables, aveugles)}) le sont sur un simple écart d'orthographe.\n`);
if (exemples.size) {
  console.log('Les noms qui ne se retrouvent pas, et leur jumeau dans le relevé :');
  for (const [de, e] of [...exemples].sort((a, b) => b[1].fois - a[1].fois).slice(0, 25))
    console.log(`  ${String(e.fois).padStart(3)} fois  ${de.slice(0, 32).padEnd(32)} → ${e.dans}`);
}
