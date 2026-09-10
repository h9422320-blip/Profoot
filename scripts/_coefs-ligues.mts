import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('cache_api').select('contenu, ecrit_le, expire_le').eq('cle', 'forces-championnats:v1').maybeSingle();
if (!data) { console.log('forces-championnats:v1 ABSENT'); process.exit(0); }
const c: any = data.contenu;
console.log(`ecrit ${String(data.ecrit_le).slice(0,16)}, expire ${String(data.expire_le).slice(0,16)}`);
console.log('cles : ' + Object.keys(c).join(', '));
const coefs = c.coefficients ?? c.ligues ?? c.parLigue ?? c;
const entrees = Object.entries(coefs).filter(([, v]) => typeof v === 'number' || typeof (v as any)?.coef === 'number');
console.log(`${entrees.length} championnats appris`);
const val = (v: any) => typeof v === 'number' ? v : v?.coef;
for (const [k, v] of entrees.sort((a, b) => val(b[1]) - val(a[1])).slice(0, 80)) console.log(`  ${String(k).padStart(5)}  ${Number(val(v)).toFixed(3)}`);
for (const id of ['39', '419', '144', '179', '78', '2', '333', '345', '197', '389', '357']) console.log(`  -> id ${id} : ${coefs[id] != null ? JSON.stringify(coefs[id]) : 'INCONNU'}`);
