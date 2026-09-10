/**
 * COMPLÈTE LA DATE DE MATCH DES PRONOSTICS DÉJÀ FIGÉS.
 *
 * ── POURQUOI ──────────────────────────────────────────────────────────────
 *
 * `figerPrediction` enregistre désormais la date du coup d'envoi, ce qui permet
 * de juger une rencontre deux heures et demie après son début plutôt que
 * d'attendre que le PRONOSTIC ait deux jours.
 *
 * Les lignes écrites avant ce changement n'ont pas cette date. Elles restent
 * donc soumises à l'ancienne règle — et la soirée de Ligue des champions du
 * 9 septembre 2026, cinq pronostics justes sur six, n'était toujours pas
 * apprise le 10 au matin : ses pronostics, calculés le 8 entre 3 h 41 et
 * 18 h 37, n'atteignaient leurs quarante-huit heures que le 10 au soir.
 *
 * Une seule passe suffit : vingt identifiants par appel, soit moins de cent
 * appels pour toute la table.
 *
 * Sans argument : simulation, rien n'est écrit.
 * Avec --ecrire : les dates sont enregistrées.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const cle = process.env.API_FOOTBALL_KEY!;
const ECRIRE = process.argv.includes('--ecrire');

const lignes: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb
    .from('predictions_match')
    .select('fixture_id, date_match, competition')
    .range(de, de + 999);
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const aCompleter = lignes.filter((p) => p.fixture_id && !p.date_match);
console.log(
  `${lignes.length} pronostics, ${aCompleter.length} sans date de match` +
    (ECRIRE ? '' : '  (simulation — rien ne sera écrit)')
);

let complets = 0;
let introuvables = 0;

for (let i = 0; i < aCompleter.length; i += 20) {
  const lot = aCompleter.slice(i, i + 20);
  const r = await fetch(
    `https://v3.football.api-sports.io/fixtures?ids=${lot.map((p) => p.fixture_id).join('-')}`,
    { headers: { 'x-apisports-key': cle }, cache: 'no-store' }
  );
  const j = await r.json();
  const fiches = new Map<number, any>();
  for (const f of j?.response ?? []) fiches.set(Number(f.fixture.id), f);

  for (const p of lot) {
    const f = fiches.get(Number(p.fixture_id));
    if (!f?.fixture?.date) {
      introuvables++;
      continue;
    }
    if (!ECRIRE) {
      complets++;
      continue;
    }
    const { error } = await sb
      .from('predictions_match')
      .update({
        date_match: String(f.fixture.date),
        ...(p.competition ? {} : { competition: f?.league?.name ?? null }),
      })
      .eq('fixture_id', p.fixture_id);
    if (error) console.warn(`  ÉCHEC ${p.fixture_id} : ${error.message}`);
    else complets++;
  }

  if ((i / 20) % 10 === 0)
    console.log(`  ${i + lot.length} / ${aCompleter.length} examinés — ${complets} complétés`);
}

console.log(
  `\n${complets} pronostic(s) ${ECRIRE ? 'complété(s)' : 'complétables'}, ` +
    `${introuvables} rencontre(s) introuvable(s) chez le fournisseur.`
);
