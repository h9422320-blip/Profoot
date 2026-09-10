/** Ce que le moteur avait annonce pour les matchs du jour, face au resultat. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { competitionRetenue } = await import('../src/lib/precalcul-selection.js');
const sb = createAdminClient();
const jour = new Date().toISOString().slice(0, 10);
const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! }, cache: 'no-store' });
const fx = ((await r.json())?.response ?? []).filter((f: any) => competitionRetenue(f?.league) && ['FT','AET','PEN'].includes(f.fixture.status.short));
const ids = fx.map((f: any) => Number(f.fixture.id));
const { data } = await sb.from('predictions_match').select('*').in('fixture_id', ids);
const pron = new Map<number, any>();
for (const p of data ?? []) { const c = pron.get(Number(p.fixture_id)); if (!c || String(p.calculee_le) > String(c.calculee_le)) pron.set(Number(p.fixture_id), p); }
const issue = (a: number, b: number) => a > b ? 'dom' : a < b ? 'ext' : 'nul';
let n = 0, justes = 0, exacts = 0;
console.log('  competition              rencontre                                 annonce      reel   verdict');
for (const f of fx.sort((a: any, b: any) => (a.league.id === 2 ? 0 : 1) - (b.league.id === 2 ? 0 : 1))) {
  const p = pron.get(Number(f.fixture.id));
  const nom = `${f.teams.home.name} - ${f.teams.away.name}`.slice(0, 40).padEnd(41);
  if (!p) { console.log(`  ${String(f.league.name).slice(0,23).padEnd(24)} ${nom} (aucun pronostic fige)`); continue; }
  const pd = Number(p.proba_domicile), pn = Number(p.proba_nul), pe = Number(p.proba_exterieur);
  const annonce = pd >= pn && pd >= pe ? 'dom' : pe >= pn ? 'ext' : 'nul';
  const reel = issue(f.goals.home, f.goals.away);
  const exact = Number(p.buts_domicile) === f.goals.home && Number(p.buts_exterieur) === f.goals.away;
  n++; if (annonce === reel) justes++; if (exact) exacts++;
  console.log(`  ${String(f.league.name).slice(0,23).padEnd(24)} ${nom} ${String(p.buts_domicile)}-${String(p.buts_exterieur)} ${String(annonce).padEnd(4)}  ${f.goals.home}-${f.goals.away}    ${annonce === reel ? (exact ? 'JUSTE + SCORE EXACT' : 'JUSTE') : 'rate'}`);
}
console.log(`\n  ${justes}/${n} vainqueurs justes (${n ? Math.round(100*justes/n) : 0} %), ${exacts} score(s) exact(s)`);
