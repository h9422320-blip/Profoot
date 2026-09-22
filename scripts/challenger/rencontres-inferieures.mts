/**
 * LES DIVISIONS INFÉRIEURES ET LES COUPES NATIONALES DES GRANDS PAYS.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────
 *
 * Demande du propriétaire, le 21 septembre 2026 : après les sélections,
 * « connaître tous les clubs ». Sur trente jours, les abonnés ont lancé plus
 * de 1 100 analyses en coupe nationale (League Cup, Coppa Italia, DFB Pokal,
 * FA Cup…), avec 52 % de vainqueurs justes — pas mieux qu'en championnat,
 * alors qu'une coupe oppose souvent un gros favori à un club d'en dessous.
 *
 * Le moteur ne connaît ni la League One, ni la 3. Liga, ni la Serie C, ni le
 * National : la hiérarchie des championnats n'en a jamais vu un match. Un club
 * qui domine sa division inférieure lui paraît donc aussi fort qu'un club de
 * haut de première division.
 *
 * Ce ramasseur relève trois saisons de ces divisions et de ces coupes, dans un
 * fichier À PART (`.challenger/rencontres-inferieures.json`) : le fichier de
 * référence du banc ne bouge pas tant que la mesure n'a pas parlé.
 *
 *   npx tsx scripts/challenger/rencontres-inferieures.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chargerEnv, DOSSIER } from './commun.mjs';
chargerEnv();

export const FICHIER_INFERIEURES = path.join(DOSSIER, 'rencontres-inferieures.json');

/** Relevées une à une le 21 septembre 2026 sur le catalogue du fournisseur. */
export const LIGUES_INFERIEURES: { id: number; nom: string }[] = [
  { id: 41, nom: 'League One' }, { id: 42, nom: 'League Two' }, { id: 43, nom: 'National League' },
  { id: 435, nom: 'Primera RFEF 1' }, { id: 436, nom: 'Primera RFEF 2' },
  { id: 875, nom: 'Segunda RFEF 1' }, { id: 876, nom: 'Segunda RFEF 2' }, { id: 877, nom: 'Segunda RFEF 3' },
  { id: 878, nom: 'Segunda RFEF 4' }, { id: 879, nom: 'Segunda RFEF 5' },
  { id: 138, nom: 'Serie C A' }, { id: 942, nom: 'Serie C B' }, { id: 943, nom: 'Serie C C' },
  { id: 80, nom: '3. Liga' }, { id: 83, nom: 'Regionalliga Bayern' }, { id: 84, nom: 'Regionalliga Nord' },
  { id: 85, nom: 'Regionalliga Nordost' }, { id: 86, nom: 'Regionalliga SudWest' }, { id: 87, nom: 'Regionalliga West' },
  { id: 63, nom: 'National' }, { id: 67, nom: 'National 2 A' }, { id: 68, nom: 'National 2 B' }, { id: 69, nom: 'National 2 C' },
  { id: 95, nom: 'Liga Portugal 2' }, { id: 865, nom: 'Liga 3 Portugal' },
  { id: 89, nom: 'Eerste Divisie' }, { id: 145, nom: 'Challenger Pro League' },
  { id: 180, nom: 'Championship écossais' }, { id: 183, nom: 'League One écossaise' }, { id: 184, nom: 'League Two écossaise' },
  { id: 204, nom: '1. Lig' },
];

export const COUPES_NATIONALES: { id: number; nom: string }[] = [
  { id: 45, nom: 'FA Cup' }, { id: 48, nom: 'League Cup' }, { id: 143, nom: 'Copa del Rey' },
  { id: 137, nom: 'Coppa Italia' }, { id: 81, nom: 'DFB Pokal' }, { id: 66, nom: 'Coupe de France' },
  { id: 96, nom: 'Taça de Portugal' }, { id: 97, nom: 'Taça da Liga' }, { id: 90, nom: 'KNVB Beker' },
  { id: 147, nom: 'Coupe de Belgique' }, { id: 181, nom: 'Coupe d’Écosse' }, { id: 185, nom: 'Coupe de la Ligue écossaise' },
  { id: 206, nom: 'Coupe de Turquie' },
];

const cle = process.env.API_FOOTBALL_KEY!;
async function lire(chemin: string): Promise<any | null> {
  for (let essai = 1; essai <= 4; essai++) {
    try {
      const r = await fetch(`https://v3.football.api-sports.io/${chemin}`, { headers: { 'x-apisports-key': cle } });
      if (r.ok) {
        const j: any = await r.json();
        const e = j?.errors;
        if (!(Array.isArray(e) ? e.length : e && Object.keys(e).length)) return j;
      }
    } catch {
      /* réessayé */
    }
    await new Promise((t) => setTimeout(t, 2000 * essai));
  }
  return null;
}

export async function ramasserInferieures(): Promise<{ rencontres: number; appels: number }> {
  const deja: { fait: Record<string, boolean>; rencontres: Record<string, any> } = fs.existsSync(FICHIER_INFERIEURES)
    ? JSON.parse(fs.readFileSync(FICHIER_INFERIEURES, 'utf8'))
    : { fait: {}, rencontres: {} };
  const maintenant = new Date();
  const saison = maintenant.getUTCMonth() >= 6 ? maintenant.getUTCFullYear() : maintenant.getUTCFullYear() - 1;
  let appels = 0;
  for (const l of [...LIGUES_INFERIEURES, ...COUPES_NATIONALES]) {
    for (const s of [saison - 2, saison - 1, saison]) {
      const k = `${l.id}:${s}`;
      // Une saison close ne bouge plus ; la saison en cours se relit.
      if (deja.fait[k] && s < saison) continue;
      const j = await lire(`fixtures?league=${l.id}&season=${s}&status=FT`);
      appels++;
      if (!j) continue;
      let n = 0;
      for (const f of j.response ?? []) {
        if (f?.goals?.home == null || f?.goals?.away == null) continue;
        deja.rencontres[String(f.fixture.id)] = {
          id: Number(f.fixture.id),
          date: String(f.fixture.date),
          ligue: Number(f.league.id),
          saison: Number(f.league.season),
          dom: Number(f.teams.home.id),
          ext: Number(f.teams.away.id),
          nomDom: String(f.teams.home.name),
          nomExt: String(f.teams.away.name),
          bd: Number(f.goals.home),
          be: Number(f.goals.away),
        };
        n++;
      }
      deja.fait[k] = true;
      console.log(`[INFÉRIEURES] ${l.nom} ${s} : ${n} rencontres.`);
      await new Promise((t) => setTimeout(t, 300));
    }
    fs.writeFileSync(FICHIER_INFERIEURES, JSON.stringify(deja));
  }
  fs.writeFileSync(FICHIER_INFERIEURES, JSON.stringify(deja));
  return { rencontres: Object.keys(deja.rencontres).length, appels };
}

if (path.basename(process.argv[1] ?? '') === 'rencontres-inferieures.mts') {
  const r = await ramasserInferieures();
  console.log(`[INFÉRIEURES] ${r.rencontres} rencontres en réserve, ${r.appels} appels au fournisseur.`);
}
