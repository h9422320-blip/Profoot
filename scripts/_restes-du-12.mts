/**
 * RESTE-T-IL UN MATCH DU 12 SEPTEMBRE NON CONFRONTÉ ?
 *
 * On part des analyses encore en attente, on lit leurs rencontres chez le
 * fournisseur et on regarde leur DATE. Une rencontre à venir a le droit
 * d'attendre ; une rencontre jouée le 12 et toujours en attente est un trou
 * dans le mur, et il faut savoir pourquoi.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { apiFootball } = await import('../src/lib/api-football.js');
const sb = createAdminClient();

const enAttente: any[] = [];
for (let de = 0; de < 4000; de += 1000) {
  const { data } = await sb
    .from('analysis_history')
    .select('id, fixture_id, team1_name, team2_name, score, created_at')
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .range(de, de + 999);
  if (!data?.length) break;
  enAttente.push(...data);
  if (data.length < 1000) break;
}
const avecId = [...new Set(enAttente.map((a) => a.fixture_id).filter(Boolean).map(String))];
const sansId = enAttente.filter((a) => !a.fixture_id);
console.log(`${enAttente.length} analyse(s) en attente ; ${avecId.length} rencontre(s) distincte(s) ; ${sansId.length} analyse(s) sans identifiant.`);

const parJour = new Map<string, number>();
const terminesDu12: string[] = [];
let lues = 0;
for (let i = 0; i < avecId.length; i += 20) {
  const paquet = avecId.slice(i, i + 20);
  const data: any = await apiFootball<any>(`/fixtures?ids=${paquet.join('-')}`, 300).catch(() => null);
  for (const f of data?.response ?? []) {
    lues++;
    const jour = String(f?.fixture?.date ?? '').slice(0, 10);
    const statut = String(f?.fixture?.status?.short ?? '?');
    parJour.set(`${jour} ${statut}`, (parJour.get(`${jour} ${statut}`) ?? 0) + 1);
    if (jour === '2026-09-12')
      terminesDu12.push(`#${f.fixture.id} ${f.teams?.home?.name} — ${f.teams?.away?.name} statut ${statut} buts ${f.goals?.home}-${f.goals?.away}`);
  }
  if (i % 100 === 0) process.stdout.write('.');
}
console.log(`\n${lues} rencontre(s) lue(s) chez le fournisseur.\n`);
console.log('── RÉPARTITION PAR JOUR ET STATUT (les 25 plus nombreux)');
for (const [k, v] of [...parJour].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`   ${k}  ${v}`);
console.log(`\n── RENCONTRES DU 12 SEPTEMBRE ENCORE EN ATTENTE : ${terminesDu12.length}`);
for (const l of terminesDu12) console.log('   ', l);
