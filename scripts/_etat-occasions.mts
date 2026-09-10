/** Ce que le relevé des tirs contient aujourd'hui, sans rien modifier. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
for (const cle of ['forces:occasions-v6', 'forces:occasions-v5']) {
  const { data } = await sb.from('cache_api').select('contenu, ecrit_le, expire_le').eq('cle', cle).maybeSingle();
  if (!data) { console.log(`${cle} : ABSENT`); continue; }
  const c: any = data.contenu ?? {};
  const clubs = Object.keys(c.clubs ?? {}).length;
  const ligues = Object.entries(c.moyennesParLigue ?? {});
  console.log(`\n${cle} — ecrit ${String(data.ecrit_le).slice(0, 16)}, expire ${String(data.expire_le).slice(0, 16)}`);
  console.log(`  ${clubs} clubs, ${ligues.length} competitions etalonnees, reprise a ${c.prochainDepart ?? '?'}`);
  for (const [n, m] of ligues.sort((a: any, b: any) => b[1] - a[1])) console.log(`    ${String(n).padEnd(28)} ${m}`);
}
