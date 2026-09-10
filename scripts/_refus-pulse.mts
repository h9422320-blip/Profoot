/** Toutes les ventes que le pulse a refusees : de l argent entre, hors des comptes. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('cache_api').select('contenu').eq('cle', 'maketou:pulse:recus').maybeSingle();
const journal: any[] = Array.isArray(data?.contenu) ? data!.contenu : [];
const ventes = journal.filter((e: any) => e?.evenement === 'SUCCESSFUL_SALE');
console.log(`${journal.length} entrees, ${ventes.length} ventes reussies annoncees par la boutique`);
const refusees = ventes.filter((e: any) => e?.resultat?.ouvert !== true);
console.log(`${refusees.length} REFUSEES\n`);
for (const e of refusees)
  console.log(`  ${String(e.recuLe).slice(0,19)}  ${String(e.prix).padStart(6)} F  ${String(e.email).padEnd(36)} ${e.resultat?.motif ?? e.refuse ?? '?'}`);
console.log(`\nplage du journal : du ${String(ventes[ventes.length-1]?.recuLe).slice(0,10)} au ${String(ventes[0]?.recuLe).slice(0,10)}`);
