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

// Les onze autres championnats où le marché est branché : Championship,
// Écosse, 2. Bundesliga, Serie B, Segunda, Ligue 2, Belgique, Turquie, Grèce,
// Pays-Bas, Portugal. Ramasser leur matière permettra d'y étendre les deux
// couches mesurées sur les cinq grands.
export const AUTRES_DU_MARCHE = new Set([40, 179, 79, 136, 141, 62, 144, 203, 197, 88, 94]);
const LIGUES = () => (process.env.BANC_LIGUES === 'autres' ? AUTRES_DU_MARCHE : CINQ_GRANDS);

const CLE = () => process.env.API_FOOTBALL_KEY ?? '';
const DE_FRONT = 12;
const PAUSE_MS = 400;

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

/**
 * Les absents de toutes les rencontres, championnat par championnat.
 *
 * UNE SEULE DEMANDE PAR CHAMPIONNAT ET PAR SAISON : le fournisseur rend les
 * trois mille absences de la saison d'un coup, chacune portant le numéro de sa
 * rencontre. Ramasser match par match coûtait 3 700 demandes et des heures ;
 * ici il en faut quinze.
 */
export async function ramasserAbsences(_limite = Infinity): Promise<{ faites: number; total: number }> {
  const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
  // Le banc d'essai ne juge que depuis le 1er août 2024 : ramasser 2023 coûte
  // des appels pour des rencontres que personne ne mesurera.
  const DEBUT_UTILE = '2024-07-01';
  const voulues = rencontres.filter(
    (m) => LIGUES().has(Number(m.ligue)) && String(m.date) >= DEBUT_UTILE
  );
  const aRamasser = new Set(voulues.map((m) => Number(m.id)));
  const saisons = [...new Set(voulues.map((m) => Number(m.saison)))].sort();
  const deja: Record<string, { j: number; e: number; t: string }[]> = fs.existsSync(FICHIER_ABSENCES)
    ? JSON.parse(fs.readFileSync(FICHIER_ABSENCES, 'utf8'))
    : {};

  let faites = 0;
  for (const ligue of LIGUES()) {
    for (const saison of saisons) {
      const j = await lire(`injuries?league=${ligue}&season=${saison}`);
      if (!j) {
        console.warn(`[ABSENCES] ligue ${ligue} saison ${saison} : illisible, on réessaiera.`);
        continue;
      }
      // Une rencontre citée par le fournisseur a ses absents ; une rencontre
      // jamais citée n'en avait aucun — on l'écrit vide, pour ne pas la
      // redemander indéfiniment.
      const parMatch = new Map<number, { j: number; e: number; t: string }[]>();
      for (const x of j.response ?? []) {
        const id = Number(x?.fixture?.id ?? 0);
        if (!aRamasser.has(id)) continue;
        const liste = parMatch.get(id) ?? [];
        liste.push({ j: Number(x?.player?.id ?? 0), e: Number(x?.team?.id ?? 0), t: String(x?.player?.type ?? '') });
        parMatch.set(id, liste);
      }
      for (const m of voulues) {
        if (Number(m.ligue) !== ligue || Number(m.saison) !== saison) continue;
        deja[String(m.id)] = parMatch.get(Number(m.id)) ?? [];
        faites++;
      }
      fs.writeFileSync(FICHIER_ABSENCES, JSON.stringify(deja));
      console.log(
        `[ABSENCES] ligue ${ligue} saison ${saison} : ${j.results} absences, ${parMatch.size} rencontres concernées.`
      );
      await new Promise((t) => setTimeout(t, 1500));
    }
  }
  return { faites, total: voulues.length };
}

/** Le poids de chaque joueur, saison par saison : minutes, buts, note. */
export async function ramasserJoueurs(saisons = [2023, 2024, 2025, 2026]): Promise<number> {
  const deja: Record<string, any> = fs.existsSync(FICHIER_JOUEURS)
    ? JSON.parse(fs.readFileSync(FICHIER_JOUEURS, 'utf8'))
    : {};
  let ecrits = 0;
  for (const ligue of LIGUES()) {
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
  const limite = Number(process.argv[3] ?? Infinity);
  if (quoi === 'absences' || quoi === 'tout') console.log(JSON.stringify(await ramasserAbsences(limite)));
}
