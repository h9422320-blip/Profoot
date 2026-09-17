// La fiche d'une rencontre chez le fournisseur : date, statut, score.
//   npx tsx scripts/_fiche-d-un-match.mts <fixture_id> [...]
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { apiFootball } = await import('../src/lib/api-football.js');
for (const id of process.argv.slice(2)) {
  const d = await apiFootball<any>(`/fixtures?id=${id}`, 60);
  const f = d?.response?.[0];
  console.log(id, f ? `${f.fixture.date} ${f.fixture.status.short} ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} · ${f.league.name}` : 'introuvable');
}
