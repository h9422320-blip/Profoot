/** Les journées de cotes réécrites récemment : contiennent-elles moins qu'avant ? Lecture seule. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const rencontres: any[] = JSON.parse(fs.readFileSync('.challenger/rencontres.json', 'utf8'));
const jouees = new Set(rencontres.map((m) => Number(m.id)));
const depuis = new Date(Date.now() - 3 * 3600_000).toISOString();
const { data, error } = await sb.from('cache_api').select('cle, contenu, ecrit_le').ilike('cle', 'cotes:%').gte('ecrit_le', depuis).order('cle');
if (error) { console.log('ERREUR ' + error.message); process.exit(1); }
const aujourdhui = new Date().toISOString().slice(0, 10);
console.log(`${data?.length ?? 0} journées réécrites depuis ${depuis.slice(11, 16)} UTC\n`);
console.log('  journée      écrite à   matchs   déjà joués   jour passé ?');
for (const r of data ?? []) {
  const matchs: any[] = (r.contenu as any)?.matchs ?? [];
  const deja = matchs.filter((m) => jouees.has(Number(m.id))).length;
  const jour = String(r.cle).slice(6);
  console.log(`  ${jour}   ${String(r.ecrit_le).slice(11, 19)}   ${String(matchs.length).padStart(5)}   ${String(deja).padStart(9)}    ${jour < aujourdhui ? 'OUI' : ''}`);
}
