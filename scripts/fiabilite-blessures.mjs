/**
 * Les blessures du fournisseur sont-elles utilisables pour le CALCUL ?
 *
 * La question n'est pas « sont-elles là », mais « décrivent-elles l'effectif
 * du jour ». Une liste qui contient les blessés guéris depuis trois mois
 * ferait passer une équipe au complet pour une infirmerie.
 */
import fs from 'node:fs';
for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}
const CLE = process.env.API_FOOTBALL_KEY || process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY;
const BASE = process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io';
if (!CLE) { console.log('\n  Clé API-Football introuvable dans .env.local.\n'); process.exit(0); }

const appel = async (chemin) => {
  const r = await fetch(`${BASE}${chemin}`, { headers: { 'x-apisports-key': CLE } });
  return r.json();
};

// Arsenal (42) — une équipe très suivie, saison en cours.
const SAISON = 2025;
const EQUIPE = 42;

const parSaison = await appel(`/injuries?team=${EQUIPE}&season=${SAISON}`);
console.log(`\n  ══ /injuries?team=${EQUIPE}&season=${SAISON} ══\n`);
console.log(`  Réponses : ${parSaison?.results ?? 0}`);
if (parSaison?.errors && Object.keys(parSaison.errors).length) {
  console.log(`  Erreurs  : ${JSON.stringify(parSaison.errors)}`);
}

const lignes = parSaison?.response ?? [];
if (lignes.length) {
  // Combien de DATES différentes ? Si la liste couvre toute la saison, c'est
  // un historique, pas l'infirmerie du jour.
  const dates = new Map();
  const joueurs = new Set();
  for (const l of lignes) {
    const d = String(l?.fixture?.date ?? '').slice(0, 10);
    dates.set(d, (dates.get(d) ?? 0) + 1);
    joueurs.add(l?.player?.name);
  }
  const triees = [...dates.keys()].filter(Boolean).sort();
  console.log(`  Joueurs distincts : ${joueurs.size}`);
  console.log(`  Dates distinctes  : ${dates.size}`);
  console.log(`  De ${triees[0]} à ${triees[triees.length - 1]}`);
  console.log(`\n  Les 5 dernières dates :`);
  for (const d of triees.slice(-5)) console.log(`    ${d} — ${dates.get(d)} absent(s)`);
  console.log(`\n  Exemple de ligne :`);
  const e = lignes[lignes.length - 1];
  console.log(`    ${e?.player?.name} · ${e?.player?.type} · ${e?.player?.reason} · match du ${String(e?.fixture?.date).slice(0, 10)}`);
}

// Et par match précis ? C'est la seule forme utilisable avant un match donné.
const prochains = await appel(`/fixtures?team=${EQUIPE}&next=1`);
const f = prochains?.response?.[0];
if (f?.fixture?.id) {
  console.log(`\n  ══ PROCHAIN MATCH : ${f.teams?.home?.name} - ${f.teams?.away?.name}, le ${String(f.fixture.date).slice(0, 10)} ══\n`);
  const parMatch = await appel(`/injuries?fixture=${f.fixture.id}`);
  console.log(`  /injuries?fixture=${f.fixture.id}  →  ${parMatch?.results ?? 0} absent(s)`);
  if (parMatch?.errors && Object.keys(parMatch.errors).length) console.log(`  Erreurs : ${JSON.stringify(parMatch.errors)}`);
  for (const l of (parMatch?.response ?? []).slice(0, 8)) {
    console.log(`    ${l?.team?.name} · ${l?.player?.name} · ${l?.player?.type} · ${l?.player?.reason}`);
  }

  const compos = await appel(`/fixtures/lineups?fixture=${f.fixture.id}`);
  console.log(`\n  /fixtures/lineups?fixture=${f.fixture.id}  →  ${compos?.results ?? 0} composition(s)`);
  if (compos?.errors && Object.keys(compos.errors).length) console.log(`  Erreurs : ${JSON.stringify(compos.errors)}`);
}
console.log('');
