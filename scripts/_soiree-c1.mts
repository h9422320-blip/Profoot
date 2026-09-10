import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tous: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  tous.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
for (const jour of ['2026-09-08', '2026-09-09', '2026-09-10']) {
  const lot = tous.filter((j) => String(j.date_match).slice(0, 10) === jour && String(j.ligue).startsWith('UEFA'));
  if (!lot.length) continue;
  const justes = lot.filter((j) => j.issue_juste).length;
  console.log(`\n=== ${jour} — coupes d Europe : ${justes} / ${lot.length} issues justes ===`);
  for (const j of lot)
    console.log(
      `  ${String(j.ligue).replace('UEFA ', '').slice(0, 18).padEnd(19)} ` +
      `${String(j.equipe_domicile).slice(0, 18).padEnd(19)} ${String(j.equipe_exterieur).slice(0, 18).padEnd(19)} ` +
      `annonce ${j.buts_prevus_domicile}-${j.buts_prevus_exterieur} (${j.proba_domicile}/${j.proba_nul}/${j.proba_exterieur})  ` +
      `reel ${j.buts_reels_domicile}-${j.buts_reels_exterieur}  ${j.issue_juste ? 'JUSTE' : 'rate'}${j.score_exact ? ' + SCORE EXACT' : ''}`
    );
}
