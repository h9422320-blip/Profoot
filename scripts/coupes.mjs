import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const tout = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('analysis_history')
    .select('team1_name, team2_name, competition, score, real_score, winner_correct, predicted_winner, real_winner, confidence')
    .not('verified_at', 'is', null).order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}

const coupes = tout.filter((a) => /UEFA|Champions|Europa|Conference/i.test(String(a.competition)));
console.log(`\n  ${coupes.length} pronostics de coupe européenne jugés\n`);

// Une même affiche revient souvent : on ne garde qu'une ligne par match.
const parMatch = new Map();
for (const a of coupes) {
  const cle = [a.team1_name, a.team2_name].sort().join(' vs ');
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
console.log(`  ${parMatch.size} affiches distinctes\n`);
console.log(`  match                                      prono   réel    verdict`);
console.log(`  ${'-'.repeat(76)}`);
for (const [, a] of [...parMatch].slice(0, 22)) {
  const p = String(a.score ?? '').replace(/\s/g, '');
  const r = String(a.real_score ?? '').replace(/\s/g, '');
  console.log(
    `  ${`${a.team1_name} — ${a.team2_name}`.slice(0, 40).padEnd(41)} ${p.padEnd(7)} ${r.padEnd(7)} ${a.winner_correct ? 'juste' : 'RATÉ'}`
  );
}

// Vers quoi le moteur penche-t-il en coupe ?
const compte = new Map();
for (const [, a] of parMatch) compte.set(a.predicted_winner, (compte.get(a.predicted_winner) ?? 0) + 1);
const reel = new Map();
for (const [, a] of parMatch) reel.set(a.real_winner, (reel.get(a.real_winner) ?? 0) + 1);
console.log(`\n  Ce que le moteur ANNONCE : ${[...compte].map(([k, n]) => `${k}=${n}`).join('  ')}`);
console.log(`  Ce qui ARRIVE vraiment   : ${[...reel].map(([k, n]) => `${k}=${n}`).join('  ')}`);
console.log('');
