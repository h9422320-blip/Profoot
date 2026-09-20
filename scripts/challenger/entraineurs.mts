/**
 * DEPUIS QUAND L'ENTRAÎNEUR EST-IL LÀ ?
 *
 * ── POURQUOI CETTE MATIÈRE ───────────────────────────────────────────────
 *
 * Un club qui change d'entraîneur change de visage, et les statistiques des
 * dix dernières rencontres décrivent alors quelqu'un d'autre. Le moteur, lui,
 * ne voit que les chiffres : il continue de juger l'équipe de l'ancien.
 *
 * C'est une information disponible LONGTEMPS avant le coup d'envoi — ce qui
 * compte, puisqu'un pronostic se fige vingt-quatre heures avant le match. Les
 * compositions, elles, tombent une heure avant : inutilisables sous cette
 * règle.
 *
 * Cent vingt et un clubs pour les cinq grands championnats, un appel chacun.
 *
 *   npx tsx scripts/challenger/entraineurs.mts
 */
import { chargerEnv } from './commun.mjs';
chargerEnv();
import fs from 'node:fs';
import path from 'node:path';

const DOSSIER = '.challenger';
export const FICHIER_ENTRAINEURS = path.join(DOSSIER, 'entraineurs.json');
const FICHIER_RENCONTRES = path.join(DOSSIER, 'rencontres.json');
const CINQ_GRANDS = new Set([39, 140, 135, 78, 61]);
const DEBUT_UTILE = '2024-07-01';

/** Par club : chaque passage d'entraîneur, du plus ancien au plus récent. */
export interface PassageEntraineur {
  nom: string;
  debut: string;
  fin: string | null;
}

async function lire(chemin: string, essais = 3): Promise<any | null> {
  for (let i = 1; i <= essais; i++) {
    try {
      const r = await fetch(`https://v3.football.api-sports.io/${chemin}`, {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY ?? '' },
        signal: AbortSignal.timeout(15_000),
      });
      const j: any = await r.json();
      const e = j?.errors;
      const enErreur = Array.isArray(e) ? e.length > 0 : !!e && Object.keys(e).length > 0;
      if (!enErreur) return j;
      await new Promise((t) => setTimeout(t, 15_000));
    } catch {
      await new Promise((t) => setTimeout(t, 2_000));
    }
  }
  return null;
}

export async function ramasserEntraineurs(): Promise<{ clubs: number; passages: number }> {
  const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
  const clubs = new Set<number>();
  for (const m of rencontres) {
    if (!CINQ_GRANDS.has(Number(m.ligue)) || String(m.date) < DEBUT_UTILE) continue;
    clubs.add(Number(m.dom));
    clubs.add(Number(m.ext));
  }

  const deja: Record<string, PassageEntraineur[]> = fs.existsSync(FICHIER_ENTRAINEURS)
    ? JSON.parse(fs.readFileSync(FICHIER_ENTRAINEURS, 'utf8'))
    : {};
  let passages = 0;
  const liste = [...clubs].filter((c) => !deja[String(c)]);

  for (let i = 0; i < liste.length; i += 6) {
    const paquet = liste.slice(i, i + 6);
    const reponses = await Promise.all(paquet.map((c) => lire(`coachs?team=${c}`)));
    paquet.forEach((club, k) => {
      const r = reponses[k];
      if (!r) return;
      const pour: PassageEntraineur[] = [];
      for (const c of r.response ?? []) {
        for (const x of c.career ?? []) {
          if (Number(x?.team?.id) !== club || !x?.start) continue;
          pour.push({ nom: String(c?.name ?? ''), debut: String(x.start), fin: x?.end ? String(x.end) : null });
        }
      }
      pour.sort((a, b) => a.debut.localeCompare(b.debut));
      deja[String(club)] = pour;
      passages += pour.length;
    });
    fs.writeFileSync(FICHIER_ENTRAINEURS, JSON.stringify(deja));
    console.log(`[ENTRAÎNEURS] ${Object.keys(deja).length} / ${clubs.size} clubs.`);
  }
  return { clubs: Object.keys(deja).length, passages };
}

if (process.argv[1]?.includes('entraineurs')) console.log(JSON.stringify(await ramasserEntraineurs()));
