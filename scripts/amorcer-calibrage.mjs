/**
 * AMORCER LA BOUCLE D'APPRENTISSAGE AVEC L'HISTOIRE RÉELLE.
 *
 * LE PROBLÈME QU'IL RÉSOUT
 *
 * La boucle n'apprend que des rencontres qu'un abonné a effectivement
 * analysées. Au 21 août 2026 : quatre-vingt-cinq rencontres jugées, réparties
 * sur vingt-quatre championnats — trois pour La Liga, deux pour la Premier
 * League. Le calibrage n'agit qu'à partir de trente par championnat, et gagne
 * une ou deux rencontres par jour. Il faudrait donc attendre trois à quatre
 * semaines par championnat, et bien davantage pour les petits.
 *
 * Or le moteur peut être jugé sur N'IMPORTE QUELLE rencontre passée. Une saison
 * complète en fournit des milliers.
 *
 * CE QUI REND CE REJEU HONNÊTE
 *
 * On avance journée après journée. Pour chaque rencontre, le moteur ne reçoit
 * QUE les matchs déjà joués à cette date — jamais la suite. C'est exactement la
 * situation d'un abonné qui analyse la veille. Un rejeu qui verrait le futur
 * donnerait des chiffres flatteurs et un calibrage faux.
 *
 * ET SURTOUT : LE VRAI MOTEUR
 *
 * `banc-large.mjs` réimplémente le calcul des forces. Ce script-ci importe
 * `forces-equipes.ts` et `score-probable.ts` — le code qui tourne réellement en
 * production. Un calibrage mesuré sur une copie corrigerait des biais que le
 * moteur n'a pas.
 *
 * SIMULATION PAR DÉFAUT. Écrit seulement avec `--ecrire`.
 */
import fs from 'fs';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';

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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ECRIRE = process.argv.includes('--ecrire');

/**
 * Les championnats amorcés, et leur nom EXACT chez le fournisseur.
 *
 * Le nom est la clé du calibrage : il doit correspondre au libellé que
 * `league.name` renvoie en production, sans quoi le calibrage s'écrirait sous
 * une clé que le moteur ne relira jamais.
 */
const LIGUES = [
  { id: 39, nom: 'Premier League' },
  { id: 140, nom: 'La Liga' },
  { id: 135, nom: 'Serie A' },
  { id: 78, nom: 'Bundesliga' },
  { id: 61, nom: 'Ligue 1' },
  { id: 94, nom: 'Primeira Liga' },
  { id: 88, nom: 'Eredivisie' },
  { id: 144, nom: 'Jupiler Pro League' },
  { id: 71, nom: 'Serie A' },          // Brésil — même libellé, voir plus bas
  { id: 253, nom: 'Major League Soccer' },
];

const SAISON = 2025;
const TERMINE = ['FT', 'AET', 'PEN'];

/** Rencontres déjà jouées avant d'accepter de prédire. */
const HISTORIQUE_MINIMUM = 5;

const issueDe = (a, b) => (a > b ? 'domicile' : a === b ? 'nul' : 'exterieur');
const brierDe = (p, reelle) => {
  const n = (v) => Math.min(1, Math.max(0, Number(v) / 100));
  const d = n(p.domicile), u = n(p.nul), e = n(p.exterieur);
  return (
    (d - (reelle === 'domicile' ? 1 : 0)) ** 2 +
    (u - (reelle === 'nul' ? 1 : 0)) ** 2 +
    (e - (reelle === 'exterieur' ? 1 : 0)) ** 2
  );
};

console.log(`\n  ══ AMORÇAGE DU CALIBRAGE — saison ${SAISON} ══\n`);

const lignes = [];
let ignores = 0;

