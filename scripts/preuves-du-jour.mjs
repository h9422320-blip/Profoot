/**
 * CE QUE LE MUR PUBLIERA POUR UN JOUR DONNÉ — AVANT DE LE PUBLIER.
 *
 * Diagnostic seul : rien n'est écrit, rien n'est publié.
 *
 *     node scripts/preuves-du-jour.mjs 2026-08-25
 *
 * ── POURQUOI CE SCRIPT EXISTE À CÔTÉ DE `preuves-du-24.mjs` ───────────────
 *
 * L'ancien relevé jugeait sur la PREMIÈRE analyse de chaque rencontre. Le mur,
 * lui, juge sur ce qu'il AFFICHE : la prédiction de référence figée au premier
 * calcul complet, et à défaut le pronostic majoritaire, réorienté dans le sens
 * de la carte. Les deux comptes divergent — le 24 août 2026, un total de 11 a
 * été annoncé au propriétaire pour un mur qui en publiait 12.
 *
 * Un chiffre annoncé qui ne correspond pas à ce qu'on voit sur le site abîme
 * exactement ce que ce mur doit construire. Ce script emploie donc les
 * fonctions du mur lui-même, importées, jamais recopiées : si le mur change de
 * règle, le relevé change avec lui.
 *
 * ── POURQUOI LA DATE VIENT DU FOURNISSEUR ─────────────────────────────────
 *
 * `analysis_data.date` est une chaîne française — « 23 août 2026 » — que rien
 * ne sait comparer, et elle manque souvent. La date de création ne vaut pas
 * non plus : on analyse un match plusieurs jours à l'avance. Seule la fiche de
 * la rencontre, lue par son identifiant, dit quand elle s'est jouée.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });

// Les règles du mur, telles quelles.
const { inverserScore, pronoDansLeSensDeLaCarte, issue, lireScore, produiteParUneVersionDefectueuse } =
  await jiti.import('./src/lib/preuves.ts');
const { lirePredictionBrute } = await jiti.import('./src/lib/prediction-figee.ts');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const K = process.env.API_FOOTBALL_KEY;
const api = async (u) => {
  const r = await fetch('https://v3.football.api-sports.io' + u, { headers: { 'x-apisports-key': K } });
  return r.json();
};

const JOUR = process.argv[2] ?? new Date().toISOString().slice(0, 10);

// ── Toutes les analyses vérifiées portant un identifiant de rencontre ─────
const analyses = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb
    .from('analysis_history')
    .select(
      'fixture_id, team1_name, team2_name, competition, score, real_score, real_winner, ' +
        'predicted_winner, winner_correct, score_correct, confidence, created_at, verified_at'
    )
    .not('fixture_id', 'is', null)
    .not('verified_at', 'is', null)
    .order('verified_at', { ascending: false })
    .range(de, de + 999);
  if (error) {
    console.log('  erreur : ' + error.message);
    break;
  }
  if (!data?.length) break;
  analyses.push(...data);
  if (data.length < 1000) break;
}

// ── Regroupement, à l'identique du mur ───────────────────────────────────
//
// La première ligne rencontrée (la plus récemment vérifiée) donne le sens de
// la carte ; toutes les autres sont réorientées sur elle. Les analyses issues
// d'une version défectueuse sont mises de côté, et reprises seulement si elles
// sont les seules.
const parMatch = new Map();
for (const l of analyses) {
  const cle = String(l.fixture_id);
  const m = parMatch.get(cle) ?? {
    ligne: l,
    total: 0,
    scores: new Map(),
    ecartees: 0,
    secours: { total: 0, scores: new Map() },
  };

  const memeSens =
    String(l.team1_name ?? '').toLowerCase() === String(m.ligne.team1_name ?? '').toLowerCase();
  const scoreOriente = memeSens ? l.score : inverserScore(l.score);

  const cible = produiteParUneVersionDefectueuse(l.created_at) ? m.secours : m;
  if (cible === m.secours) m.ecartees++;
  cible.total++;
  if (scoreOriente) cible.scores.set(scoreOriente, (cible.scores.get(scoreOriente) ?? 0) + 1);

  parMatch.set(cle, m);
}
for (const m of parMatch.values()) {
  if (m.total === 0 && m.secours.total > 0) {
    m.total = m.secours.total;
    m.scores = m.secours.scores;
    m.ecartees = 0;
  }
}

console.log(`\n  ${analyses.length} analyses vérifiées lues, sur ${parMatch.size} rencontres distinctes.`);

// ── La vraie date de chaque rencontre, chez le fournisseur ────────────────
const ids = [...parMatch.keys()];
const fiches = new Map();
for (let i = 0; i < ids.length; i += 20) {
  const r = await api(`/fixtures?ids=${ids.slice(i, i + 20).join('-')}`);
  for (const f of r?.response ?? []) {
    fiches.set(String(f.fixture.id), {
      date: String(f.fixture.date).slice(0, 10),
      statut: String(f.fixture?.status?.short ?? ''),
      competition: f.league?.name,
    });
  }
  process.stdout.write(`\r  fiches lues : ${fiches.size} / ${ids.length}`);
}
console.log('');

// ── Le verdict du mur, rencontre par rencontre ───────────────────────────
const TERMINES = new Set(['FT', 'AET', 'PEN']);
const duJour = [];
for (const [id, m] of parMatch) {
  const f = fiches.get(id);
  if (!f || f.date !== JOUR) continue;
  duJour.push({ id, ...m, fiche: f });
}

const cartes = [];
for (const m of duJour) {
  const l = m.ligne;

  const figee = await lirePredictionBrute(Number(m.id));
  const pronoDeReference = figee ? pronoDansLeSensDeLaCarte(figee, l.team1_name) : null;
  const majoritaire = [...m.scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const pronoScore = pronoDeReference ?? majoritaire ?? l.score ?? null;

  const buts = lireScore(pronoScore);
  const reels = lireScore(l.real_score);
  const issuePredite = buts ? issue(buts[0], buts[1]) : null;
  const issueReelle = reels ? issue(reels[0], reels[1]) : null;

  cartes.push({
    ...m,
    pronoScore,
    origine: pronoDeReference ? 'référence figée' : majoritaire ? 'majorité' : 'unique',
    issuePredite,
    issueReelle,
    reussite: !!issuePredite && !!issueReelle && issuePredite === issueReelle,
    scoreExact:
      !!buts && !!reels && buts[0] === reels[0] && buts[1] === reels[1] && issuePredite === issueReelle,
  });
}

const termines = cartes.filter((c) => TERMINES.has(c.fiche.statut));
const jugeables = termines.filter((c) => c.issuePredite && c.issueReelle);
const reussis = jugeables.filter((c) => c.reussite);
const rates = jugeables.filter((c) => !c.reussite);

const mot = (v) =>
  v === 'team1' ? 'victoire 1' : v === 'team2' ? 'victoire 2' : v === 'draw' ? 'match nul' : '?';

console.log(`\n${'═'.repeat(74)}`);
console.log(`  LE ${JOUR} — CE QUE LE MUR PUBLIERA`);
console.log('═'.repeat(74) + '\n');
console.log(`  Rencontres analysées jouées ce jour-là ..... ${cartes.length}`);
console.log(`  dont terminées ............................ ${termines.length}`);
console.log(`  dont jugeables (pronostic ET résultat) .... ${jugeables.length}`);
console.log(`  RÉUSSIES .................................. ${reussis.length}`);
if (jugeables.length) {
  console.log(
    `\n  Taux de réussite du jour : ${Math.round((reussis.length / jugeables.length) * 1000) / 10} %`
  );
}
const exacts = reussis.filter((c) => c.scoreExact).length;
if (exacts) console.log(`  Dont score exact : ${exacts}`);

if (reussis.length) {
  console.log(`\n${'═'.repeat(74)}`);
  console.log('  LES RÉUSSITES, UNE PAR UNE');
  console.log('═'.repeat(74) + '\n');
  for (const c of reussis.sort((a, b) => (b.ligne.confidence ?? 0) - (a.ligne.confidence ?? 0))) {
    const l = c.ligne;
    console.log(`  ${l.team1_name} — ${l.team2_name}`);
    console.log(`     competition ...... ${l.competition ?? c.fiche.competition ?? '—'}`);
    console.log(
      `     pronostic ........ ${String(c.pronoScore ?? '—').padEnd(9)} (${mot(c.issuePredite)})  [${c.origine}]`
    );
    console.log(`     score reel ....... ${l.real_score ?? '—'}  →  ${mot(c.issueReelle)}`);
    console.log(`     score exact ...... ${c.scoreExact ? 'OUI' : 'non'}`);
    console.log(`     confiance ........ ${l.confidence ?? '—'} %`);
    console.log(`     analyses ......... ${c.total}${c.ecartees ? ` (+${c.ecartees} écartée(s))` : ''}`);
    console.log('');
  }
}

if (rates.length) {
  console.log(`${'═'.repeat(74)}`);
  console.log(`  LES ${rates.length} RATÉS DU MÊME JOUR — pour que le compte soit honnête`);
  console.log('═'.repeat(74) + '\n');
  for (const c of rates) {
    console.log(
      `  ${(c.ligne.team1_name + ' — ' + c.ligne.team2_name).padEnd(42)} annonce ${String(
        c.pronoScore ?? '—'
      ).padEnd(8)} · reel ${c.ligne.real_score ?? '—'}`
    );
  }
  console.log('');
}
