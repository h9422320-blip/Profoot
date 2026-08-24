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
    .select('winner_correct, score_correct, verified_at, competition, created_at, real_score, score')
    .not('verified_at', 'is', null).order('verified_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}

const taux = (l) => l.length ? Math.round(l.filter((a) => a.winner_correct).length / l.length * 1000) / 10 : 0;

console.log(`\n  ${tout.length} pronostics jugés au total — ${taux(tout)} % de vainqueurs trouvés\n`);

// ── Par jour de VÉRIFICATION : le lot d'aujourd'hui a-t-il fait chuter ? ──
console.log('  ══ PAR JOUR DE VÉRIFICATION ══\n');
const parJour = new Map();
for (const a of tout) {
  const j = String(a.verified_at).slice(0, 10);
  const l = parJour.get(j) ?? []; l.push(a); parJour.set(j, l);
}
for (const [j, l] of [...parJour].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6))
  console.log(`     ${j}  ${String(l.length).padStart(5)} jugés  ${String(taux(l)).padStart(5)} %`);

// ── Par compétition : les grandes ligues tiennent-elles ? ────────────────
console.log('\n  ══ LES DIX COMPÉTITIONS LES PLUS ANALYSÉES ══\n');
const parComp = new Map();
for (const a of tout) {
  const c = String(a.competition ?? '—');
  const l = parComp.get(c) ?? []; l.push(a); parComp.set(c, l);
}
for (const [c, l] of [...parComp].sort((a, b) => b[1].length - a[1].length).slice(0, 10))
  console.log(`     ${c.slice(0, 28).padEnd(29)} ${String(l.length).padStart(5)}  ${String(taux(l)).padStart(5)} %`);

// ── Un contrôle de bon sens : les scores réels sont-ils plausibles ? ─────
const bizarres = tout.filter((a) => {
  const m = String(a.real_score ?? '').match(/(\d+)\s*-\s*(\d+)/);
  return m && (Number(m[1]) > 9 || Number(m[2]) > 9);
});
console.log(`\n  Scores réels aberrants (plus de 9 buts) : ${bizarres.length}`);
console.log('');
