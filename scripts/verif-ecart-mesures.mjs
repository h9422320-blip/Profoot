/**
 * Deux façons de compter une réussite, et elles ne donnent pas la même chose.
 *
 *   — `winner_correct` en base : l'issue DU SCORE ANNONCÉ contre le résultat.
 *   — ma mesure de départ : l'issue LA PLUS PROBABLE contre le résultat.
 *
 * Elles divergeaient sur 9 % des analyses avant le correctif du 24 août 2026,
 * qui a supprimé les affichages où le score et les probabilités se
 * contredisaient. Il faut savoir laquelle on montre, et pourquoi.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const tout = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history')
    .select('fixture_id, team1_name, team2_name, team1_league, team2_league, competition, win_prob, draw_prob, lose_prob, score, real_score, real_winner, winner_correct, predicted_winner, verified_at')
    .not('verified_at', 'is', null).not('real_winner', 'is', null)
    .order('verified_at', { ascending: true }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}

const parMatch = new Map();
for (const a of tout) {
  const cle = a.fixture_id ? `f${a.fixture_id}` : [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()];

const issueDesProbas = (a) => {
  const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
  if (!Number.isFinite(t) || !Number.isFinite(n) || !Number.isFinite(e)) return null;
  return n >= t && n >= e ? 'draw' : t >= e ? 'team1' : 'team2';
};
const issueDuScore = (a) => {
  const m = String(a.score ?? '').replace(/\s/g, '').match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const x = Number(m[1]), y = Number(m[2]);
  return x > y ? 'team1' : x === y ? 'draw' : 'team2';
};

let desaccord = 0, comparables = 0;
let justesProbas = 0, justesScore = 0, justesBase = 0;
let avecProbas = 0, avecScore = 0, avecBase = 0;

for (const a of M) {
  const ip = issueDesProbas(a);
  const is = issueDuScore(a);
  if (ip && is) { comparables++; if (ip !== is) desaccord++; }
  if (ip) { avecProbas++; if (ip === a.real_winner) justesProbas++; }
  if (is) { avecScore++; if (is === a.real_winner) justesScore++; }
  if (a.winner_correct !== null) { avecBase++; if (a.winner_correct) justesBase++; }
}

const pc = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

console.log(`\n  ${tout.length} analyses -> ${M.length} matchs distincts.\n`);
console.log('  ══ TROIS FACONS DE COMPTER, SUR LES MEMES MATCHS ══\n');
console.log(`  Issue la plus PROBABLE juste ....... ${pc(justesProbas, avecProbas)} %   (${justesProbas}/${avecProbas})`);
console.log(`  Issue du SCORE ANNONCE juste ...... ${pc(justesScore, avecScore)} %   (${justesScore}/${avecScore})`);
console.log(`  Colonne winner_correct en base .... ${pc(justesBase, avecBase)} %   (${justesBase}/${avecBase})`);
console.log(`\n  Le score et les probabilites se contredisent sur ${pc(desaccord, comparables)} % des matchs (${desaccord}/${comparables}).`);

// Le meme decoupage, par segment.
const connus = M.filter((a) => a.team1_league && a.team2_league);
const memes = connus.filter((a) => String(a.team1_league) === String(a.team2_league));
const croises = connus.filter((a) => String(a.team1_league) !== String(a.team2_league));

console.log('\n  ══ PAR SEGMENT ══\n');
console.log('  segment                 matchs   par probabilite   par score annonce');
console.log('  ' + '─'.repeat(70));
for (const [nom, liste] of [['Meme championnat', memes], ['Championnats croises', croises]]) {
  const jp = liste.filter((a) => issueDesProbas(a) === a.real_winner).length;
  const js = liste.filter((a) => issueDuScore(a) === a.real_winner).length;
  console.log(`  ${nom.padEnd(22)} ${String(liste.length).padStart(6)} ${String(pc(jp, liste.length)).padStart(15)} % ${String(pc(js, liste.length)).padStart(17)} %`);
}
console.log('');
