// Lecture seule : l'état de santé des analyses, heure par heure.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = process.argv[2] ?? new Date(Date.now() - 6 * 3600_000).toISOString();
const { data: ech } = await sb.from('analysis_failures').select('created_at, cause, message, servi_quand_meme').gte('created_at', depuis);
const { data: ok } = await sb.from('analysis_history').select('created_at').gte('created_at', depuis);
const rienServi = (ech ?? []).filter((e) => !e.servi_quand_meme);
console.log(`depuis ${depuis.slice(0, 16)} : ${(ok ?? []).length} analyses servies · ${(ech ?? []).length} incidents · ${rienServi.length} RIEN SERVI`);
for (const e of rienServi.slice(0, 5)) console.log('  ', e.created_at.slice(11, 19), e.cause, String(e.message).slice(0, 110));
const parHeure: Record<string, number> = {};
for (const a of ok ?? []) parHeure[a.created_at.slice(11, 13) + ' h'] = (parHeure[a.created_at.slice(11, 13) + ' h'] ?? 0) + 1;
console.log('analyses servies par heure :', Object.entries(parHeure).sort().map(([h, n]) => `${h} ${n}`).join(' · '));
