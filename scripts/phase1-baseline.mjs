/**
 * PHASE 1 — LA MESURE DE DÉPART.
 *
 * Contre laquelle chaque levier sera jugé. On dédoublonne par match : dix-sept
 * abonnés analysant la même affiche ne font pas dix-sept observations.
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
    .select('fixture_id, team1_name, team2_name, team1_league, team2_league, competition, win_prob, draw_prob, lose_prob, confidence, score, real_score, real_winner, created_at')
    .not('verified_at', 'is', null).not('real_winner', 'is', null).not('draw_prob', 'is', null)
    .order('created_at', { ascending: true }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}

// Un match = une observation. La PREMIÈRE analyse fait foi : c'est elle qui a
// été produite sans rien savoir, les suivantes relisent une prédiction figée.
const parMatch = new Map();
for (const a of tout) {
  const cle = a.fixture_id ? `f${a.fixture_id}` : [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
  if (!parMatch.has(cle)) parMatch.set(cle, a);
}
const M = [...parMatch.values()];
console.log(`\n  ${tout.length} analyses vérifiées  →  ${M.length} matchs distincts.\n`);

const proba = (a) => {
  const t = Number(a.win_prob), n = Number(a.draw_prob), e = Number(a.lose_prob);
  const s = t + n + e || 1;
  // On borne : une probabilité nulle rend le log-loss infini, ce qui n'apprend rien.
  const b = (v) => Math.min(0.999, Math.max(0.001, v / s));
  return { team1: b(t), draw: b(n), team2: b(e) };
};
const issuePredite = (p) => (p.draw >= p.team1 && p.draw >= p.team2 ? 'draw' : p.team1 >= p.team2 ? 'team1' : 'team2');
const lireScore = (s) => { const m = String(s ?? '').replace(/\s/g, '').match(/^(\d+)-(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : null; };

function bilan(liste, nom) {
  if (!liste.length) return null;
  let justes = 0, exacts = 0, brier = 0, logloss = 0, avecScore = 0;
  for (const a of liste) {
    const p = proba(a);
    if (issuePredite(p) === a.real_winner) justes++;
    for (const issue of ['team1', 'draw', 'team2']) {
      const y = a.real_winner === issue ? 1 : 0;
      brier += (p[issue] - y) ** 2;
    }
    logloss += -Math.log(p[a.real_winner] ?? 0.001);
    const pred = lireScore(a.score), reel = lireScore(a.real_score);
    if (pred && reel) { avecScore++; if (pred[0] === reel[0] && pred[1] === reel[1]) exacts++; }
  }
  return {
    nom, n: liste.length,
    vainqueur: Math.round((justes / liste.length) * 1000) / 10,
    scoreExact: avecScore ? Math.round((exacts / avecScore) * 1000) / 10 : null,
    brier: Math.round((brier / liste.length) * 1000) / 1000,
    logloss: Math.round((logloss / liste.length) * 1000) / 1000,
  };
}

const ligne = (b) => b && console.log(
  `  ${b.nom.padEnd(34)} ${String(b.n).padStart(5)} ${String(b.vainqueur).padStart(8)} % ${String(b.scoreExact ?? '—').padStart(8)} % ${String(b.brier).padStart(8)} ${String(b.logloss).padStart(9)}`
);

console.log('  ══ RÉFÉRENCE DE DÉPART ══\n');
console.log('  segment                            matchs vainqueur    score    Brier   log-loss');
console.log('  ' + '─'.repeat(84));
ligne(bilan(M, 'TOUS LES MATCHS'));

// ── Deux références obligatoires ────────────────────────────────────────
const domicile = M.filter((a) => a.real_winner === 'team1').length;
console.log(`\n  Référence « le domicile gagne toujours » : ${Math.round((domicile / M.length) * 1000) / 10} %`);
const parIssue = { team1: 0, draw: 0, team2: 0 };
for (const a of M) parIssue[a.real_winner]++;
console.log(`  Issues réellement survenues : domicile ${Math.round(parIssue.team1 / M.length * 100)} % · nul ${Math.round(parIssue.draw / M.length * 100)} % · extérieur ${Math.round(parIssue.team2 / M.length * 100)} %`);

// ── Segmentation ────────────────────────────────────────────────────────
console.log('\n  ══ MÊME CHAMPIONNAT CONTRE CHAMPIONNATS CROISÉS ══\n');
console.log('  segment                            matchs vainqueur    score    Brier   log-loss');
console.log('  ' + '─'.repeat(84));
const avecLigues = M.filter((a) => a.team1_league && a.team2_league);
ligne(bilan(avecLigues.filter((a) => String(a.team1_league) === String(a.team2_league)), 'Même championnat'));
ligne(bilan(avecLigues.filter((a) => String(a.team1_league) !== String(a.team2_league)), 'Championnats différents'));

console.log('\n  ══ FAVORI NET CONTRE MATCH SERRÉ ══\n');
console.log('  segment                            matchs vainqueur    score    Brier   log-loss');
console.log('  ' + '─'.repeat(84));
const ecartDe = (a) => { const p = proba(a); const tri = [p.team1, p.draw, p.team2].sort((x, y) => y - x); return tri[0] - tri[1]; };
ligne(bilan(M.filter((a) => ecartDe(a) >= 0.25), 'Favori net (écart ≥ 25 pts)'));
ligne(bilan(M.filter((a) => ecartDe(a) >= 0.10 && ecartDe(a) < 0.25), 'Favori léger (10 à 25 pts)'));
ligne(bilan(M.filter((a) => ecartDe(a) < 0.10), 'Match serré (< 10 pts)'));

console.log('\n  ══ PAR COMPÉTITION (les plus fréquentes) ══\n');
console.log('  segment                            matchs vainqueur    score    Brier   log-loss');
console.log('  ' + '─'.repeat(84));
const parC = new Map();
for (const a of M) { const c = String(a.competition || '(sans nom)'); if (!parC.has(c)) parC.set(c, []); parC.get(c).push(a); }
for (const [c, l] of [...parC].sort((a, b) => b[1].length - a[1].length).slice(0, 8)) {
  if (l.length < 8) continue;
  ligne(bilan(l, c.slice(0, 32)));
}

// ── La courbe de calibration ────────────────────────────────────────────
console.log('\n  ══ COURBE DE CALIBRATION — quand on dit X %, gagne-t-on X % ? ══\n');
console.log('  probabilite annoncee   matchs   promis   tenu    ecart');
console.log('  ' + '─'.repeat(58));
const paliers = [[0.30, 0.40], [0.40, 0.50], [0.50, 0.60], [0.60, 0.70], [0.70, 0.80], [0.80, 1.01]];
for (const [bas, haut] of paliers) {
  const l = M.filter((a) => { const p = proba(a); return p[issuePredite(p)] >= bas && p[issuePredite(p)] < haut; });
  if (!l.length) continue;
  const promis = l.reduce((s, a) => { const p = proba(a); return s + p[issuePredite(p)]; }, 0) / l.length;
  const tenu = l.filter((a) => issuePredite(proba(a)) === a.real_winner).length / l.length;
  const ecart = Math.round((promis - tenu) * 1000) / 10;
  console.log(`  ${String(Math.round(bas * 100)).padStart(6)} a ${String(Math.round(haut * 100)).padStart(3)} %   ${String(l.length).padStart(6)}   ${String(Math.round(promis * 100)).padStart(4)} %  ${String(Math.round(tenu * 100)).padStart(4)} %   ${ecart > 0 ? '+' : ''}${ecart} pt`);
}
console.log('');
