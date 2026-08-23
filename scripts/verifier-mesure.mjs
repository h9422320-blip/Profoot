/** La table est-elle en place, et reçoit-elle quelque chose ? */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error, count } = await sb
  .from('visites_pages')
  .select('*', { count: 'exact' })
  .order('entre_le', { ascending: false })
  .limit(10);

if (error) { console.log(`\n  TABLE INACCESSIBLE : ${error.message}\n`); process.exit(1); }

console.log(`\n  ✔ Table en place. ${count ?? 0} ligne(s) enregistrée(s).\n`);
if (!data?.length) {
  console.log('  Aucune visite encore. C\'est normal : le mouchard vient d\'être déployé.');
  console.log('  Ouvre profootai.com sur ton téléphone, navigue 2-3 pages, puis relance.\n');
} else {
  console.log('  Les dernières :\n');
  for (const l of data)
    console.log(
      `  ${String(l.entre_le).slice(11, 19)}  ordre ${l.ordre}  ` +
      `${String(l.chemin).slice(0, 28).padEnd(29)} ` +
      `${l.duree_ms != null ? Math.round(l.duree_ms / 1000) + ' s' : 'en cours'}  ` +
      `${l.mobile ? 'mobile' : 'bureau'}  ${l.pays ?? '—'}`
    );
  console.log('');
}
