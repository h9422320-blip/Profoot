/**
 * VALIDATION DU MOTEUR LIVRÉ.
 *
 * Ce banc n'évalue pas une réécriture approchante : il importe `calculerForces`
 * et `calculerScoreProbable` du code réel, et les met à l'épreuve sur des
 * saisons entières. Ce qui est mesuré ici est exactement ce qui tourne.
 *
 * Deux périodes séparées, parce qu'elles ne posent pas le même problème :
 *   — les cinq premières journées, quand une équipe n'a presque pas joué ;
 *   — le reste de la saison, quand les données abondent.
 */
import fs from 'fs';
import { createJiti } from 'jiti';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

const jiti = createJiti(import.meta.url);
const { apiFootball, CACHE_TTL } = await jiti.import('../src/lib/api-football.ts');
const { calculerForces } = await jiti.import('../src/lib/forces-equipes.ts');
const { calculerScoreProbable } = await jiti.import('../src/lib/score-probable.ts');

const LIGUES = [
  [39, 'Premier League'], [140, 'La Liga'], [135, 'Serie A'], [78, 'Bundesliga'],
  [61, 'Ligue 1'], [94, 'Primeira Liga'], [88, 'Eredivisie'], [144, 'Jupiler Pro League'],
  [203, 'Süper Lig'], [179, 'Premiership'],
];
const TERMINE = ['FT', 'AET', 'PEN'];

async function matchsDe(ligue, an) {
  const d = await apiFootball(`/fixtures?league=${ligue}&season=${an}`, CACHE_TTL.TEAM_INFO);
  return (d?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      date: new Date(f.fixture.date).getTime(),
      domicile: f.teams.home.id, exterieur: f.teams.away.id,
      butsDomicile: Number(f.goals.home ?? 0), butsExterieur: Number(f.goals.away ?? 0),
    }))
    .sort((a, b) => a.date - b.date);
}

const res = {};
const noter = (periode, nom, m, buts1, buts2) => {
  const cle = `${periode}|${nom}`;
  const s = (res[cle] ??= { n: 0, ok: 0, exact: 0, buts: 0, reels: 0 });
  const iP = buts1 > buts2 ? 1 : buts1 === buts2 ? 0 : 2;
  const iR = m.butsDomicile > m.butsExterieur ? 1 : m.butsDomicile === m.butsExterieur ? 0 : 2;
  s.n++;
  if (iP === iR) s.ok++;
  if (buts1 === m.butsDomicile && buts2 === m.butsExterieur) s.exact++;
  s.buts += buts1 + buts2;
  s.reels += m.butsDomicile + m.butsExterieur;
};

/** Les statistiques brutes telles que l'ancien chemin les reçoit. */
function brutes(historique) {
  return {
    butsMarques: historique.pour,
    butsEncaisses: historique.contre,
    matchsJoues: historique.j,
  };
}

for (const [ligue, nom] of LIGUES) {
  const passee = await matchsDe(ligue, 2024);
  const courante = await matchsDe(ligue, 2025);
  if (passee.length < 50 || !courante.length) { console.log(`  ${nom} — ignoré (pas assez d'histoire)`); continue; }

  const joues = new Map();
  const ecoulees = [];

  for (const m of courante) {
    const hD = joues.get(m.domicile) ?? { j: 0, pour: 0, contre: 0 };
    const hE = joues.get(m.exterieur) ?? { j: 0, pour: 0, contre: 0 };
    const periode = Math.min(hD.j, hE.j) <= 4 ? 'DÉBUT DE SAISON' : 'RESTE DE LA SAISON';

    // Les forces telles que le moteur les calculerait ce jour-là : la saison
    // passée en entier, et de la saison en cours uniquement ce qui est joué.
    const forces = calculerForces(passee, ecoulees);
    const f1 = forces.equipes.get(m.domicile);
    const f2 = forces.equipes.get(m.exterieur);

    // ── L'ancien chemin : aucune force transmise ────────────────────────────
    const avant = calculerScoreProbable(brutes(hD), brutes(hE), true, false);
    noter(periode, 'avant  (moyennes brutes)', m, avant.buts1, avant.buts2);

    // ── Le nouveau, TEL QU'IL TOURNERA ──────────────────────────────────────
    //
    // Un promu n'a pas de saison passée DANS CE CHAMPIONNAT : il n'a pas de
    // socle. Le mesurer en écartant ces rencontres flatterait le résultat. On
    // reprend donc l'ancien chemin pour elles, exactement comme le fera la
    // production.
    if (f1 && f2) {
      const apres = calculerScoreProbable(brutes(hD), brutes(hE), true, false, undefined, {
        equipe1: f1, equipe2: f2,
        butsDomicile: forces.butsDomicile, butsExterieur: forces.butsExterieur,
      });
      noter(periode, 'après  (forces, repli compris)', m, apres.buts1, apres.buts2);
    } else {
      noter(periode, 'après  (forces, repli compris)', m, avant.buts1, avant.buts2);
    }

    // Variante : donner au promu une force neutre plutôt que de le renvoyer à
    // l'ancien calcul. À vérifier plutôt qu'à supposer.
    const n1 = f1 ?? { attaque: 1, defense: 1, matchs: 0 };
    const n2 = f2 ?? { attaque: 1, defense: 1, matchs: 0 };
    const neutre = calculerScoreProbable(brutes(hD), brutes(hE), true, false, undefined, {
      equipe1: n1, equipe2: n2,
      butsDomicile: forces.butsDomicile, butsExterieur: forces.butsExterieur,
    });
    noter(periode, 'variante : promu = force neutre', m, neutre.buts1, neutre.buts2);

    noter(periode, 'repère (toujours le domicile)', m, 2, 1);

    hD.j++; hD.pour += m.butsDomicile; hD.contre += m.butsExterieur; joues.set(m.domicile, hD);
    hE.j++; hE.pour += m.butsExterieur; hE.contre += m.butsDomicile; joues.set(m.exterieur, hE);
    ecoulees.push(m);
  }
  console.log(`  ${nom.padEnd(20)} ${courante.length} matchs rejoués`);
}

for (const periode of ['DÉBUT DE SAISON', 'RESTE DE LA SAISON']) {
  console.log(`\n================ ${periode} ================`);
  for (const [cle, s] of Object.entries(res)) {
    if (!cle.startsWith(periode + '|')) continue;
    console.log(
      `  ${cle.split('|')[1].padEnd(32)} ${String(s.n).padStart(4)} matchs | issue ${((100 * s.ok) / s.n).toFixed(1).padStart(5)} % | score exact ${((100 * s.exact) / s.n).toFixed(1).padStart(5)} % | buts ${(s.buts / s.n).toFixed(2)} (réel ${(s.reels / s.n).toFixed(2)})`
    );
  }
}
