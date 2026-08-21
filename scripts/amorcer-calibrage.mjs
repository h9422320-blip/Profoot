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
  { id: 253, nom: 'Major League Soccer' },
];

/**
 * ── LE BRÉSIL EST ÉCARTÉ, ET CE N'EST PAS UN OUBLI ───────────────────────
 *
 * Le championnat brésilien (identifiant 71) s'appelle « Serie A » chez le
 * fournisseur, exactement comme l'italien. Or le calibrage est rangé PAR NOM :
 * `calibrage_ligue.ligue` est la clé, et `facteursPour()` la retrouve avec le
 * seul `league.name`.
 *
 * Les deux se seraient donc mélangés dans une même ligne — 660 rencontres de
 * deux continents, deux calendriers et deux avantages du terrain confondus —
 * et le facteur obtenu aurait été appliqué aux matchs italiens comme aux
 * brésiliens. Un apprentissage qui mélange deux championnats n'apprend rien
 * sur aucun des deux.
 *
 * Le Brésil n'est pas perdu : il reprendra sa place le jour où le calibrage
 * sera rangé par pays ET par nom. En attendant, mieux vaut ne pas l'amorcer
 * que salir la Serie A italienne.
 */

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

/**
 * ── CE QUI A DÉJÀ ÉTÉ JUGÉ POUR DE VRAI NE SE REJOUE PAS ──────────────────
 *
 * `upsert` sur l'identifiant de rencontre écrasait tout ce qui portait le même
 * numéro — y compris les quatre-vingt-cinq jugements issus de VRAIES analyses,
 * celles réellement servies à des abonnés.
 *
 * Ce ne sont pas les mêmes chiffres. Une analyse réelle a vu la composition du
 * jour, les absents, le contexte ; le rejeu ne voit que les résultats passés.
 * Remplacer l'un par l'autre effacerait le seul relevé honnête de ce que le
 * moteur a vraiment servi — celui sur lequel s'appuie le mur de preuves.
 *
 * Les rencontres déjà jugées sont donc écartées. L'amorçage n'AJOUTE que ce
 * qui manquait.
 */
/**
 * ── CE QU'ON PRÉSERVE : LES VRAIES ANALYSES, ET ELLES SEULES ─────────────
 *
 * Le critère n'est PAS « déjà présent dans les jugements ». Ce filtre-là
 * écartait aussi les lignes écrites par un amorçage précédent — et le rejeu
 * ne pouvait donc plus jamais les compléter.
 *
 * Une rencontre analysée pour de vrai laisse une trace dans
 * `predictions_match` : c'est le pronostic figé qui a été servi à quelqu'un.
 * Une rencontre rejouée n'en laisse aucune. C'est la seule différence fiable
 * entre les deux, et c'est donc elle qui décide.
 *
 * Et la lecture se fait PAR TRANCHES : Supabase ne rend jamais plus de mille
 * lignes, sans lever la moindre erreur. Une liste tronquée ici aurait fait
 * passer des rejeux pour de vraies analyses.
 */
async function lireTout(requete, plafond = 20000) {
  const TRANCHE = 1000;
  const tout = [];
  for (let de = 0; de < plafond; de += TRANCHE) {
    const { data, error } = await requete(de, de + TRANCHE - 1);
    if (error) { console.log(`  lecture partielle : ${error.message}`); break; }
    if (!data?.length) break;
    tout.push(...data);
    if (data.length < TRANCHE) break;
  }
  return tout;
}

const vraies = await lireTout((de, a) =>
  sb.from('predictions_match').select('fixture_id').range(de, a)
);
const connus = new Set(vraies.map((p) => Number(p.fixture_id)).filter(Number.isFinite));
console.log(`  ${connus.size} rencontre(s) réellement analysée(s) : elles ne seront pas touchées.\n`);

const lignes = [];
let ignores = 0;
let preserves = 0;

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

    if (connus.has(Number(m.fixtureId))) {
      // Déjà jugée par une vraie analyse : on la laisse intacte.
      preserves++;
    } else if (vusDom >= HISTORIQUE_MINIMUM && vusExt >= HISTORIQUE_MINIMUM) {
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
          // Les buts ATTENDUS, sans lesquels le facteur se mesure contre un
          // arrondi et sature sa borne haute dans tous les championnats.
          buts_attendus_domicile: r.butsAttendus1 ?? null,
          buts_attendus_exterieur: r.butsAttendus2 ?? null,
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
if (preserves) console.log(`  (${preserves} laissées intactes : déjà jugées par une vraie analyse)`);

if (!ECRIRE) {
  console.log('\n  SIMULATION. Relancez avec --ecrire pour amorcer la boucle.\n');
  process.exit(0);
}

// ── ÉCRITURE ───────────────────────────────────────────────────────────────
//
// `upsert` sur l'identifiant de rencontre : une rencontre déjà jugée par la
// boucle normale n'est pas dupliquée, elle est mise à jour.
let ecrites = 0;
let sansColonnes = false;

for (let i = 0; i < lignes.length; i += 200) {
  const lot = lignes.slice(i, i + 200);
  const alleger = (l) => {
    const { buts_attendus_domicile, buts_attendus_exterieur, ...reste } = l;
    return reste;
  };

  let { error } = await sb
    .from('jugements_moteur')
    .upsert(sansColonnes ? lot.map(alleger) : lot, { onConflict: 'fixture_id' });

  // Les colonnes `buts_attendus_*` s'ajoutent par une commande SQL que le
  // propriétaire passe lui-même. Absentes, la base refuse tout le lot. Les
  // jugements valent d'être écrits même sans elles : le relevé historique est
  // l'essentiel, la finesse de mesure vient après.
  if (error && /buts_attendus/.test(error.message)) {
    sansColonnes = true;
    ({ error } = await sb
      .from('jugements_moteur')
      .upsert(lot.map(alleger), { onConflict: 'fixture_id' }));
  }

  if (error) console.log(`  lot refusé : ${error.message}`);
  else ecrites += lot.length;
}

if (sansColonnes)
  console.log(
    `\n  ⚠ Colonnes buts_attendus_* absentes : les jugements sont écrits sans elles.\n` +
      `    Passez supabase/jugements-buts-attendus.sql, puis relancez ce script\n` +
      `    pour que le calibrage se mesure sur les buts attendus et non sur un arrondi.`
  );
console.log(`\n  ${ecrites} jugement(s) enregistré(s).`);

const { recalculerCalibrages } = await jiti.import('../src/lib/calibrage.ts');
const r = await recalculerCalibrages();
console.log(`  Calibrage recalculé : ${r.ligues} championnat(s), ${r.matchs} rencontre(s).\n`);
