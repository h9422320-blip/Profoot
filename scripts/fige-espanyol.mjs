import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const api = async (c) => (await fetch(`https://v3.football.api-sports.io${c}`, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY }, cache: 'no-store' })).json();
const live = await api('/fixtures?live=all&team=541');
const f = live?.response?.[0];
console.log(`\n  Rencontre en direct : ${f.fixture.id} — ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} [${f.fixture.status.short} ${f.fixture.status.elapsed}']`);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('predictions_match').select('*').eq('fixture_id', f.fixture.id).maybeSingle();
console.log(`\n  ══ PRONOSTIC D'AVANT-MATCH EN BASE ══\n`);
if (!data) console.log('  AUCUN pronostic figé pour cette rencontre.');
else {
  console.log(`  ${data.domicile_nom} ${data.buts_domicile} - ${data.buts_exterieur} ${data.exterieur_nom}`);
  console.log(`  Probabilités : domicile ${data.proba_domicile} % · nul ${data.proba_nul} % · extérieur ${data.proba_exterieur} %`);
  console.log(`  Confiance ${data.confiance} % — calculé le ${String(data.calculee_le).slice(0, 16)}`);
}
console.log('');
