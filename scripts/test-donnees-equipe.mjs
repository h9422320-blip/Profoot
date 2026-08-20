/**
 * LES STATISTIQUES D'ÉQUIPE ARRIVENT-ELLES ENCORE ?
 *
 * Le moteur, testé isolément, répond « 2-1, 44/27/29, confiance 76 » dès qu'il
 * ne reçoit AUCUNE statistique — c'est exactement ce que voient les abonnés
 * depuis le 19 août. La question n'est donc plus de savoir si le moteur calcule
 * bien, mais si les chiffres lui parviennent.
 *
 * Ce script refait, à la main et avec la vraie clé, le trajet exact que suit la
 * route d'analyse : trouver l'équipe, trouver son championnat, demander ses
 * statistiques de saison. Lecture seule.
 */
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const CLE = env.API_FOOTBALL_KEY;
if (!CLE) { console.log('Pas de API_FOOTBALL_KEY dans .env.local'); process.exit(1); }

const appel = async (chemin) => {
  const r = await fetch(`https://v3.football.api-sports.io${chemin}`, {
    headers: { 'x-apisports-key': CLE, 'x-rapidapi-host': 'v3.football.api-sports.io' },
  });
  const j = await r.json();
  return { http: r.status, erreurs: j?.errors, n: Array.isArray(j?.response) ? j.response.length : (j?.response ? 1 : 0), j };
};

/** La saison courante, calculée comme dans l'application. */
const saison = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 7 ? d.getFullYear() : d.getFullYear() - 1;
})();

console.log(`\n  Saison utilisée par l'application : ${saison}\n`);

for (const nom of ['Barcelona', 'Real Madrid', 'Liverpool']) {
  console.log(`  ── ${nom} ──────────────────────────────`);

  const rech = await appel(`/teams?search=${encodeURIComponent(nom)}`);
  const id = rech.j?.response?.[0]?.team?.id;
  console.log(`     recherche      : HTTP ${rech.http}, ${rech.n} résultat(s)  → id ${id ?? '—'}`);
  if (rech.erreurs && Object.keys(rech.erreurs).length) console.log(`     ERREURS        :`, JSON.stringify(rech.erreurs).slice(0, 160));
  if (!id) { console.log(''); continue; }

  const ligues = await appel(`/leagues?team=${id}&season=${saison}`);
  const ligue = ligues.j?.response?.find((l) => l.league?.type === 'League')?.league?.id
             ?? ligues.j?.response?.[0]?.league?.id;
  console.log(`     championnats   : ${ligues.n} trouvé(s)  → ligue ${ligue ?? '—'}`);
  if (ligues.erreurs && Object.keys(ligues.erreurs).length) console.log(`     ERREURS        :`, JSON.stringify(ligues.erreurs).slice(0, 160));
  if (!ligue) { console.log(`     ⚠ AUCUN CHAMPIONNAT POUR LA SAISON ${saison} → aucune statistique possible\n`); continue; }

  const st = await appel(`/teams/statistics?team=${id}&league=${ligue}&season=${saison}`);
  const g = st.j?.response?.goals;
  const joues = st.j?.response?.fixtures?.played?.total;
  console.log(`     statistiques   : HTTP ${st.http}`);
  console.log(`     matchs joués   : ${joues ?? '—'}`);
  console.log(`     buts marqués   : ${g?.for?.total?.total ?? '—'}`);
  console.log(`     buts encaissés : ${g?.against?.total?.total ?? '—'}`);
  if (st.erreurs && Object.keys(st.erreurs).length) console.log(`     ERREURS        :`, JSON.stringify(st.erreurs).slice(0, 160));

  const vide = !joues || joues === 0;
  console.log(`     ${vide ? '⚠ VIDE → le moteur sortira 2-1' : '✓ données présentes'}\n`);
}
