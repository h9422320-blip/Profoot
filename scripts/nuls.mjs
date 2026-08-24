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
    .select('team1_name, team2_name, competition, predicted_winner, real_winner, winner_correct')
    .not('verified_at', 'is', null).order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}

// Une affiche = une ligne, sinon les matchs très analysés pèsent double.
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()];

const bloc = (nom, liste) => {
  if (!liste.length) return;
  const annonces = liste.filter((a) => a.predicted_winner === 'draw').length;
  const reels = liste.filter((a) => a.real_winner === 'draw').length;
  const justes = liste.filter((a) => a.winner_correct).length;
  console.log(
    `  ${nom.padEnd(26)} ${String(liste.length).padStart(5)} matchs · ` +
    `nuls annoncés ${String(Math.round(annonces / liste.length * 100)).padStart(3)} % · ` +
    `nuls réels ${String(Math.round(reels / liste.length * 100)).padStart(3)} % · ` +
    `réussite ${String(Math.round(justes / liste.length * 100)).padStart(3)} %`
  );
};

console.log(`\n  ══ LE MOTEUR ANNONCE-T-IL ASSEZ DE NULS ? ══\n`);
bloc('TOUTES COMPÉTITIONS', M);
console.log('');
const estCoupe = (a) => /UEFA|Champions|Europa|Conference/i.test(String(a.competition));
bloc('Coupes européennes', M.filter(estCoupe));
bloc('Championnats', M.filter((a) => !estCoupe(a)));
console.log('');
for (const c of ['La Liga', 'Premier League', 'Serie A', 'Ligue 1'])
  bloc(c, M.filter((a) => a.competition === c));

// Que vaudrait la réussite si l'on n'avait JAMAIS annoncé de nul ?
console.log(`\n  ══ CE QUE LES NULS COÛTENT ══\n`);
const coupes = M.filter(estCoupe);
const rates = coupes.filter((a) => !a.winner_correct);
const ratesParNul = rates.filter((a) => a.real_winner === 'draw' && a.predicted_winner !== 'draw');
console.log(`  Ratés en coupe : ${rates.length}`);
console.log(`  dont le match a fini sur un NUL non annoncé : ${ratesParNul.length}  (${Math.round(ratesParNul.length / Math.max(1, rates.length) * 100)} % des ratés)`);
console.log('');
