import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const vente = process.argv[2];
const { data } = await sb.from('cache_api').select('contenu').eq('cle', 'maketou:pulse:recus').maybeSingle();
const j: any[] = Array.isArray(data?.contenu) ? (data!.contenu as any[]) : [];
const siens = j.filter((e) => String(e?.vente ?? '').startsWith(vente));
console.log(`${siens.length} message(s) du pulse pour la vente ${vente}`);
for (const e of siens.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe))))
  console.log(`  ${e.recuLe}  ${e.evenement}  identifie=${e.identifie}  resultat=${JSON.stringify(e.resultat ?? e.erreur ?? e.refuse ?? null)}`);
const { data: al } = await sb.from('cache_api').select('contenu').eq('cle', 'maketou:pulse:ventes-alertees').maybeSingle();
console.log(`deja alertee : ${Array.isArray(al?.contenu) && (al!.contenu as any[]).some((x) => String(x).startsWith(vente))}`);
