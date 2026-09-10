/**
 * OÙ LE MOTEUR SE TROMPE, ET OÙ IL NE SE TROMPE PAS.
 *
 * Le propriétaire ne demande pas le score exact. Il demande que, quand
 * l'application annonce une victoire, cette victoire arrive. La seule mesure
 * qui compte ici est donc le TAUX D'ISSUE JUSTE, découpé de façon à dire où
 * pousser.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { rangDeCompetition } = await import('../src/lib/precalcul-selection.js');
const sb = createAdminClient();

const tous: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  tous.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`${tous.length} rencontres jugées\n`);

const pc = (justes: number, n: number) => (n ? ((100 * justes) / n).toFixed(1) + ' %' : '—');
const ligne = (titre: string, lot: any[]) =>
  console.log(
    `  ${titre.padEnd(34)} ${String(lot.length).padStart(5)} matchs   ` +
      `${pc(lot.filter((j) => j.issue_juste).length, lot.length).padStart(7)}   ` +
      `score exact ${pc(lot.filter((j) => j.score_exact).length, lot.length)}`
  );

// ── PAR ÉCART ENTRE LA PREMIÈRE ET LA DEUXIÈME ISSUE ───────────────────────
const ecartDe = (j: any) => {
  const p = [Number(j.proba_domicile), Number(j.proba_nul), Number(j.proba_exterieur)].sort(
    (a, b) => b - a
  );
  return p[0] - p[1];
};

console.log('=== PAR NETTETÉ DU PRONOSTIC ===');
for (const [titre, min, max] of [
  ['très serré (moins de 10)', 0, 10],
  ['léger favori (10 à 25)', 10, 25],
  ['favori net (25 à 45)', 25, 45],
  ['favori écrasant (45 et plus)', 45, 999],
] as [string, number, number][]) {
  ligne(
    titre,
    tous.filter((j) => {
      const e = ecartDe(j);
      return e >= min && e < max;
    })
  );
}

// ── PAR PROBABILITÉ LA PLUS HAUTE ─────────────────────────────────────────
const maxProba = (j: any) =>
  Math.max(Number(j.proba_domicile), Number(j.proba_nul), Number(j.proba_exterieur));

console.log('\n=== PAR PROBABILITÉ ANNONCÉE DE L’ISSUE RETENUE ===');
for (const seuil of [40, 45, 50, 55, 60, 65, 70, 75, 80]) {
  const lot = tous.filter((j) => maxProba(j) >= seuil);
  ligne(`au moins ${seuil} %`, lot);
}

// ── PAR ISSUE ANNONCÉE ────────────────────────────────────────────────────
console.log('\n=== PAR ISSUE ANNONCÉE ===');
for (const issue of ['domicile', 'nul', 'exterieur']) {
  ligne(issue, tous.filter((j) => j.issue_prevue === issue));
}

// ── CE QUE LE MOTEUR ANNONCE TROP, ET PAS ASSEZ ───────────────────────────
console.log('\n=== ANNONCÉ CONTRE SURVENU ===');
for (const issue of ['domicile', 'nul', 'exterieur']) {
  const annonce = tous.filter((j) => j.issue_prevue === issue).length;
  const survenu = tous.filter((j) => j.issue_reelle === issue).length;
  console.log(
    `  ${issue.padEnd(12)} annoncé ${String(annonce).padStart(5)} fois, ` +
      `survenu ${String(survenu).padStart(5)} fois  ` +
      `(${annonce > survenu ? '+' : ''}${(((annonce - survenu) / Math.max(1, survenu)) * 100).toFixed(0)} %)`
  );
}

// ── LES COUPES D'EUROPE À PART ────────────────────────────────────────────
console.log('\n=== LA LIGUE DES CHAMPIONS ET LES COUPES D’EUROPE ===');
ligne('coupes continentales', tous.filter((j) => rangDeCompetition(j.ligue) <= 1));
ligne('Ligue des champions seule', tous.filter((j) => j.ligue === 'UEFA Champions League'));
ligne('tout le reste', tous.filter((j) => rangDeCompetition(j.ligue) === 2));

// ── LES CHAMPIONNATS LES PLUS REPRÉSENTÉS ─────────────────────────────────
console.log('\n=== LES QUINZE CHAMPIONNATS LES PLUS JUGÉS ===');
const parLigue = new Map<string, any[]>();
for (const j of tous) {
  const n = String(j.ligue ?? 'inconnu');
  parLigue.set(n, [...(parLigue.get(n) ?? []), j]);
}
for (const [nom, lot] of [...parLigue.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
  ligne(nom, lot);
}
