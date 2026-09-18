/**
 * LES COTES D'AVANT-MATCH DES SAISONS PASSÉES, RATTACHÉES À NOS RENCONTRES.
 *
 * Source : football-data.co.uk (fichiers CSV publics, téléchargés avec l'accord
 * du propriétaire le 18 septembre 2026, rangés dans `.challenger/cotes-historiques`).
 * On retient la MOYENNE des bookmakers relevée AVANT le match (colonnes
 * AvgH/AvgD/AvgA) — jamais la cote de clôture, qui contient déjà les
 * compositions et l'argent de dernière minute, et que la production ne peut
 * pas connaître quand elle relève la veille à minuit.
 *
 * Rattachement : même championnat, même date, même score, puis le nom le plus
 * proche. Les deux sources n'écrivent pas les clubs pareil (« Man United » /
 * « Manchester United »), mais un même jour et un même score ne laissent
 * presque jamais deux candidats.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DOSSIER, FICHIER_RENCONTRES } from './commun.mjs';

const DOSSIER_CSV = path.join(DOSSIER, 'cotes-historiques');
export const FICHIER_COTES_HISTORIQUES = path.join(DOSSIER, 'cotes-historiques.json');

const LIGUE_DE: Record<string, number> = {
  // Les sept grands championnats (téléchargés le 18 septembre 2026).
  E0: 39, SP1: 140, I1: 135, D1: 78, F1: 61, P1: 94, N1: 88,
  // Neuf championnats de plus (même jour, accord du propriétaire) :
  // Championship, Écosse, 2. Bundesliga, Serie B, Segunda División, Ligue 2,
  // Belgique, Turquie, Grèce.
  E1: 40, SC0: 179, D2: 79, I2: 136, SP2: 141, F2: 62, B1: 144, T1: 203, G1: 197,
};

const simple = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Proximité de deux noms de clubs : longueur du plus long préfixe commun, ou inclusion. */
const proche = (a: string, b: string) => {
  const x = simple(a), y = simple(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return 10;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
};

function lireCsv(fichier: string): Record<string, string>[] {
  const texte = fs.readFileSync(fichier, 'utf8').replace(/^﻿/, '');
  const lignes = texte.split(/\r?\n/).filter(Boolean);
  const entete = lignes[0].split(',');
  return lignes.slice(1).map((l) => {
    const v = l.split(',');
    const o: Record<string, string> = {};
    entete.forEach((c, i) => (o[c] = v[i]));
    return o;
  });
}

export function rattacherCotesHistoriques(): { lignes: number; rattachees: number } {
  const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
  const parCle = new Map<string, any[]>();
  for (const m of rencontres) {
    const cle = `${m.ligue}|${String(m.date).slice(0, 10)}|${m.bd}-${m.be}`;
    const l = parCle.get(cle);
    if (l) l.push(m);
    else parCle.set(cle, [m]);
  }
  const sortie: Record<string, { dom: number; nul: number; ext: number }> = {};
  let lignes = 0;
  for (const f of fs.readdirSync(DOSSIER_CSV).filter((x) => x.endsWith('.csv'))) {
    const code = f.replace(/^\d+-/, '').replace('.csv', '');
    const ligue = LIGUE_DE[code];
    if (!ligue) continue;
    for (const r of lireCsv(path.join(DOSSIER_CSV, f))) {
      if (!r.Date || !r.HomeTeam) continue;
      lignes++;
      const [j, m, a] = r.Date.split('/');
      const annee = a.length === 2 ? `20${a}` : a;
      const date = `${annee}-${m.padStart(2, '0')}-${j.padStart(2, '0')}`;
      const h = Number(r.AvgH), d = Number(r.AvgD), e = Number(r.AvgA);
      if (!(h > 1 && d > 1 && e > 1)) continue;
      // Un match joué tard peut être daté du lendemain en temps universel.
      const candidats = [date, new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10), new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10)]
        .flatMap((jour) => parCle.get(`${ligue}|${jour}|${r.FTHG}-${r.FTAG}`) ?? []);
      if (!candidats.length) continue;
      const meilleur = candidats
        .map((c) => ({ c, note: proche(c.nomDom, r.HomeTeam) + proche(c.nomExt, r.AwayTeam) }))
        .sort((x, y) => y.note - x.note)[0];
      if (meilleur.note < 4) continue;
      // Probabilités implicites, marge retirée.
      const s = 1 / h + 1 / d + 1 / e;
      sortie[String(meilleur.c.id)] = { dom: 1 / h / s, nul: 1 / d / s, ext: 1 / e / s };
    }
  }
  fs.writeFileSync(FICHIER_COTES_HISTORIQUES, JSON.stringify(sortie));
  return { lignes, rattachees: Object.keys(sortie).length };
}

if (process.argv[1]?.includes('cotes-historiques')) {
  console.log(JSON.stringify(rattacherCotesHistoriques()));
}
