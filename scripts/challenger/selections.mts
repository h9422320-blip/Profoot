/**
 * TOUS LES MATCHS INTERNATIONAUX DES SÉLECTIONS NATIONALES, DEPUIS 2014.
 *
 * Demande du propriétaire, le 21 septembre 2026, pendant la trêve : « essaye
 * de connaître toutes les équipes — les équipes nationales, européennes,
 * africaines, américaines, tout ». Le moteur jugeait une sélection sur ses
 * statistiques DANS la compétition en cours ; à la première journée d'une
 * qualification, il n'y en a aucune.
 *
 * Ce ramasseur relève, compétition par compétition et saison par saison, tous
 * les matchs TERMINÉS des sélections A : Coupe du monde, Euro, CAN, Copa
 * América, Coupe d'Asie, Gold Cup, Nations League, toutes les qualifications,
 * les coupes régionales et les matchs amicaux. Un appel par saison de
 * compétition, rangé dans `.challenger/selections.json`.
 *
 *   npx tsx scripts/challenger/selections.mts
 *
 * Reprend là où il s'est arrêté : une saison déjà relevée n'est pas redemandée,
 * sauf la saison en cours, qui continue de se jouer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chargerEnv, DOSSIER } from './commun.mjs';
chargerEnv();

const FICHIER = path.join(DOSSIER, 'selections.json');
const cle = process.env.API_FOOTBALL_KEY!;

/**
 * Les compétitions de sélections A, relevées le 21 septembre 2026 par
 * `selections-ligues.mts` sur le catalogue du fournisseur. Écartées à dessein :
 * les compétitions de clubs qui portent un nom continental (CONCACAF League,
 * Coupe intercontinentale), les féminines, les jeunes, le football à sept.
 *
 * `importance` sert au classement Elo : un match de Coupe du monde en dit plus
 * sur le niveau d'une sélection qu'un match amical, où l'on fait tourner.
 */
export const COMPETITIONS_DE_SELECTIONS: { id: number; nom: string; importance: number; phaseFinale: boolean }[] = [
  { id: 1, nom: 'Coupe du monde', importance: 60, phaseFinale: true },
  { id: 4, nom: 'Euro', importance: 50, phaseFinale: true },
  { id: 6, nom: 'CAN', importance: 50, phaseFinale: true },
  { id: 7, nom: "Coupe d'Asie", importance: 50, phaseFinale: true },
  { id: 9, nom: 'Copa América', importance: 50, phaseFinale: true },
  { id: 22, nom: 'Gold Cup', importance: 50, phaseFinale: true },
  { id: 21, nom: 'Coupe des confédérations', importance: 50, phaseFinale: true },
  { id: 913, nom: 'Finalissima', importance: 50, phaseFinale: true },
  { id: 806, nom: "Coupe d'Océanie", importance: 40, phaseFinale: true },
  { id: 29, nom: 'Qualifications Mondial Afrique', importance: 40, phaseFinale: false },
  { id: 30, nom: 'Qualifications Mondial Asie', importance: 40, phaseFinale: false },
  { id: 31, nom: 'Qualifications Mondial CONCACAF', importance: 40, phaseFinale: false },
  { id: 32, nom: 'Qualifications Mondial Europe', importance: 40, phaseFinale: false },
  { id: 33, nom: 'Qualifications Mondial Océanie', importance: 40, phaseFinale: false },
  { id: 34, nom: 'Qualifications Mondial Amérique du Sud', importance: 40, phaseFinale: false },
  { id: 37, nom: 'Barrages intercontinentaux', importance: 40, phaseFinale: true },
  { id: 36, nom: 'Qualifications CAN', importance: 40, phaseFinale: false },
  { id: 35, nom: "Qualifications Coupe d'Asie", importance: 40, phaseFinale: false },
  { id: 960, nom: 'Qualifications Euro', importance: 40, phaseFinale: false },
  { id: 858, nom: 'Qualifications Gold Cup', importance: 40, phaseFinale: false },
  { id: 5, nom: 'Ligue des nations UEFA', importance: 40, phaseFinale: false },
  { id: 536, nom: 'Ligue des nations CONCACAF', importance: 40, phaseFinale: false },
  { id: 808, nom: 'Qualifications Ligue des nations CONCACAF', importance: 30, phaseFinale: false },
  { id: 19, nom: 'CHAN', importance: 30, phaseFinale: true },
  { id: 1163, nom: 'Qualifications CHAN', importance: 30, phaseFinale: false },
  { id: 25, nom: 'Coupe du Golfe', importance: 30, phaseFinale: true },
  { id: 860, nom: 'Coupe arabe', importance: 30, phaseFinale: true },
  { id: 535, nom: 'Coupe CECAFA', importance: 30, phaseFinale: true },
  { id: 859, nom: 'Coupe COSAFA', importance: 30, phaseFinale: true },
  { id: 1169, nom: 'Qualifications EAFF', importance: 30, phaseFinale: false },
  { id: 10, nom: 'Matchs amicaux', importance: 20, phaseFinale: false },
];

