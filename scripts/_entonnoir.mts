/** L'entonnoir de vente aujourd'hui : qui clique, qui part en caisse. */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const jour = new Date().toISOString().slice(0, 10);
const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const lignes: any[] = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data, error } = await sb.from('visites_pages').select('chemin, entre_le')
    .gte('entre_le', hier + 'T00:00:00Z').like('chemin', '/~%').range(de, de + 999);
  if (error) { console.log('ERREUR :', error.message); break; }
  if (!data?.length) break;
  lignes.push(...data);
  if (data.length < 1000) break;
}
console.log(`${lignes.length} étape(s) de vente relevée(s) depuis hier.\n`);

for (const j of [hier, jour]) {
  const duJour = lignes.filter((l) => String(l.entre_le).slice(0, 10) === j);
  const parEtape = new Map<string, number>();
  for (const l of duJour) {
    const etape = String(l.chemin).split('/')[1] ?? '?';
    parEtape.set(etape, (parEtape.get(etape) ?? 0) + 1);
  }
  console.log(`── ${j} : ${duJour.length} étape(s)`);
  for (const [e, n] of [...parEtape].sort((a, b) => b[1] - a[1])) console.log(`   ${e.padEnd(22)} ${n}`);

  // Et l'heure par heure des départs en caisse.
  const departs = duJour.filter((l) => String(l.chemin).startsWith('/~depart-caisse'));
  const parHeure = new Map<string, number>();
  for (const l of departs) {
    const h = String(l.entre_le).slice(11, 13);
    parHeure.set(h, (parHeure.get(h) ?? 0) + 1);
  }
  console.log(`   départs en caisse par heure : ${[...parHeure].sort().map(([h, n]) => `${h}h:${n}`).join('  ') || 'aucun'}\n`);
}
