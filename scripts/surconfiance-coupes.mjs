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
    .select('team1_name, team2_name, competition, win_prob, draw_prob, lose_prob, confidence, winner_correct, real_winner, predicted_winner')
    .not('verified_at', 'is', null).order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()].filter((a) => a.draw_prob != null);
const estCoupe = (a) => /UEFA|Champions|Europa|Conference/i.test(String(a.competition));

const bloc = (nom, l) => {
  if (!l.length) return;
  const moy = (f) => Math.round(l.reduce((s, a) => s + Number(f(a) ?? 0), 0) / l.length * 10) / 10;
  const maxi = (a) => Math.max(Number(a.win_prob), Number(a.draw_prob), Number(a.lose_prob));
  const moyMax = Math.round(l.reduce((s, a) => s + maxi(a), 0) / l.length * 10) / 10;
  const justes = Math.round(l.filter((a) => a.winner_correct).length / l.length * 1000) / 10;
  console.log(
    `  ${nom.padEnd(22)} ${String(l.length).padStart(4)} · ` +
    `nul annoncé ${String(moy((a) => a.draw_prob)).padStart(5)} % · ` +
    `issue la + sûre ${String(moyMax).padStart(5)} % · ` +
    `confiance ${String(moy((a) => a.confidence)).padStart(5)} % · ` +
    `réussite ${String(justes).padStart(5)} %`
  );
};

console.log(`\n  ══ LE MOTEUR EST-IL TROP SÛR DE LUI EN COUPE ? ══\n`);
bloc('Coupes européennes', M.filter(estCoupe));
bloc('Championnats', M.filter((a) => !estCoupe(a)));

console.log(`\n  ══ CE QU'IL PROMET CONTRE CE QU'IL TIENT ══\n`);
for (const [nom, l] of [['Coupes', M.filter(estCoupe)], ['Championnats', M.filter((a) => !estCoupe(a))]]) {
  const maxi = (a) => Math.max(Number(a.win_prob), Number(a.draw_prob), Number(a.lose_prob));
  const promis = Math.round(l.reduce((s, a) => s + maxi(a), 0) / Math.max(1, l.length));
  const tenu = Math.round(l.filter((a) => a.winner_correct).length / Math.max(1, l.length) * 100);
  console.log(`  ${nom.padEnd(16)} promet ${promis} % · tient ${tenu} %  →  écart ${promis - tenu} points`);
}
console.log('');
