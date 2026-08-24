import fs from 'fs';
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
    .select('team1_name, team2_name, team1_league, team2_league, competition, win_prob, draw_prob, lose_prob, real_winner')
    .not('verified_at', 'is', null).not('real_winner', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()].filter((a) => a.team1_league && a.team2_league && a.draw_prob != null);
const croise = M.filter((a) => String(a.team1_league) !== String(a.team2_league));
const meme = M.filter((a) => String(a.team1_league) === String(a.team2_league));

const norm = (a) => { const t = +a.win_prob, n = +a.draw_prob, e = +a.lose_prob, s = t + n + e || 1; return { v1: t / s, nul: n / s, v2: e / s }; };
const pousser = (p, k) => { const nul = p.nul * k, s = p.v1 + nul + p.v2; return { v1: p.v1 / s, nul: nul / s, v2: p.v2 / s }; };
const issue = (p) => (p.nul >= p.v1 && p.nul >= p.v2 ? 'draw' : p.v1 >= p.v2 ? 'team1' : 'team2');
const ev = (l, k) => {
  let j = 0, n = 0;
  for (const a of l) { const p = pousser(norm(a), k); const i = issue(p); if (i === 'draw') n++; if (i === a.real_winner) j++; }
  return { r: Math.round(j / l.length * 1000) / 10, n: Math.round(n / l.length * 100), j, t: l.length };
};

console.log(`\n  ══ MATCHS ENTRE CHAMPIONNATS DIFFÉRENTS — ${croise.length} matchs ══\n`);
console.log(`  poussée du nul   nuls annoncés   réussite   bons pronostics`);
for (const k of [1, 1.2, 1.43, 1.6, 1.8, 2, 2.5]) {
  const r = ev(croise, k);
  console.log(`  ${('x' + k).padStart(12)}   ${String(r.n).padStart(12)} %  ${String(r.r).padStart(8)} %   ${r.j} / ${r.t}${k === 1 ? '   <- aujourd hui' : ''}${k === 1.43 ? '   <- le facteur mesure' : ''}`);
}

console.log(`\n  ══ CONTRÔLE — même championnat, ${meme.length} matchs, ne doit PAS bouger ══\n`);
const r0 = ev(meme, 1);
console.log(`  Aujourd'hui et après le correctif : ${r0.r} % (le correctif ne s'y applique pas)\n`);

// ── Robustesse : le correctif tient-il sur deux moitiés indépendantes ? ──
const moitie = Math.floor(croise.length / 2);
const A = croise.slice(0, moitie), B = croise.slice(moitie);
console.log(`  ══ ÉPREUVE DE SOLIDITÉ — deux moitiés séparées ══\n`);
for (const [nom, l] of [['Moitié récente', A], ['Moitié ancienne', B]]) {
  const avant = ev(l, 1), apres = ev(l, 1.43);
  const signe = apres.r >= avant.r ? '+' : '';
  console.log(`  ${nom.padEnd(16)} ${l.length} matchs · avant ${String(avant.r).padStart(5)} % · après ${String(apres.r).padStart(5)} % · ${signe}${Math.round((apres.r - avant.r) * 10) / 10} pt`);
}
console.log('');
