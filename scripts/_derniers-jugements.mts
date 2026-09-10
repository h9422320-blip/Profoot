import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { count } = await sb.from('jugements_moteur').select('*', { count: 'exact', head: true });
console.log(`${count} rencontres jugees au total`);
const { data } = await sb.from('jugements_moteur')
  .select('ligue, equipe_domicile, equipe_exterieur, buts_prevus_domicile, buts_prevus_exterieur, buts_reels_domicile, buts_reels_exterieur, issue_juste, juge_le, date_match')
  .order('juge_le', { ascending: false }).limit(12);
for (const j of data ?? [])
  console.log(
    `  ${String(j.juge_le).slice(5, 16)}  ${String(j.ligue).slice(0, 24).padEnd(25)} ` +
    `${String(j.equipe_domicile).slice(0, 16).padEnd(17)} ${String(j.equipe_exterieur).slice(0, 16).padEnd(17)} ` +
    `annonce ${j.buts_prevus_domicile}-${j.buts_prevus_exterieur}  reel ${j.buts_reels_domicile}-${j.buts_reels_exterieur}  ${j.issue_juste ? 'JUSTE' : 'rate'}`
  );
