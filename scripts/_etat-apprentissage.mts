/**
 * L'ÉTAT DE L'APPRENTISSAGE, EN UN COUP D'ŒIL.
 *
 * Trois choses doivent tourner tous les jours pour que le moteur progresse :
 *
 *   1. les pronostics d'hier confrontés au résultat réel  (jugements_moteur)
 *   2. le relevé de fiabilité recalculé sur ces jugements  (fiabilite:apprise)
 *   3. les forces d'attaque et de défense rebâties         (forces:occasions)
 *
 * Si l'une des trois s'arrête, rien ne casse et rien ne le signale : le moteur
 * continue simplement d'analyser 2026 avec ce qu'il savait en août.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const jour = (d: Date) => new Date(d).toISOString().slice(0, 10);

// ── LES JUGEMENTS, PAR JOUR DE MATCH ET PAR JOUR DE JUGEMENT ────────────────
const tous: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb
    .from('jugements_moteur')
    .select('fixture_id, ligue, date_match, juge_le, issue_juste, score_exact, proba_domicile, proba_nul, proba_exterieur')
    .range(de, de + 999);
  if (error) { console.log('ERREUR ' + error.message); break; }
  tous.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`=== ${tous.length} rencontres jugées ===\n`);

const parJourMatch = new Map<string, { n: number; justes: number }>();
const parJourJugement = new Map<string, number>();
for (const j of tous) {
  const jm = jour(j.date_match);
  const c = parJourMatch.get(jm) ?? { n: 0, justes: 0 };
  c.n++; if (j.issue_juste) c.justes++;
  parJourMatch.set(jm, c);
  const jj = jour(j.juge_le);
  parJourJugement.set(jj, (parJourJugement.get(jj) ?? 0) + 1);
}

console.log('JOUR DE MATCH — les quinze derniers');
for (const d of [...parJourMatch.keys()].sort().slice(-15)) {
  const c = parJourMatch.get(d)!;
  console.log(`  ${d} : ${String(c.n).padStart(4)} jugés, ${String(c.justes).padStart(4)} justes (${((100 * c.justes) / c.n).toFixed(1)} %)`);
}

console.log('\nJOUR DE JUGEMENT — les dix derniers');
for (const d of [...parJourJugement.keys()].sort().slice(-10)) {
  console.log(`  ${d} : ${parJourJugement.get(d)} rencontres confrontées`);
}

// ── CE QUI RESTE À JUGER ────────────────────────────────────────────────────
const dejaJuge = new Set(tous.map((j) => Number(j.fixture_id)));
const pron: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb
    .from('predictions_match')
    .select('fixture_id, calculee_le, proba_domicile')
    .range(de, de + 999);
  pron.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const distincts = new Set(pron.filter((p) => p.proba_domicile != null).map((p) => Number(p.fixture_id)));
const enAttente = [...distincts].filter((id) => !dejaJuge.has(id));
console.log(`\n=== ${distincts.size} rencontres pronostiquées, ${dejaJuge.size} jugées, ${enAttente.length} jamais confrontées ===`);
