import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });

const JOUR = new Date().toISOString().slice(0, 10);

// ── Ce qui est PUBLIC : le mur, tel que le visiteur le voit ────────────────
const { getPreuvesPubliques } = await jiti.import('../src/lib/preuves.ts');
const { preuves, total } = await getPreuvesPubliques(60);
const duJour = preuves.filter((p) => String(p.dateMatch ?? '').slice(0, 10) === JOUR);

console.log(`\n  ══ RÉUSSITES D'AUJOURD'HUI (${JOUR}) SUR LE MUR PUBLIC ══\n`);
console.log(`  #   match                                          pronostic   réel   exact  compétition`);
console.log(`  ${'-'.repeat(104)}`);
duJour.forEach((p, i) => {
  console.log(
    `  ${String(i + 1).padStart(2)}  ${`${p.equipe1} — ${p.equipe2}`.slice(0, 40).padEnd(41)} ` +
    `${String(p.pronoScore ?? '—').padEnd(10)}  ${String(p.scoreReel ?? '—').padEnd(6)} ${p.scoreExact ? 'OUI ' : '    '}   ${String(p.competition ?? '').slice(0, 24)}`
  );
});
console.log(`\n  ${duJour.length} réussite(s) du jour, en tête du mur. ${total} preuves au total.`);

// ── CONTRÔLE : aucun raté ne doit être public ─────────────────────────────
const rates = preuves.filter((p) => p.reussi === false);
console.log(`\n  ══ CONTRÔLE DES RATÉS ══\n`);
console.log(`  Pronostics ratés présents sur le mur public : ${rates.length}`);
for (const r of rates.slice(0, 5)) console.log(`     ${r.equipe1} — ${r.equipe2}`);

// Ce que l'admin voit, lui, pour la même journée.
const { data: tout } = await sb.from('analysis_history')
  .select('team1_name, team2_name, winner_correct, verified_at')
  .gte('verified_at', `${JOUR}T00:00:00Z`).not('winner_correct', 'is', null);
const justes = (tout ?? []).filter((a) => a.winner_correct).length;
const faux = (tout ?? []).length - justes;
console.log(`\n  Jugés aujourd'hui : ${justes} réussi(s), ${faux} raté(s) — les ${faux} ratés restent côté admin.`);
console.log('');
