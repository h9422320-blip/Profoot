/**
 * Réécrit le nom de compétition des jugements déjà enregistrés pour qu'il porte
 * son pays — « Cup » devient « Cup (Grèce) », « Bundesliga » d'Autriche devient
 * « Bundesliga (Autriche) ».
 *
 * Sans cette réparation, le calibrage reparti sous les nouveaux noms perdrait
 * toute la matière accumulée, et les facteurs appris s'éteindraient.
 *
 *   npx tsx scripts/_reparer-noms-de-jugements.mts            (essai à blanc)
 *   npx tsx scripts/_reparer-noms-de-jugements.mts --ecrire   (répare)
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { apiFootball } = await import('../src/lib/api-football.js');
const { cleDeCompetition } = await import('../src/lib/nom-de-competition.js');
const sb = createAdminClient();
const ecrire = process.argv.includes('--ecrire');

const lignes: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('jugements_moteur').select('fixture_id, ligue').range(de, de + 999);
  if (error) throw error;
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`jugements : ${lignes.length}`);

const ids = lignes.map((l) => Number(l.fixture_id)).filter(Boolean);
const nomDe = new Map<number, string | null>();
for (let i = 0; i < ids.length; i += 20) {
  const d = await apiFootball<any>(`/fixtures?ids=${ids.slice(i, i + 20).join('-')}`, 7 * 24 * 3600_000);
  for (const f of d?.response ?? []) nomDe.set(Number(f.fixture.id), cleDeCompetition(f.league?.name, f.league?.country));
  if (i % 400 === 0) process.stdout.write(`\r  ${i}/${ids.length} fiches lues`);
}
console.log('');

let aChanger = 0;
const changements = new Map<string, number>();
const aEcrire: { fixture_id: number; ligue: string }[] = [];
for (const l of lignes) {
  const neuf = nomDe.get(Number(l.fixture_id));
  if (!neuf || neuf === l.ligue) continue;
  aChanger++;
  const k = `${l.ligue} → ${neuf}`;
  changements.set(k, (changements.get(k) ?? 0) + 1);
  aEcrire.push({ fixture_id: Number(l.fixture_id), ligue: neuf });
}
console.log(`à renommer : ${aChanger}`);
for (const [k, n] of [...changements].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(4)}  ${k}`);

if (!ecrire) {
  console.log('\nessai à blanc : rien n’a été écrit. Relancer avec --ecrire.');
  process.exit(0);
}
// Une mise à jour par NOM, et non par rencontre : quatre mille écritures une
// par une prennent des minutes et échouent en silence — mesuré le 17 septembre
// 2026, 411 abouties sur 4 081.
const parNouveauNom = new Map<string, number[]>();
for (const c of aEcrire) parNouveauNom.set(c.ligue, [...(parNouveauNom.get(c.ligue) ?? []), c.fixture_id]);
let faits = 0;
let echecs = 0;
for (const [nom, ids] of parNouveauNom) {
  for (let i = 0; i < ids.length; i += 200) {
    const lot = ids.slice(i, i + 200);
    // Trois essais : la base coupe parfois la connexion en plein lot, et une
    // réparation à moitié faite laisse le calibrage incohérent.
    let ok = false;
    let dernier = '';
    for (let essai = 1; essai <= 3 && !ok; essai++) {
      const { error } = await sb.from('jugements_moteur').update({ ligue: nom }).in('fixture_id', lot);
      if (!error) { ok = true; break; }
      dernier = error.message;
      await new Promise((r) => setTimeout(r, 2000 * essai));
    }
    if (ok) faits += lot.length;
    else { echecs += lot.length; console.warn(`  échec « ${nom} » : ${dernier}`); }
  }
}
console.log(`renommés : ${faits}/${aEcrire.length}${echecs ? ` · ${echecs} en échec` : ''}`);
