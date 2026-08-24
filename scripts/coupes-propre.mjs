/**
 * Mesure propre. Le critère n'est plus le nom de la compétition — « Championship »
 * s'y faisait passer pour la Ligue des champions — mais le fait que les deux
 * équipes viennent de championnats différents. C'est la définition même du
 * problème : comparer une force calculée en Belgique à une force calculée au
 * Kazakhstan.
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
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history')
    .select('team1_name, team2_name, team1_league, team2_league, competition, win_prob, draw_prob, lose_prob, real_winner, confidence')
    .not('verified_at', 'is', null).not('real_winner', 'is', null)
    .order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parMatch = new Map();
for (const a of tout) {
  const cle = [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()];

const renseigne = M.filter((a) => a.team1_league && a.team2_league);
console.log(`\n  ${M.length} matchs distincts, dont ${renseigne.length} avec les deux championnats connus.\n`);

const croise = renseigne.filter((a) => String(a.team1_league) !== String(a.team2_league));
const memeLigue = renseigne.filter((a) => String(a.team1_league) === String(a.team2_league));

const bilan = (titre, liste) => {
  if (!liste.length) return console.log(`  ${titre} : aucun match`);
  const justes = liste.filter((a) => {
    const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
    const i = n >= t && n >= e ? 'draw' : t >= e ? 'team1' : 'team2';
    return i === a.real_winner;
  }).length;
  const nulsReels = liste.filter((a) => a.real_winner === 'draw').length;
  const moyNul = liste.reduce((s, a) => {
    const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
    return s + n / (t + n + e || 1);
  }, 0) / liste.length;
  const conf = liste.reduce((s, a) => s + Number(a.confidence || 0), 0) / liste.length;
  console.log(`  ${titre}`);
  console.log(`    ${String(liste.length).padStart(4)} matchs`);
  console.log(`    réussite ......... ${Math.round(justes / liste.length * 1000) / 10} %`);
  console.log(`    confiance affichée ${Math.round(conf)} %`);
  console.log(`    nuls annoncés .... ${Math.round(moyNul * 100)} %`);
  console.log(`    nuls survenus .... ${Math.round(nulsReels / liste.length * 100)} %\n`);
};

console.log('  ══ LE MOTEUR SELON QUE LES DEUX ÉQUIPES SE COMPARENT OU NON ══\n');
bilan('CHAMPIONNATS DIFFÉRENTS (coupes, comparaison hasardeuse)', croise);
bilan('MÊME CHAMPIONNAT (comparaison légitime)', memeLigue);

console.log('  ══ LE DÉTAIL DES MATCHS CROISÉS ══\n');
const parC = new Map();
for (const a of croise) {
  const c = String(a.competition || '(sans nom)');
  if (!parC.has(c)) parC.set(c, []);
  parC.get(c).push(a);
}
for (const [c, l] of [...parC].sort((x, y) => y[1].length - x[1].length)) {
  const justes = l.filter((a) => {
    const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
    const i = n >= t && n >= e ? 'draw' : t >= e ? 'team1' : 'team2';
    return i === a.real_winner;
  }).length;
  console.log(`  ${String(l.length).padStart(4)} matchs · ${String(Math.round(justes / l.length * 100)).padStart(3)} % de réussite · ${c}`);
}
console.log('');
