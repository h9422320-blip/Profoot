/**
 * Que gagnerait-on à rapprocher les probabilités de coupe de la réalité ?
 * On rejoue les vrais matchs avec plusieurs forces d'atténuation.
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
const COUPES = [...parMatch.values()].filter(estCoupe);
const CHAMP = [...parMatch.values()].filter((a) => !estCoupe(a));

/**
 * L'atténuation : on rapproche les trois probabilités d'un socle commun.
 * `force` = 0 ne change rien ; 1 remplace tout par le socle.
 */
const SOCLE = { v1: 0.36, nul: 0.34, v2: 0.30 };

function attenuer(a, force) {
  const t = Number(a.win_prob) / 100, n = Number(a.draw_prob) / 100, e = Number(a.lose_prob) / 100;
  const s = t + n + e || 1;
  return {
    v1: (1 - force) * (t / s) + force * SOCLE.v1,
    nul: (1 - force) * (n / s) + force * SOCLE.nul,
    v2: (1 - force) * (e / s) + force * SOCLE.v2,
  };
}

const issueDe = (p) => (p.nul >= p.v1 && p.nul >= p.v2 ? 'draw' : p.v1 >= p.v2 ? 'team1' : 'team2');

const evaluer = (liste, force) => {
  let justes = 0, nuls = 0;
  for (const a of liste) {
    const p = attenuer(a, force);
    const i = issueDe(p);
    if (i === 'draw') nuls++;
    if (i === a.real_winner) justes++;
  }
  return {
    reussite: Math.round(justes / Math.max(1, liste.length) * 1000) / 10,
    partNuls: Math.round(nuls / Math.max(1, liste.length) * 100),
  };
};

console.log(`\n  ══ COUPES EUROPÉENNES — ${COUPES.length} matchs réels ══\n`);
console.log(`  atténuation   nuls annoncés   réussite`);
for (const f of [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1]) {
  const r = evaluer(COUPES, f);
  console.log(`  ${String(Math.round(f * 100)).padStart(9)} %  ${String(r.partNuls).padStart(12)} %  ${String(r.reussite).padStart(8)} %${f === 0 ? '   <- aujourd hui' : ''}`);
}

console.log(`\n  ══ CONTRÔLE : les championnats ne doivent PAS bouger ══\n`);
for (const f of [0, 0.4]) {
  const r = evaluer(CHAMP, f);
  console.log(`  atténuation ${String(Math.round(f * 100)).padStart(3)} %  →  réussite ${r.reussite} % · nuls ${r.partNuls} %`);
}
console.log('');
