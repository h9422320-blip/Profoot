/**
 * LE MARCHÉ LE PLUS PRÉCIS : LE HANDICAP ASIATIQUE.
 *
 * ── POURQUOI ALLER LE CHERCHER ───────────────────────────────────────────
 *
 * Le moteur lit aujourd'hui la cote 1N2. C'est le marché le plus connu, mais
 * pas le plus fin : sur le handicap asiatique circule beaucoup plus d'argent,
 * la marge du bookmaker y est deux fois plus faible, et la ligne bouge au
 * dixième de but. Deux chiffres y suffisent à décrire une rencontre :
 *
 *   • la SUPRÉMATIE — de combien de buts une équipe domine l'autre,
 *   • le TOTAL — combien de buts se marqueront en tout (« plus/moins de 2,5 »).
 *
 * De ces deux chiffres on déduit les buts attendus de chaque camp, donc la
 * grille complète des scores, donc les probabilités 1N2 — au lieu de faire le
 * chemin inverse en partant du 1N2, qui écrase l'information.
 *
 * Ce fichier ne fait que RAMASSER : il rattache à chaque rencontre du banc la
 * ligne de handicap et ses cotes moyennes, depuis les mêmes fichiers publics
 * que les cotes 1N2 (football-data.co.uk, colonnes AHh / AvgAHH / AvgAHA).
 *
 *   npx tsx scripts/challenger/cotes-asiatiques.mts
 */
import { chargerEnv } from './commun.mjs';
chargerEnv();
import fs from 'node:fs';
import path from 'node:path';

const DOSSIER = '.challenger';
const DOSSIER_CSV = path.join(DOSSIER, 'cotes-historiques');
export const FICHIER_ASIATIQUES = path.join(DOSSIER, 'cotes-asiatiques.json');
const FICHIER_RENCONTRES = path.join(DOSSIER, 'rencontres.json');

/** Les codes de football-data, comme dans `cotes-historiques.mts`. */
const LIGUE_DE: Record<string, number> = {
  E0: 39, SP1: 140, I1: 135, D1: 78, F1: 61, P1: 94, N1: 88,
  E1: 40, SC0: 179, D2: 79, I2: 136, SP2: 141, F2: 62, B1: 144, T1: 203, G1: 197,
};

export interface CoteAsiatique {
  /** La ligne, du point de vue de l'équipe qui reçoit (négatif = favorite). */
  ligne: number;
  /** Cote moyenne sur l'équipe qui reçoit, handicap appliqué. */
  dom: number;
  /** Cote moyenne sur l'équipe qui se déplace. */
  ext: number;
}

const simple = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function proche(a: unknown, b: unknown): number {
  const x = simple(a), y = simple(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return 10;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
}

function lireCsv(fichier: string): Record<string, string>[] {
  const texte = fs.readFileSync(fichier, 'utf8').replace(/^﻿/, '');
  const lignes = texte.split(/\r?\n/).filter(Boolean);
  const entetes = lignes[0].split(',');
  return lignes.slice(1).map((l) => {
    const champs = l.split(',');
    const o: Record<string, string> = {};
    entetes.forEach((e, i) => (o[e] = champs[i]));
    return o;
  });
}

export function rattacherCotesAsiatiques(): { lignes: number; rattachees: number } {
  const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
  const parCle = new Map<string, any[]>();
  for (const m of rencontres) {
    const cle = `${m.ligue}|${String(m.date).slice(0, 10)}|${m.bd}-${m.be}`;
    const l = parCle.get(cle);
    if (l) l.push(m);
    else parCle.set(cle, [m]);
  }

  const sortie: Record<string, CoteAsiatique> = {};
  let lignes = 0;
  for (const f of fs.readdirSync(DOSSIER_CSV).filter((x) => x.endsWith('.csv'))) {
    const ligue = LIGUE_DE[f.replace(/^\d+-/, '').replace('.csv', '')];
    if (!ligue) continue;
    for (const r of lireCsv(path.join(DOSSIER_CSV, f))) {
      if (!r.Date || !r.HomeTeam) continue;
      lignes++;
      const ligne = Number(r.AHh);
      const dom = Number(r.AvgAHH);
      const ext = Number(r.AvgAHA);
      if (!Number.isFinite(ligne) || !(dom > 1) || !(ext > 1)) continue;

      const [j, mo, a] = r.Date.split('/');
      const annee = a.length === 2 ? `20${a}` : a;
      const date = `${annee}-${mo.padStart(2, '0')}-${j.padStart(2, '0')}`;
      const candidats = [0, 1, -1]
        .map((dj) => new Date(Date.parse(date) + dj * 86_400_000).toISOString().slice(0, 10))
        .flatMap((jour) => parCle.get(`${ligue}|${jour}|${r.FTHG}-${r.FTAG}`) ?? []);
      if (!candidats.length) continue;
      const meilleur = candidats
        .map((c) => ({ c, note: proche(c.nomDom, r.HomeTeam) + proche(c.nomExt, r.AwayTeam) }))
        .sort((x, y) => y.note - x.note)[0];
      if (meilleur.note < 4) continue;
      sortie[String(meilleur.c.id)] = { ligne, dom, ext };
    }
  }

  fs.writeFileSync(FICHIER_ASIATIQUES, JSON.stringify(sortie));
  return { lignes, rattachees: Object.keys(sortie).length };
}

if (process.argv[1]?.includes('cotes-asiatiques')) console.log(JSON.stringify(rattacherCotesAsiatiques()));
