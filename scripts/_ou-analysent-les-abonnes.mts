/** Les competitions des analyses des 30 derniers jours, et leur couverture par la couche des tirs. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');
const sb = createAdminClient();
const { data: ex } = await sb.from('analysis_history').select('*').limit(1);
const cols = Object.keys(ex?.[0] ?? {});
console.log('colonnes : ' + cols.join(', '));
const champ = ['competition', 'league', 'league_name', 'competition_name', 'ligue'].find((c) => cols.includes(c));
const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString();
const lignes: any[] = [];
for (let de = 0; de < 200_000; de += 1000) {
  const { data, error } = await sb.from('analysis_history').select(champ ? `${champ}, fixture_id, created_at` : 'fixture_id, created_at').gte('created_at', depuis).range(de, de + 999);
  if (error) { console.log('ERREUR ' + error.message); break; }
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`${lignes.length} analyses sur 30 jours ; champ competition : ${champ ?? 'AUCUN'}`);
// Repli : la competition via le pronostic fige de la rencontre.
const ids = [...new Set(lignes.map((l) => Number(l.fixture_id)).filter(Boolean))];
const compDe = new Map<number, string>();
for (let i = 0; i < ids.length; i += 500) {
  const { data } = await sb.from('predictions_match').select('fixture_id, competition').in('fixture_id', ids.slice(i, i + 500));
  for (const p of data ?? []) if (p.competition) compDe.set(Number(p.fixture_id), String(p.competition));
}
const couvertes = new Set<string>(CHAMPIONNATS.map((c: any) => String(c.nom)));
// Les noms du releve sont en francais pour certaines coupes : on les rapproche des noms du fournisseur.
const alias: Record<string, string> = { 'UEFA Champions League': 'Ligue des champions', 'UEFA Europa League': 'Ligue Europa', 'UEFA Europa Conference League': 'Ligue Europa Conference' };
const parComp = new Map<string, number>();
for (const l of lignes) {
  const c = String((champ ? l[champ] : null) ?? compDe.get(Number(l.fixture_id)) ?? '(inconnue)');
  parComp.set(c, (parComp.get(c) ?? 0) + 1);
}
let couvert = 0, total = 0;
console.log('\n  analyses  couverte  competition');
for (const [c, n] of [...parComp].sort((a, b) => b[1] - a[1]).slice(0, 45)) {
  const ok = couvertes.has(c) || couvertes.has(alias[c] ?? '');
  total += n; if (ok) couvert += n;
  console.log(`  ${String(n).padStart(8)}  ${ok ? '   oui  ' : '   NON  '}  ${c}`);
}
console.log(`\ncouverture des 45 premieres competitions : ${couvert}/${total} analyses (${(100 * couvert / Math.max(1, total)).toFixed(1)} %)`);
