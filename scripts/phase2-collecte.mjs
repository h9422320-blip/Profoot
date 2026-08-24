/**
 * PHASE 2 — CONSTITUTION DU JEU D'ENTRAÎNEMENT.
 *
 * Nos 337 matchs vérifiés ne suffisent pas à régler quoi que ce soit. Le
 * fournisseur, lui, donne l'historique complet de chaque championnat pour un
 * appel par saison — et le quota autorise 136 000 appels par jour.
 *
 * On collecte les compétitions que nos abonnés analysent réellement, plus les
 * coupes européennes : ce sont elles qui relient les championnats entre eux et
 * rendent possible une échelle commune.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const K = env.API_FOOTBALL_KEY;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { LEAGUE_IDS } = await jiti.import('./src/lib/api-football.ts');

const api = async (u) => {
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch('https://v3.football.api-sports.io' + u, { headers: { 'x-apisports-key': K } });
      return await r.json();
    } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  return null;
};

// ── Ce que nos abonnés demandent, traduit en identifiants ───────────────
const analyses = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history').select('team1_league, team2_league').range(de, de + 999);
  if (!data?.length) break; analyses.push(...data); if (data.length < 1000) break;
}
const demandes = new Map();
for (const a of analyses) for (const cle of [a.team1_league, a.team2_league]) {
  const id = LEAGUE_IDS[String(cle ?? '')];
  if (id) demandes.set(id, (demandes.get(id) ?? 0) + 1);
}

// Les coupes européennes, d'office : sans elles, aucune échelle commune.
const PONTS = [2, 3, 848, 531];
const ligues = [...new Set([...[...demandes].filter(([, n]) => n >= 20).map(([id]) => id), ...PONTS])];

console.log(`\n  ${demandes.size} compétitions demandées, ${ligues.length} retenues (au moins 20 analyses, plus les coupes).\n`);

// ── Collecte ────────────────────────────────────────────────────────────
const SAISONS = [2024, 2025];
const matchs = [];
let appels = 0;

for (const ligue of ligues) {
  for (const saison of SAISONS) {
    const r = await api(`/fixtures?league=${ligue}&season=${saison}&status=FT`);
    appels++;
    for (const f of r?.response ?? []) {
      if (f?.goals?.home === null || f?.goals?.away === null) continue;
      matchs.push({
        id: f.fixture.id,
        date: f.fixture.date,
        ligue: f.league.id,
        nomLigue: f.league.name,
        pays: f.league.country,
        saison,
        dom: f.teams.home.id,
        nomDom: f.teams.home.name,
        ext: f.teams.away.id,
        nomExt: f.teams.away.name,
        butsDom: f.goals.home,
        butsExt: f.goals.away,
      });
    }
  }
  process.stdout.write(`\r  collecte : ${matchs.length} matchs, ${appels} appels`);
}

matchs.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

const dest = path.join(
  process.env.TEMP ?? '.',
  'claude', 'C--Users-HP-Downloads-Profoot-main', '912ffc75-3aae-4043-82ba-2fb819ae437e', 'scratchpad'
);
fs.mkdirSync(dest, { recursive: true });
const fichier = path.join(dest, 'matchs.json');
fs.writeFileSync(fichier, JSON.stringify(matchs));

console.log(`\n\n  ══ JEU CONSTITUÉ ══\n`);
console.log(`  ${matchs.length} matchs terminés, ${appels} appels au fournisseur.`);
console.log(`  du ${matchs[0]?.date.slice(0, 10)} au ${matchs[matchs.length - 1]?.date.slice(0, 10)}`);
console.log(`  ${new Set(matchs.map((m) => m.ligue)).size} compétitions, ${new Set(matchs.flatMap((m) => [m.dom, m.ext])).size} équipes`);

const croises = matchs.filter((m) => PONTS.includes(m.ligue));
console.log(`  ${croises.length} matchs de coupe européenne — le pont entre championnats.`);
console.log(`\n  Écrit dans ${fichier}\n`);
