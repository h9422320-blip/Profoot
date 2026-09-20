/**
 * QUI MANQUE, ET COMBIEN IL COMPTE.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Décision du propriétaire, le 20 septembre 2026 : le moteur doit progresser
 * LÀ OÙ SES ABONNÉS JOUENT — Angleterre, Espagne, Italie, Allemagne, France.
 * Or, mesuré sur la journée du 19 septembre dans ces cinq championnats, le
 * moteur a trouvé 10 vainqueurs sur 23 et les bookmakers 11 : nous sommes à
 * leur niveau, et leur niveau n'est pas dépassable avec les mêmes chiffres.
 *
 * Il faut donc une information que le calcul n'a jamais eue : QUI JOUE. Un
 * club privé de trois titulaires n'est pas le même club, et c'est très
 * exactement ce que les statistiques d'équipe ne disent pas.
 *
 * Ce fichier ramasse deux choses, sur les seuls cinq grands championnats :
 *
 *   1. les ABSENTS de chaque rencontre (`/injuries?fixture=`), disponibles
 *      dans l'historique jusqu'en 2023 — donc mesurables ;
 *   2. le POIDS de chaque joueur dans sa saison (`/players?league&season`) :
 *      minutes jouées, buts, passes, note. Sans ce poids, perdre un
 *      remplaçant compterait autant que perdre un buteur.
 *
 * Rien n'est branché sur le moteur ici. On ramasse la matière ; la mesure
 * décidera.
 */
import { chargerEnv } from './commun.mjs';
chargerEnv();
import fs from 'node:fs';
import path from 'node:path';

const DOSSIER = '.challenger';
export const FICHIER_ABSENCES = path.join(DOSSIER, 'absences.json');
export const FICHIER_JOUEURS = path.join(DOSSIER, 'joueurs.json');
const FICHIER_RENCONTRES = path.join(DOSSIER, 'rencontres.json');

/** Angleterre, Espagne, Italie, Allemagne, France. Rien d'autre. */
export const CINQ_GRANDS = new Set([39, 140, 135, 78, 61]);

const CLE = () => process.env.API_FOOTBALL_KEY ?? '';
const DE_FRONT = 6;
const PAUSE_MS = 1500;

async function lire(chemin: string, essais = 3): Promise<any | null> {
  for (let i = 1; i <= essais; i++) {
    try {
      const r = await fetch(`https://v3.football.api-sports.io/${chemin}`, {
        headers: { 'x-apisports-key': CLE() },
        signal: AbortSignal.timeout(20_000),
      });
      const j: any = await r.json();
      const erreurs = j?.errors;
      const enErreur = Array.isArray(erreurs) ? erreurs.length > 0 : !!erreurs && Object.keys(erreurs).length > 0;
      if (!enErreur) return j;
      // Limite par minute : on souffle et on recommence.
      await new Promise((t) => setTimeout(t, 20_000));
    } catch {
      await new Promise((t) => setTimeout(t, 3_000));
    }
  }
  return null;
}

/** Les absents, rencontre par rencontre. Reprend là où il s'était arrêté. */
export async function ramasserAbsences(limite = Infinity): Promise<{ faites: number; total: number }> {
  const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
  const voulues = rencontres.filter((m) => CINQ_GRANDS.has(Number(m.ligue)));
  const deja: Record<string, any[]> = fs.existsSync(FICHIER_ABSENCES)
    ? JSON.parse(fs.readFileSync(FICHIER_ABSENCES, 'utf8'))
    : {};
  const aFaire = voulues.filter((m) => !deja[String(m.id)]).slice(0, limite);
  let faites = 0;

  for (let i = 0; i < aFaire.length; i += DE_FRONT) {
    const paquet = aFaire.slice(i, i + DE_FRONT);
    const reponses = await Promise.all(paquet.map((m) => lire(`injuries?fixture=${m.id}`)));
    paquet.forEach((m, k) => {
      const r = reponses[k];
      // Une réponse absente n'est PAS un match sans blessé : on ne l'écrit pas,
      // sinon le passage suivant croirait la rencontre déjà ramassée.
      if (!r) return;
      deja[String(m.id)] = (r.response ?? []).map((x: any) => ({
        j: Number(x?.player?.id ?? 0),
        e: Number(x?.team?.id ?? 0),
        t: String(x?.player?.type ?? ''),
      }));
      faites++;
    });
    if (faites % 120 === 0 || i + DE_FRONT >= aFaire.length) {
      fs.writeFileSync(FICHIER_ABSENCES, JSON.stringify(deja));
      console.log(`[ABSENCES] ${Object.keys(deja).length} / ${voulues.length} rencontres ramassées.`);
    }
    await new Promise((t) => setTimeout(t, PAUSE_MS));
  }
  fs.writeFileSync(FICHIER_ABSENCES, JSON.stringify(deja));
  return { faites, total: voulues.length };
}

/** Le poids de chaque joueur, saison par saison : minutes, buts, note. */
export async function ramasserJoueurs(saisons = [2023, 2024, 2025, 2026]): Promise<number> {
  const deja: Record<string, any> = fs.existsSync(FICHIER_JOUEURS)
    ? JSON.parse(fs.readFileSync(FICHIER_JOUEURS, 'utf8'))
    : {};
  let ecrits = 0;
  for (const ligue of CINQ_GRANDS) {
    for (const saison of saisons) {
      if (deja[`fait:${ligue}:${saison}`]) continue;
      let page = 1, total = 1;
      while (page <= total && page <= 60) {
        const j = await lire(`players?league=${ligue}&season=${saison}&page=${page}`);
        if (!j) break;
        total = Number(j?.paging?.total ?? 1);
        for (const x of j.response ?? []) {
          const s = (x.statistics ?? []).find((y: any) => Number(y?.league?.id) === ligue) ?? x.statistics?.[0];
          if (!s) continue;
          deja[`${saison}:${x.player.id}`] = {
            e: Number(s?.team?.id ?? 0),
            min: Number(s?.games?.minutes ?? 0),
            buts: Number(s?.goals?.total ?? 0),
            passes: Number(s?.goals?.assists ?? 0),
            note: Number(s?.games?.rating ?? 0),
            poste: String(s?.games?.position ?? ''),
          };
          ecrits++;
        }
        page++;
        await new Promise((t) => setTimeout(t, 700));
      }
      deja[`fait:${ligue}:${saison}`] = true;
      fs.writeFileSync(FICHIER_JOUEURS, JSON.stringify(deja));
      console.log(`[JOUEURS] ligue ${ligue} saison ${saison} : ${ecrits} lignes au total.`);
    }
  }
  fs.writeFileSync(FICHIER_JOUEURS, JSON.stringify(deja));
  return ecrits;
}

if (process.argv[1]?.includes('absences')) {
  const quoi = process.argv[2] ?? 'tout';
  if (quoi === 'joueurs' || quoi === 'tout') await ramasserJoueurs();
  if (quoi === 'absences' || quoi === 'tout') console.log(JSON.stringify(await ramasserAbsences()));
}
