/**
 * RÉÉCRIRE LES PRÉDICTIONS FIGÉES QUI N'AVAIENT DÉPARTAGÉ PERSONNE.
 *
 * ── CE QU'ELLES SONT ──────────────────────────────────────────────────────
 *
 * Des lignes comme celle-ci, relevée le 2 septembre 2026 :
 *
 *     Real Betis  2 - 1  Real Madrid     probabilités  36 · 28 · 36
 *
 * Un vainqueur annoncé alors que les deux victoires sont à égalité. Le score
 * ne venait pas du modèle : il venait du « supérieur ou égal » qui départage
 * l'issue, et qui tranchait à la place du calcul.
 *
 * Soixante-dix-huit lignes étaient dans cet état.
 *
 * ── POURQUOI CE SCRIPT PLUTÔT QUE D'ATTENDRE ──────────────────────────────
 *
 * La route d'analyse les répare déjà à la lecture : la ligne fausse est
 * écartée, le calcul frais est servi, et la ligne réécrite. Mais cela ne se
 * produit QUE si quelqu'un ouvre ce match précis. Celles que personne n'ouvre
 * restent fausses en base, et nourrissent le calibrage qui apprend des
 * pronostics passés.
 *
 * ── LA GARDE QUI COMPTE PLUS QUE TOUT LE RESTE ────────────────────────────
 *
 * ON NE TOUCHE JAMAIS À UN MATCH DÉJÀ COMMENCÉ.
 *
 * Réécrire le pronostic d'une rencontre dont on connaît le résultat, ce n'est
 * pas réparer : c'est fabriquer une prédiction juste après coup. Le mur des
 * preuves et le calibrage lisent ces lignes ; les falsifier reviendrait à
 * inventer un palmarès.
 *
 * Chaque fixture est donc interrogée chez le fournisseur, et seuls les matchs
 * dont le coup d'envoi n'a pas été donné sont recalculés.
 *
 * ── LE CALCUL EST CELUI DE LA PRODUCTION, PAS UN RACCOURCI ────────────────
 *
 * Mêmes entrées, même fonction, mêmes correctifs : forces ajustées de la
 * ligue, calibrage appris, rapport entre championnats. Calculer autrement
 * produirait des chiffres qui ne correspondraient pas à ce que le moteur dirait
 * à l'écran — on remplacerait une incohérence par une autre.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *
 *     npx tsx scripts/reparer-predictions-indecises.mts           (simulation)
 *     npx tsx scripts/reparer-predictions-indecises.mts --ecrire  (écrit)
 */

import fs from 'node:fs';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = ligne.indexOf('=');
  if (i > 0 && !ligne.startsWith('#')) {
    process.env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
}

const ECRIRE = process.argv.includes('--ecrire');

const { createJiti } = await import('jiti');
 const jiti = createJiti(import.meta.url);
 const { createClient } = await import('@supabase/supabase-js');
const { calculerScoreProbable, competitionPeuFiable } = await jiti.import('../src/lib/score-probable.ts');
const { lireForcesLigue } = await jiti.import('../src/lib/forces-equipes.ts');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CLE = process.env.API_FOOTBALL_KEY!;
async function api(chemin: string): Promise<any> {
  const r = await fetch('https://v3.football.api-sports.io/' + chemin, {
    headers: { 'x-apisports-key': CLE },
  });
  const j = await r.json();
  return j.response;
}

/** Le même critère que `predictionIndecise`, rejoué sur la ligne brute. */
const indecise = (p: any) =>
  Number(p.buts_domicile) !== Number(p.buts_exterieur) &&
  Math.abs(Number(p.proba_domicile) - Number(p.proba_exterieur)) < 4;

