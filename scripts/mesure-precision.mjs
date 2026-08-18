/**
 * Où le moteur se trompe, mesuré sur les analyses déjà confrontées au résultat.
 *
 * Aucune écriture, aucun appel au fournisseur : uniquement de la lecture en
 * base. Sert à établir une référence AVANT toute modification du moteur — sans
 * elle, « amélioré » ne veut rien dire.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from('analysis_history')
  .select(
    'id, created_at, team1_name, team2_name, competition, score, real_score, predicted_winner, real_winner, winner_correct, score_correct, confidence, verified_at'
  )
  .not('verified_at', 'is', null)
  .order('created_at', { ascending: true });

if (error) {
  console.error('Lecture impossible :', error.message);
  process.exit(1);
}

const lireScore = (s) => {
  const m = String(s ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

const lignes = data
  .map((a) => {
    const p = lireScore(a.score);
    const r = lireScore(a.real_score);
    if (!p || !r) return null;
    return {
      ...a,
      p1: p[0], p2: p[1], r1: r[0], r2: r[1],
      issueOk: !!a.winner_correct,
      scoreOk: p[0] === r[0] && p[1] === r[1],
      erreurButs: Math.abs(p[0] - r[0]) + Math.abs(p[1] - r[1]),
      erreurTotal: Math.abs(p[0] + p[1] - (r[0] + r[1])),
      predTotal: p[0] + p[1],
      reelTotal: r[0] + r[1],
      predIssue: p[0] > p[1] ? 'team1' : p[0] === p[1] ? 'draw' : 'team2',
      reelIssue: r[0] > r[1] ? 'team1' : r[0] === r[1] ? 'draw' : 'team2',
    };
  })
  .filter(Boolean);

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) + ' %' : '—');
const moy = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '—');

console.log('================ RÉFÉRENCE ACTUELLE ================');
console.log(`Analyses vérifiées exploitables : ${lignes.length} (sur ${data.length} vérifiées)`);
console.log(`Issue correcte                  : ${lignes.filter((l) => l.issueOk).length} — ${pct(lignes.filter((l) => l.issueOk).length, lignes.length)}`);
console.log(`Score exact                     : ${lignes.filter((l) => l.scoreOk).length} — ${pct(lignes.filter((l) => l.scoreOk).length, lignes.length)}`);
console.log(`Erreur moyenne sur les buts     : ${moy(lignes.map((l) => l.erreurButs))} buts (somme des deux écarts)`);
console.log(`Erreur moyenne sur le total     : ${moy(lignes.map((l) => l.erreurTotal))} buts`);
console.log(`Total de buts prédit / réel     : ${moy(lignes.map((l) => l.predTotal))} / ${moy(lignes.map((l) => l.reelTotal))}`);

console.log('\n================ CE QUE LE MOTEUR ANNONCE ================');
for (const issue of ['team1', 'draw', 'team2']) {
  const sous = lignes.filter((l) => l.predIssue === issue);
  const juste = sous.filter((l) => l.reelIssue === issue).length;
  console.log(`  annonce ${issue.padEnd(6)} : ${String(sous.length).padStart(3)} fois (${pct(sous.length, lignes.length)}) — juste ${pct(juste, sous.length)}`);
}
console.log('  --- ce qui arrive réellement ---');
for (const issue of ['team1', 'draw', 'team2']) {
  const n = lignes.filter((l) => l.reelIssue === issue).length;
  console.log(`  réel    ${issue.padEnd(6)} : ${String(n).padStart(3)} fois (${pct(n, lignes.length)})`);
}

console.log('\n================ SCORES LES PLUS ANNONCÉS ================');
const parScore = {};
for (const l of lignes) parScore[`${l.p1}-${l.p2}`] = (parScore[`${l.p1}-${l.p2}`] ?? 0) + 1;
Object.entries(parScore)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .forEach(([s, n]) => console.log(`  ${s.padEnd(5)} ${String(n).padStart(3)} fois  ${pct(n, lignes.length)}`));

console.log('\n================ PAR NIVEAU DE CONFIANCE ================');
const paliers = [[0, 60], [60, 70], [70, 80], [80, 101]];
for (const [min, max] of paliers) {
  const sous = lignes.filter((l) => (l.confidence ?? 0) >= min && (l.confidence ?? 0) < max);
  if (!sous.length) continue;
  console.log(`  ${min}-${max === 101 ? 100 : max - 1} % : ${String(sous.length).padStart(3)} matchs — issue juste ${pct(sous.filter((l) => l.issueOk).length, sous.length)} — score exact ${pct(sous.filter((l) => l.scoreOk).length, sous.length)}`);
}

console.log('\n================ PAR COMPÉTITION (5 matchs et plus) ================');
const parComp = {};
for (const l of lignes) (parComp[l.competition ?? 'inconnue'] ??= []).push(l);
Object.entries(parComp)
  .filter(([, v]) => v.length >= 5)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([c, v]) =>
    console.log(`  ${String(c).slice(0, 30).padEnd(32)} ${String(v.length).padStart(3)} — issue ${pct(v.filter((l) => l.issueOk).length, v.length)} — exact ${pct(v.filter((l) => l.scoreOk).length, v.length)}`)
  );

console.log('\n================ LES ÉCHECS LES PLUS COÛTEUX ================');
lignes
  .filter((l) => !l.issueOk)
  .sort((a, b) => b.erreurButs - a.erreurButs)
  .slice(0, 12)
  .forEach((l) =>
    console.log(
      `  ${String(l.team1_name).slice(0, 18).padEnd(19)} ${l.p1}-${l.p2} → ${l.r1}-${l.r2}  ${String(l.team2_name).slice(0, 18).padEnd(19)} conf. ${String(l.confidence ?? '—').padStart(3)}  ${String(l.competition ?? '').slice(0, 22)}`
    )
  );