export interface MatchDeSelections {
  id: number;
  date: string;
  ligue: number;
  saison: number;
  dom: number;
  ext: number;
  nomDom: string;
  nomExt: string;
  bd: number;
  be: number;
}

const TERMINES = new Set(['FT', 'AET', 'PEN']);

async function lire(chemin: string): Promise<any | null> {
  for (let essai = 1; essai <= 4; essai++) {
    try {
      const r = await fetch(`https://v3.football.api-sports.io/${chemin}`, { headers: { 'x-apisports-key': cle } });
      if (r.ok) {
        const j: any = await r.json();
        const erreurs = j?.errors;
        const enErreur = Array.isArray(erreurs) ? erreurs.length > 0 : !!erreurs && Object.keys(erreurs).length > 0;
        if (!enErreur) return j;
        console.warn(`[SÉLECTIONS] ${chemin} : ${JSON.stringify(erreurs).slice(0, 160)}`);
      }
    } catch {
      /* réessayé ci-dessous */
    }
    await new Promise((t) => setTimeout(t, 2000 * essai));
  }
  return null;
}

export async function ramasserSelections(): Promise<{ matchs: number; appels: number }> {
  const deja: { fait: Record<string, boolean>; matchs: Record<string, MatchDeSelections> } = fs.existsSync(FICHIER)
    ? JSON.parse(fs.readFileSync(FICHIER, 'utf8'))
    : { fait: {}, matchs: {} };
  const anneeEnCours = new Date().getUTCFullYear();
  let appels = 0;

  // Les saisons que le fournisseur connaît, compétition par compétition.
  for (const c of COMPETITIONS_DE_SELECTIONS) {
    const info = await lire(`leagues?id=${c.id}`);
    appels++;
    const saisons: number[] = (info?.response?.[0]?.seasons ?? [])
      .map((s: any) => Number(s.year))
      .filter((y: number) => y >= 2014);
    for (const saison of saisons) {
      const cleSaison = `${c.id}:${saison}`;
      // Une saison qui peut encore se jouer est toujours relue.
      if (deja.fait[cleSaison] && saison < anneeEnCours - 1) continue;
      const j = await lire(`fixtures?league=${c.id}&season=${saison}`);
      appels++;
      if (!j) continue;
      let n = 0;
      for (const f of j.response ?? []) {
        if (!TERMINES.has(String(f?.fixture?.status?.short))) continue;
        const bd = Number(f?.goals?.home);
        const be = Number(f?.goals?.away);
        if (!Number.isFinite(bd) || !Number.isFinite(be)) continue;
        deja.matchs[String(f.fixture.id)] = {
          id: Number(f.fixture.id),
          date: String(f.fixture.date),
          ligue: c.id,
          saison,
          dom: Number(f.teams.home.id),
          ext: Number(f.teams.away.id),
          nomDom: String(f.teams.home.name),
          nomExt: String(f.teams.away.name),
          bd,
          be,
        };
        n++;
      }
      deja.fait[cleSaison] = true;
      console.log(`[SÉLECTIONS] ${c.nom} ${saison} : ${n} matchs terminés.`);
      fs.writeFileSync(FICHIER, JSON.stringify(deja));
      await new Promise((t) => setTimeout(t, 400));
    }
  }
  fs.writeFileSync(FICHIER, JSON.stringify(deja));
  return { matchs: Object.keys(deja.matchs).length, appels };
}

if (path.basename(process.argv[1] ?? '') === 'selections.mts') {
  const r = await ramasserSelections();
  console.log(`[SÉLECTIONS] ${r.matchs} matchs en réserve, ${r.appels} appels au fournisseur.`);
}