// ── 1. LES LIGNES À EXAMINER ────────────────────────────────────────────────
const toutes: any[] = [];
for (let depart = 0; depart < 100_000; depart += 1000) {
  const { data, error } = await sb.from('predictions_match').select('*').range(depart, depart + 999);
  if (error) throw new Error(error.message);
  toutes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const aReparer = toutes.filter(indecise);
console.log(`${toutes.length} prédictions figées, dont ${aReparer.length} indécises.\n`);

// ── 2. RÉSERVES PARTAGÉES ───────────────────────────────────────────────────
const statsCache = new Map<string, any>();
const classementCache = new Map<string, any[]>();
const forcesCache = new Map<string, any>();

async function stats(ligue: number, saison: number, equipe: number) {
  const cle = `${ligue}:${saison}:${equipe}`;
  if (!statsCache.has(cle)) {
    statsCache.set(cle, await api(`teams/statistics?league=${ligue}&season=${saison}&team=${equipe}`));
  }
  return statsCache.get(cle);
}

async function classement(ligue: number, saison: number) {
  const cle = `${ligue}:${saison}`;
  if (!classementCache.has(cle)) {
    const r = await api(`standings?league=${ligue}&season=${saison}`);
    classementCache.set(cle, r?.[0]?.league?.standings?.[0] ?? []);
  }
  return classementCache.get(cle)!;
}

async function forces(ligue: number, saison: number) {
  const cle = `${ligue}:${saison}`;
  if (!forcesCache.has(cle)) {
    forcesCache.set(cle, await lireForcesLigue(ligue, saison).catch(() => null));
  }
  return forcesCache.get(cle);
}

// ── 3. EXAMEN LIGNE PAR LIGNE ───────────────────────────────────────────────
type Verdict = {
  ligne: any;
  etat: 'a-ecrire' | 'deja-joue' | 'donnees-absentes' | 'inchange';
  avant: string;
  apres?: string;
  nouveau?: any;
  detail?: string;
};

const verdicts: Verdict[] = [];

for (const p of aReparer) {
  const avant = `${p.domicile_nom} ${p.buts_domicile}-${p.buts_exterieur} ${p.exterieur_nom} (${p.proba_domicile}/${p.proba_nul}/${p.proba_exterieur})`;

  const fixture = (await api(`fixtures?id=${p.fixture_id}`))?.[0];
  if (!fixture) {
    verdicts.push({ ligne: p, etat: 'donnees-absentes', avant, detail: 'fixture introuvable' });
    continue;
  }

  // ── LA GARDE : UN MATCH COMMENCÉ NE SE RÉÉCRIT JAMAIS ──────────────────
  const statut = String(fixture.fixture?.status?.short ?? '');
  const commence = statut !== 'NS' && statut !== 'TBD' && statut !== 'PST';
  const coupDenvoi = new Date(fixture.fixture?.date ?? 0).getTime();
  if (commence || coupDenvoi < Date.now()) {
    verdicts.push({ ligne: p, etat: 'deja-joue', avant, detail: `statut ${statut}` });
    continue;
  }

  const ligue = Number(fixture.league?.id);
  const saison = Number(fixture.league?.season);
  const domId = Number(fixture.teams?.home?.id);
  const extId = Number(fixture.teams?.away?.id);
  if (!ligue || !saison || !domId || !extId) {
    verdicts.push({ ligne: p, etat: 'donnees-absentes', avant, detail: 'ligue ou équipes inconnues' });
    continue;
  }

  const [sDom, sExt, table, f] = await Promise.all([
    stats(ligue, saison, domId),
    stats(ligue, saison, extId),
    classement(ligue, saison),
    forces(ligue, saison),
  ]);

  const brut = (s: any) => ({
    butsMarques: Number(s?.goals?.for?.total?.total ?? 0),
    butsEncaisses: Number(s?.goals?.against?.total?.total ?? 0),
    matchsJoues: Number(s?.fixtures?.played?.total ?? 0),
  });

  const rang = (id: number) => {
    const r = table.find((x: any) => x.team?.id === id);
    return r ? { rang: r.rank, points: r.points, total: table.length } : null;
  };

  const fDom = f?.equipes?.get(domId);
  const fExt = f?.equipes?.get(extId);
  const forcesDuMatch =
    f?.fiable && fDom && fExt
      ? { equipe1: fDom, equipe2: fExt, butsDomicile: f.butsDomicile, butsExterieur: f.butsExterieur }
      : null;

  const r = calculerScoreProbable(
    brut(sDom),
    brut(sExt),
    true, // l'équipe 1 est celle qui reçoit : c'est l'orientation officielle de la table
    competitionPeuFiable(fixture.league?.name ?? null),
    { equipe1: rang(domId) as any, equipe2: rang(extId) as any },
    forcesDuMatch as any
  );

  const apres = `${p.domicile_nom} ${r.buts1}-${r.buts2} ${p.exterieur_nom} (${r.probaVictoire1}/${r.probaNul}/${r.probaVictoire2})`;

  const encoreIndecise =
    r.buts1 !== r.buts2 && Math.abs(r.probaVictoire1 - r.probaVictoire2) < 4;
  if (encoreIndecise) {
    // Ne devrait plus arriver depuis la correction du choix de score. Si cela
    // se produit, on ne remplace pas une incohérence par une autre.
    verdicts.push({ ligne: p, etat: 'inchange', avant, apres, detail: 'toujours indécise' });
    continue;
  }

  verdicts.push({ ligne: p, etat: 'a-ecrire', avant, apres, nouveau: r });
}

// ── 4. BILAN ────────────────────────────────────────────────────────────────
const par = (e: Verdict['etat']) => verdicts.filter((v) => v.etat === e);
console.log(`À RÉÉCRIRE ......... ${par('a-ecrire').length}`);
console.log(`DÉJÀ JOUÉS, INTOUCHÉS ${par('deja-joue').length}`);
console.log(`DONNÉES ABSENTES ... ${par('donnees-absentes').length}`);
console.log(`TOUJOURS INDÉCISES . ${par('inchange').length}\n`);

for (const v of par('a-ecrire').slice(0, 20)) {
  console.log(`  ${v.avant}\n     →  ${v.apres}`);
}
if (par('a-ecrire').length > 20) console.log(`  … et ${par('a-ecrire').length - 20} autres.`);

if (par('deja-joue').length) {
  console.log(`\nLaissés intacts parce que le match est commencé ou terminé :`);
  for (const v of par('deja-joue').slice(0, 8)) console.log(`  ${v.avant}  [${v.detail}]`);
}

// ── 5. ÉCRITURE ─────────────────────────────────────────────────────────────
if (!ECRIRE) {
  console.log('\n(simulation — rien n’a été écrit. Relancer avec --ecrire.)');
} else {
  let ecrites = 0;
  let echecs = 0;
  for (const v of par('a-ecrire')) {
    const r = v.nouveau;
    const { error } = await sb
      .from('predictions_match')
      .update({
        buts_domicile: r.buts1,
        buts_exterieur: r.buts2,
        proba_domicile: r.probaVictoire1,
        proba_nul: r.probaNul,
        proba_exterieur: r.probaVictoire2,
        confiance: r.confiance,
        xg_domicile: r.butsAttendus1,
        xg_exterieur: r.butsAttendus2,
        calculee_le: new Date().toISOString(),
      })
      .eq('fixture_id', v.ligne.fixture_id);
    if (error) {
      echecs++;
      console.log(`  ÉCHEC ${v.ligne.fixture_id} : ${error.message}`);
    } else {
      ecrites++;
    }
  }
  console.log(`\n${ecrites} ligne(s) réécrite(s), ${echecs} échec(s).`);
}
