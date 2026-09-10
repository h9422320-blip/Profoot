import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { butsAttendusOccasions } = await import('../src/lib/forme-occasions.js');
const sb = createAdminClient();
const { data } = await sb.from('cache_api').select('contenu').eq('cle', 'forces:occasions-v6').maybeSingle();
const rel: any = data?.contenu;
const cles = Object.keys(rel?.clubs ?? {});
console.log(`${cles.length} clubs dans le releve ; exemples de cles : ${cles.slice(0, 5).join(' | ')}`);
for (const motif of [/manchester/i, /sabah/i, /slavia/i, /lens/i, /bayern/i, /bod/i, /como/i, /leipzig/i, /fenerb/i, /roma/i, /psv/i, /shakhtar/i])
  console.log(`  ${String(motif).padEnd(12)} -> ${cles.filter((k) => motif.test(k) || motif.test(String(rel.clubs[k]?.nom ?? ''))).join(', ') || 'AUCUN'}`);
for (const [a, b] of [['Manchester United', 'Sabah FA'], ['Slavia Praha', 'Lens'], ['Bayern München', 'Bodo/Glimt'], ['Como', 'RB Leipzig']])
  console.log(`  ${a} - ${b} : ${JSON.stringify(butsAttendusOccasions(rel, a, b))}`);
