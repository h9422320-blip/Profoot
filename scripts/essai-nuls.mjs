/**
 * Le moteur n'annonce presque jamais de nul. Que se passe-t-il si on lui
 * rend le nul plus facile à annoncer, quand les deux équipes se valent ?
 */
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
    .select('team1_name, team2_name, competition, win_prob, draw_prob, lose_prob, real_winner')
    .not('verified_at', 'is', null).not('draw_prob', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const estCoupe = (a) => /UEFA|Champions|Europa|Conference/i.test(String(a.competition));
const TOUS = [...parMatch.values()];
const COUPES = TOUS.filter(estCoupe);
const CHAMP = TOUS.filter((a) => !estCoupe(a));

const normaliser = (a) => {
  const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
  const s = t + n + e || 1;
  return { v1: t / s, nul: n / s, v2: e / s };
};

/** On multiplie la probabilité de nul, puis on renormalise. */
const pousserNul = (p, k) => {
  const nul = p.nul * k, s = p.v1 + nul + p.v2;
  return { v1: p.v1 / s, nul: nul / s, v2: p.v2 / s };
};

const issueDe = (p) => (p.nul >= p.v1 && p.nul >= p.v2 ? 'draw' : p.v1 >= p.v2 ? 'team1' : 'team2');

const evaluer = (liste, k) => {
  let justes = 0, nuls = 0;
  for (const a of liste) {
    const p = pousserNul(normaliser(a), k);
    const i = issueDe(p);
    if (i === 'draw') nuls++;
    if (i === a.real_winner) justes++;
  }
  return { r: Math.round(justes / Math.max(1, liste.length) * 1000) / 10, n: Math.round(nuls / Math.max(1, liste.length) * 100) };
};

const tableau = (titre, liste) => {
  console.log(`\n  ══ ${titre} — ${liste.length} matchs ══\n`);
  const reels = Math.round(liste.filter((a) => a.real_winner === 'draw').length / liste.length * 100);
  console.log(`  nuls réellement survenus : ${reels} %\n`);
  console.log(`  poussée du nul   nuls annoncés   réussite`);
  for (const k of [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]) {
    const r = evaluer(liste, k);
    const flag = k === 1 ? '   <- aujourd hui' : '';
    console.log(`  ${('x' + k).padStart(12)}   ${String(r.n).padStart(12)} %  ${String(r.r).padStart(8)} %${flag}`);
  }
};

tableau('COUPES EUROPÉENNES', COUPES);
tableau('CHAMPIONNATS (contrôle — ne doit pas se dégrader)', CHAMP);
console.log('');
