/**
 * QUI COMMENCE LE MATCH.
 *
 * ── POURQUOI, APRÈS LES ABSENTS ──────────────────────────────────────────
 *
 * Les blessés et suspendus ont rapporté douze vainqueurs justes sur 3 553
 * rencontres (voir `src/lib/forces-absences.ts`). Mais ils ne disent pas tout :
 * un titulaire au repos avant un déplacement en coupe n'est ni blessé ni
 * suspendu, et il manque quand même. Le onze de départ, lui, le dit.
 *
 * Il dit aussi quelque chose que NOS COTES ne savent pas : elles sont relevées
 * la veille, la composition tombe une heure avant le coup d'envoi.
 *
 * Ce fichier ne fait que ramasser la matière, pour les cinq grands
 * championnats et depuis le 1er août 2024 — la fenêtre que le banc d'essai
 * juge. La mesure décidera.
 *
 *   npx tsx scripts/challenger/compositions.mts [combien]
 */
import { chargerEnv } from './commun.mjs';
chargerEnv();
import fs from 'node:fs';
import path from 'node:path';

const DOSSIER = '.challenger';
export const FICHIER_COMPOSITIONS = path.join(DOSSIER, 'compositions.json');
const FICHIER_RENCONTRES = path.join(DOSSIER, 'rencontres.json');

/** Angleterre, Espagne, Italie, Allemagne, France. */
const CINQ_GRANDS = new Set([39, 140, 135, 78, 61]);
const DEBUT_UTILE = '2024-07-01';
const DE_FRONT = 12;

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

/** Les onze de départ de chaque rencontre. Reprend là où il s'était arrêté. */
export async function ramasserCompositions(limite = Infinity): Promise<{ faites: number; total: number }> {
  const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
  const voulues = rencontres
    .filter((m) => CINQ_GRANDS.has(Number(m.ligue)) && String(m.date) >= DEBUT_UTILE)
    .sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const deja: Record<string, { dom: number[]; ext: number[] }> = fs.existsSync(FICHIER_COMPOSITIONS)
    ? JSON.parse(fs.readFileSync(FICHIER_COMPOSITIONS, 'utf8'))
    : {};
  const aFaire = voulues.filter((m) => !deja[String(m.id)]).slice(0, limite);
  const debut = Date.now();
  let faites = 0;

  for (let i = 0; i < aFaire.length; i += DE_FRONT) {
    const paquet = aFaire.slice(i, i + DE_FRONT);
    const reponses = await Promise.all(paquet.map((m) => lire(`fixtures/lineups?fixture=${m.id}`)));
    paquet.forEach((m, k) => {
      const r = reponses[k];
      if (!r) return;
      const onze = (equipe: number) => {
        const e = (r.response ?? []).find((x: any) => Number(x?.team?.id) === equipe);
        return (e?.startXI ?? []).map((x: any) => Number(x?.player?.id ?? 0)).filter(Boolean);
      };
      deja[String(m.id)] = { dom: onze(Number(m.dom)), ext: onze(Number(m.ext)) };
      faites++;
    });
    if (i % (DE_FRONT * 10) === 0 || i + DE_FRONT >= aFaire.length) {
      fs.writeFileSync(FICHIER_COMPOSITIONS, JSON.stringify(deja));
      const parMinute = Math.round((60_000 * faites) / Math.max(1, Date.now() - debut));
      console.log(`[COMPOSITIONS] ${Object.keys(deja).length} / ${voulues.length} · ${parMinute} par minute.`);
    }
  }
  fs.writeFileSync(FICHIER_COMPOSITIONS, JSON.stringify(deja));
  return { faites, total: voulues.length };
}

if (process.argv[1]?.includes('compositions')) {
  console.log(JSON.stringify(await ramasserCompositions(Number(process.argv[2] ?? Infinity))));
}
