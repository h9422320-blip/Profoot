// Lecture seule : les jugements rangés sous un nom de compétition ambigu
// portent-ils réellement plusieurs compétitions différentes ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { apiFootball } = await import('../src/lib/api-football.js');
const sb = createAdminClient();
const noms = process.argv.slice(2);
const lignes: any[] = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data, error } = await sb.from('jugements_moteur').select('fixture_id, ligue').range(de, de + 999);
  if (error) throw error;
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const parNom = new Map<string, number[]>();
for (const l of lignes) {
  const n = String(l.ligue ?? '—');
  parNom.set(n, [...(parNom.get(n) ?? []), Number(l.fixture_id)]);
}
console.log(`jugements : ${lignes.length} · noms de compétition distincts : ${parNom.size}`);
const cibles = noms.length ? noms : [...parNom].sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([n]) => n);
for (const nom of cibles) {
  const ids = (parNom.get(nom) ?? []).slice(0, 60);
  if (!ids.length) { console.log(`\n« ${nom} » : aucun jugement`); continue; }
  const vues = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 20) {
    const d = await apiFootball<any>(`/fixtures?ids=${ids.slice(i, i + 20).join('-')}`, 3600_000);
    for (const f of d?.response ?? []) {
      const c = `${f.league.id} ${f.league.name} (${f.league.country})`;
      vues.set(c, (vues.get(c) ?? 0) + 1);
    }
  }
  console.log(`\n« ${nom} » : ${(parNom.get(nom) ?? []).length} jugement(s), ${vues.size} compétition(s) réelle(s) sur ${ids.length} examinés`);
  for (const [c, n] of [...vues].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${c}`);
}
