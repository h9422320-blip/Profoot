// Lecture seule : sur les prochains matchs des cinq grands championnats,
// les nouvelles couches se déclenchent-elles vraiment ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { absencesPourLeMatch, lirePoidsDesJoueurs, composerLaCouche, CINQ_GRANDS } = await import('../src/lib/forces-absences.js');
const { lireEntraineurs, partDeLEntraineurNeuf, joursDepuisLArrivee } = await import('../src/lib/entraineurs.js');
const { avisDuMarchePour } = await import('../src/lib/couche-marche.js');
const cle = process.env.API_FOOTBALL_KEY!;
const [poids, entraineurs] = await Promise.all([lirePoidsDesJoueurs(), lireEntraineurs()]);
console.log(
  'réserves :',
  poids ? `${Object.values(poids.saisons).reduce((t, x) => t + x.split(',').length, 0)} joueurs pesés` : 'AUCUN POIDS',
  '·',
  entraineurs ? `${Object.keys(entraineurs.clubs).length} clubs suivis` : 'AUCUN ENTRAÎNEUR'
);
for (let d = 0; d <= 3; d++) {
  const jour = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': cle } });
  const j: any = await r.json();
  for (const f of (j.response ?? []).filter((x: any) => CINQ_GRANDS.has(Number(x?.league?.id)))) {
    const ligue = Number(f.league.id), saison = Number(f.league.season);
    const dom = Number(f.teams.home.id), ext = Number(f.teams.away.id);
    const abs = await absencesPourLeMatch(f.fixture.id, ligue, saison, dom, ext, poids);
    const cDom = partDeLEntraineurNeuf(entraineurs, ligue, dom, f.fixture.date);
    const cExt = partDeLEntraineurNeuf(entraineurs, ligue, ext, f.fixture.date);
    const couche = composerLaCouche(abs, cDom, cExt);
    const marche = await avisDuMarchePour(f.fixture.id, f.fixture.date, ligue);
    if (!couche && !marche) continue;
    console.log(
      `${String(f.fixture.date).slice(0, 16)} ${f.teams.home.name} — ${f.teams.away.name}`,
      couche ? `· absents/entraîneur ${(100 * couche.domicile).toFixed(1)}% / ${(100 * couche.exterieur).toFixed(1)}%` : '· aucune absence pesée',
      cDom || cExt ? `(entraîneur neuf : ${cDom ? f.teams.home.name : ''}${cExt ? ' ' + f.teams.away.name : ''}, ${joursDepuisLArrivee(entraineurs, cDom ? dom : ext, f.fixture.date)} j)` : '',
      marche ? `· marché ${(100 * marche.dom).toFixed(0)}/${(100 * marche.ext).toFixed(0)} part ${marche.poids}` : '· pas de cote'
    );
  }
}
