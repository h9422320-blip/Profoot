/**
 * COMBIEN D'ABONNÉS « ESSENTIEL » ONT VRAIMENT ÉPUISÉ LEURS 20 ANALYSES ?
 *
 * C'est le seul dénominateur honnête pour parler de rachat : on ne peut pas
 * reprocher à quelqu'un de ne pas racheter s'il lui reste des analyses.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: abos } = await sb.from('subscriptions')
  .select('user_id, plan, status, amount, created_at, expires_at')
  .order('created_at', { ascending: true });

console.log(`\n  ${abos?.length ?? 0} abonnements enregistrés dans l'application.\n`);

const parPlan = new Map();
for (const a of abos ?? []) {
  const c = `${a.plan} (${a.amount})`;
  parPlan.set(c, (parPlan.get(c) ?? 0) + 1);
}
console.log('  ══ RÉPARTITION ══\n');
for (const [p, n] of [...parPlan].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)} · ${p}`);

// ── Consommation réelle, abonné par abonné ────────────────────────────────
const usage = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('analysis_usage').select('user_id, period_start').range(de, de + 999);
  if (!data?.length) break; usage.push(...data); if (data.length < 1000) break;
}
console.log(`\n  ${usage.length} analyses décomptées au total.\n`);

const consomme = new Map();
for (const u of usage) {
  const cle = `${u.user_id}|${u.period_start}`;
  consomme.set(cle, (consomme.get(cle) ?? 0) + 1);
}

// Le premier abonnement de chaque utilisateur fixe le début de sa période.
const premierAbo = new Map();
for (const a of abos ?? []) if (!premierAbo.has(a.user_id)) premierAbo.set(a.user_id, a);

const essentiels = (abos ?? []).filter((a) => a.plan === 'essential_monthly' || Number(a.amount) === 2000);
const uniques = new Map();
for (const a of essentiels) if (!uniques.has(a.user_id)) uniques.set(a.user_id, a);

let epuises = 0, presque = 0, aPeine = 0, jamais = 0;
const paliers = new Map();
for (const [uid] of uniques) {
  let total = 0;
  for (const [cle, n] of consomme) if (cle.startsWith(uid + '|')) total += n;
  const p = total === 0 ? '0' : total >= 20 ? '20 et plus' : total >= 15 ? '15 a 19' : total >= 10 ? '10 a 14' : total >= 5 ? '5 a 9' : '1 a 4';
  paliers.set(p, (paliers.get(p) ?? 0) + 1);
  if (total >= 20) epuises++; else if (total >= 15) presque++; else if (total > 0) aPeine++; else jamais++;
}

console.log('  ══ LES ABONNÉS « ESSENTIEL » (2 000 F, 20 ANALYSES) ══\n');
console.log(`  Abonnés distincts : ${uniques.size}\n`);
console.log('  analyses utilisées   abonnés');
for (const p of ['0', '1 a 4', '5 a 9', '10 a 14', '15 a 19', '20 et plus']) {
  const n = paliers.get(p) ?? 0;
  console.log(`  ${p.padEnd(19)}  ${String(n).padStart(4)}  ${'█'.repeat(Math.round(n / Math.max(1, uniques.size) * 45))}`);
}
console.log(`\n  ONT ÉPUISÉ LEURS 20 ANALYSES : ${epuises} sur ${uniques.size} (${Math.round(epuises / Math.max(1, uniques.size) * 100)} %)`);
console.log(`  N'ont jamais lancé d'analyse : ${jamais} (${Math.round(jamais / Math.max(1, uniques.size) * 100)} %)`);
console.log('');
