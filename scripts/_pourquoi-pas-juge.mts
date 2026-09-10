import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const K = process.env.API_FOOTBALL_KEY!;

// Les rencontres de C1 du 9 septembre, chez le fournisseur.
const r = await fetch('https://v3.football.api-sports.io/fixtures?league=2&season=2026&from=2026-09-09&to=2026-09-09', { headers: { 'x-apisports-key': K }, cache: 'no-store' });
const j = await r.json();
const fx = (j?.response ?? []);
console.log(`${fx.length} rencontres de Ligue des champions le 9 septembre\n`);

const pron: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('predictions_match').select('*').range(de, de + 999);
  pron.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const parId = new Map(pron.map((p) => [Number(p.fixture_id), p]));
const juges: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('fixture_id').range(de, de + 999);
  juges.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const dejaJuges = new Set(juges.map((x) => Number(x.fixture_id)));

for (const f of fx) {
  const id = Number(f.fixture.id);
  const p = parId.get(id);
  console.log(
    `  ${String(f.teams.home.name).slice(0, 18).padEnd(19)} ${String(f.teams.away.name).slice(0, 18).padEnd(19)} ` +
    `statut ${String(f.fixture.status.short).padEnd(4)} reel ${f.goals.home}-${f.goals.away}   ` +
    (p ? `pronostic ${p.buts_domicile}-${p.buts_exterieur} calcule ${String(p.calculee_le).slice(0, 16)}` : 'AUCUN PRONOSTIC FIGE') +
    (dejaJuges.has(id) ? '  [juge]' : '  [pas juge]')
  );
}
