/**
 * Quelles compétitions entraîner ? Celles que nos abonnés analysent.
 *
 * Entraîner sur la Mongolie n'aide personne : aucun abonné n'y joue. On part
 * donc des compétitions réellement demandées, et on y ajoute les coupes
 * européennes — indispensables, ce sont elles qui relient les championnats
 * entre eux et permettent de les mettre sur une échelle commune.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const K = env.API_FOOTBALL_KEY;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = async (u) => (await fetch('https://v3.football.api-sports.io' + u, { headers: { 'x-apisports-key': K } })).json();

// ── Ce que nos abonnés demandent ────────────────────────────────────────
const analyses = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history').select('competition, team1_league, team2_league').range(de, de + 999);
  if (!data?.length) break; analyses.push(...data); if (data.length < 1000) break;
}

// Les identifiants de championnat sont plus fiables que les noms : ils sont
// posés par le fournisseur, pas recopiés.
const demandes = new Map();
for (const a of analyses) {
  for (const l of [a.team1_league, a.team2_league]) {
    if (l === null || l === undefined || l === '') continue;
    const id = Number(l);
    if (!Number.isFinite(id)) continue;
    demandes.set(id, (demandes.get(id) ?? 0) + 1);
  }
}

const catalogue = await api('/leagues?season=2025');
const parId = new Map((catalogue.response ?? []).map((x) => [x.league.id, x]));

// Les coupes européennes, ajoutées d'office : elles sont le pont entre ligues.
const PONTS = [2, 3, 848, 531];

const retenues = [...demandes.entries()]
  .filter(([id, n]) => n >= 20 && parId.has(id))
  .sort((a, b) => b[1] - a[1]);

const ids = [...new Set([...retenues.map(([id]) => id), ...PONTS])];

console.log(`\n  ${analyses.length} analyses lues.`);
console.log(`  ${demandes.size} championnats apparaissent, ${retenues.length} avec au moins 20 analyses.\n`);
console.log('  ══ CE QUI SERA ENTRAÎNÉ ══\n');
console.log('  analyses   id    pays / competition');
for (const [id, n] of retenues.slice(0, 30)) {
  const x = parId.get(id);
  console.log(`  ${String(n).padStart(8)}  ${String(id).padStart(4)}  ${x.country.name} / ${x.league.name}`);
}
for (const id of PONTS) {
  const x = parId.get(id);
  if (x && !demandes.has(id)) console.log(`  ${'(pont)'.padStart(8)}  ${String(id).padStart(4)}  ${x.country.name} / ${x.league.name}`);
}
console.log(`\n  ${ids.length} compétitions retenues au total.`);

const dest = path.join(process.env.TEMP ?? '.', 'profoot-ligues.json');
fs.writeFileSync(dest, JSON.stringify(ids));
console.log(`  Écrit dans ${dest}\n`);