for (const ligue of LIGUES) {
  let brut;
  try {
    brut = await apiFootball(`/fixtures?league=${ligue.id}&season=${SAISON}`, CACHE_TTL.TEAM_INFO);
  } catch (e) {
    console.log(`  ${ligue.nom.padEnd(24)} fournisseur muet (${e.message})`);
    continue;
  }

  const matchs = (brut?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      fixtureId: f.fixture.id,
      date: new Date(f.fixture.date).getTime(),
      dateIso: f.fixture.date,
      domicile: f.teams.home.id,
      exterieur: f.teams.away.id,
      nomDom: f.teams.home.name,
      nomExt: f.teams.away.name,
      butsDomicile: Number(f.goals.home ?? 0),
      butsExterieur: Number(f.goals.away ?? 0),
      // Le nom RÉEL du championnat chez le fournisseur : c'est lui qui doit
      // servir de clé, jamais celui qu'on a écrit dans la liste ci-dessus.
      ligue: f.league?.name ?? ligue.nom,
    }))
    .sort((a, b) => a.date - b.date);

  if (!matchs.length) {
    console.log(`  ${ligue.nom.padEnd(24)} aucune rencontre terminée`);
    continue;
  }

  // ── ON AVANCE DANS LE TEMPS, SANS JAMAIS REGARDER DEVANT ────────────────
  const joues = [];
  const comptes = new Map();
  let juges = 0;

  for (const m of matchs) {
    const vusDom = comptes.get(m.domicile) ?? 0;
    const vusExt = comptes.get(m.exterieur) ?? 0;

    if (vusDom >= HISTORIQUE_MINIMUM && vusExt >= HISTORIQUE_MINIMUM) {
      // `joues` ne contient QUE ce qui précède cette rencontre.
      const forces = calculerForces([], joues);
      const fDom = forces.equipes.get(m.domicile);
      const fExt = forces.equipes.get(m.exterieur);

      if (fDom && fExt) {
        const stats = (id) => {
          let pour = 0, contre = 0, n = 0;
          for (const j of joues) {
            if (j.domicile === id) { pour += j.butsDomicile; contre += j.butsExterieur; n++; }
            else if (j.exterieur === id) { pour += j.butsExterieur; contre += j.butsDomicile; n++; }
          }
          return { butsMarques: pour, butsEncaisses: contre, matchsJoues: n };
        };

        const r = calculerScoreProbable(
          stats(m.domicile),
          stats(m.exterieur),
          true,
          false,
          undefined,
          {
            equipe1: fDom,
            equipe2: fExt,
            butsDomicile: forces.butsDomicile,
            butsExterieur: forces.butsExterieur,
          }
        );

        const ip = issueDe(r.buts1, r.buts2);
        const ir = issueDe(m.butsDomicile, m.butsExterieur);

        lignes.push({
          fixture_id: m.fixtureId,
          ligue: m.ligue,
          date_match: m.dateIso,
          equipe_domicile: m.nomDom,
          equipe_exterieur: m.nomExt,
          buts_prevus_domicile: r.buts1,
          buts_prevus_exterieur: r.buts2,
          proba_domicile: r.probaVictoire1,
          proba_nul: r.probaNul,
          proba_exterieur: r.probaVictoire2,
          confiance: r.confiance,
          buts_reels_domicile: m.butsDomicile,
          buts_reels_exterieur: m.butsExterieur,
          issue_prevue: ip,
          issue_reelle: ir,
          issue_juste: ip === ir,
          score_exact: r.buts1 === m.butsDomicile && r.buts2 === m.butsExterieur,
          brier: brierDe(
            { domicile: r.probaVictoire1, nul: r.probaNul, exterieur: r.probaVictoire2 },
            ir
          ),
          juge_le: new Date().toISOString(),
        });
        juges++;
      } else ignores++;
    }

    joues.push(m);
    comptes.set(m.domicile, vusDom + 1);
    comptes.set(m.exterieur, vusExt + 1);
  }

  console.log(`  ${ligue.nom.padEnd(24)} ${String(matchs.length).padStart(4)} matchs → ${String(juges).padStart(4)} jugés`);
}

if (!lignes.length) {
  console.log('\n  Aucune rencontre jugée. Rien à écrire.\n');
  process.exit(0);
}

// ── CE QUE ÇA DONNE ────────────────────────────────────────────────────────
const parLigue = new Map();
for (const l of lignes) {
  const a = parLigue.get(l.ligue) ?? { n: 0, justes: 0, exacts: 0 };
  a.n++; if (l.issue_juste) a.justes++; if (l.score_exact) a.exacts++;
  parLigue.set(l.ligue, a);
}

console.log(`\n  ══ CE QUE LE MOTEUR AURAIT FAIT, CHAMPIONNAT PAR CHAMPIONNAT ══\n`);
console.log(`  championnat                    jugés   justes   exacts   calibrage`);
console.log(`  ---------------------------------------------------------------`);
for (const [nom, a] of [...parLigue].sort((x, y) => y[1].n - x[1].n))
  console.log(
    `  ${nom.slice(0, 28).padEnd(29)} ${String(a.n).padStart(5)}   ${((100 * a.justes) / a.n).toFixed(1).padStart(5)} %  ${((100 * a.exacts) / a.n).toFixed(1).padStart(5)} %   ${a.n >= 30 ? 'ACTIF' : 'non'}`
  );

const justes = lignes.filter((l) => l.issue_juste).length;
const exacts = lignes.filter((l) => l.score_exact).length;
console.log(`\n  TOTAL : ${lignes.length} rencontres — ${((100 * justes) / lignes.length).toFixed(1)} % d'issues justes, ${((100 * exacts) / lignes.length).toFixed(1)} % de scores exacts`);
if (ignores) console.log(`  (${ignores} écartées : forces indisponibles)`);

if (!ECRIRE) {
  console.log('\n  SIMULATION. Relancez avec --ecrire pour amorcer la boucle.\n');
  process.exit(0);
}

// ── ÉCRITURE ───────────────────────────────────────────────────────────────
//
// `upsert` sur l'identifiant de rencontre : une rencontre déjà jugée par la
// boucle normale n'est pas dupliquée, elle est mise à jour.
let ecrites = 0;
for (let i = 0; i < lignes.length; i += 200) {
  const { error } = await sb
    .from('jugements_moteur')
    .upsert(lignes.slice(i, i + 200), { onConflict: 'fixture_id' });
  if (error) console.log(`  lot refusé : ${error.message}`);
  else ecrites += Math.min(200, lignes.length - i);
}
console.log(`\n  ${ecrites} jugement(s) enregistré(s).`);

const { recalculerCalibrages } = await jiti.import('../src/lib/calibrage.ts');
const r = await recalculerCalibrages();
console.log(`  Calibrage recalculé : ${r.ligues} championnat(s), ${r.matchs} rencontre(s).\n`);
