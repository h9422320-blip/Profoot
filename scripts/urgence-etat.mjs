/**
 * URGENCE — quel est l'état réel du service, maintenant ?
 * Lecture seule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: echecs, error: erreurEchecs } = await sb
  .from('analysis_failures')
  .select('*')
  .gte('created_at', new Date(Date.now() - 3 * 86400000).toISOString())
  .order('created_at', { ascending: false });

const analyses = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data } = await sb.from('analysis_history').select('created_at')
    .gte('created_at', new Date(Date.now() - 3 * 86400000).toISOString()).range(de, de + 999);
  if (!data?.length) break; analyses.push(...data); if (data.length < 1000) break;
}

console.log(`\n  ══ TROIS DERNIERS JOURS ══\n`);
console.log(`  Analyses produites : ${analyses?.length ?? 0}`);
console.log(`  Échecs enregistrés : ${echecs?.length ?? 0}`);
if (analyses?.length) {
  console.log(`  Taux d'échec ..... : ${Math.round(((echecs?.length ?? 0) / analyses.length) * 1000) / 10} %`);
}

const parJour = new Map();
for (const a of analyses ?? []) {
  const j = String(a.created_at).slice(0, 10);
  if (!parJour.has(j)) parJour.set(j, { analyses: 0, echecs: 0, servis: 0 });
  parJour.get(j).analyses++;
}
for (const e of echecs ?? []) {
  const j = String(e.created_at).slice(0, 10);
  if (!parJour.has(j)) parJour.set(j, { analyses: 0, echecs: 0, servis: 0 });
  parJour.get(j).echecs++;
  if (e.servi_quand_meme ?? e.served_anyway) parJour.get(j).servis++;
}

console.log(`\n  jour         analyses   échecs   servis quand même   taux`);
console.log('  ' + '─'.repeat(64));
for (const [j, e] of [...parJour].sort()) {
  const taux = e.analyses ? Math.round((e.echecs / e.analyses) * 1000) / 10 : 0;
  console.log(
    `  ${j}   ${String(e.analyses).padStart(8)} ${String(e.echecs).padStart(8)} ${String(e.servis).padStart(18)} ${String(taux).padStart(6)} %`
  );
}

const parCause = new Map();
for (const e of echecs ?? []) parCause.set(e.cause, (parCause.get(e.cause) ?? 0) + 1);
console.log(`\n  ══ PAR CAUSE ══\n`);
for (const [c, n] of [...parCause].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${c}`);
}

// Un échec « servi quand même » ne se voit pas de l'abonné : il a eu son
// analyse. Ceux qui comptent sont les autres.
const invisibles = (echecs ?? []).filter((e) => e.servi_quand_meme ?? e.served_anyway).length;
const subis = (echecs ?? []).length - invisibles;
console.log(`\n  Servis quand même (l'abonné n'a rien vu) : ${invisibles}`);
console.log(`  RÉELLEMENT SUBIS par un abonné ......... : ${subis}`);

if (subis) {
  console.log(`\n  ══ LES ÉCHECS RÉELLEMENT SUBIS, LES PLUS RÉCENTS ══\n`);
  for (const e of (echecs ?? []).filter((x) => !(x.servi_quand_meme ?? x.served_anyway)).slice(0, 8)) {
    console.log(`  ${String(e.created_at).slice(0, 16)}  ${(e.equipe1 ?? e.team1)} — ${(e.equipe2 ?? e.team2)}`);
    console.log(`     ${e.cause} · ${Math.round(((e.duree_ms ?? e.duration_ms) ?? 0) / 1000)} s`);
    console.log(`     ${String(e.message ?? '').slice(0, 150)}`);
  }
}
console.log('');
