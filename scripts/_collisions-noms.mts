/**
 * COMBIEN DE RENCONTRES SONT RETENUES PAR HOMONYMIE ?
 *
 * La sélection retient une rencontre quand le NOM de sa compétition figure
 * dans `CHAMPIONNATS`. Or « Premier League » est aussi le nom du championnat
 * du Bhoutan, de l'Ouganda, du pays de Galles, de l'Arménie, de la Russie et
 * de l'Irlande du Nord ; « Ligue 1 » celui de l'Algérie ; « Super League »
 * celui de la Suisse, de la Grèce et de la Chine.
 *
 * Ce relevé compte, sur une semaine réelle, combien de rencontres entrent
 * dans le moteur par cette porte — et de quels pays.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { CHAMPIONNATS } = await import('../src/lib/precalcul-selection.js');
const { LEAGUE_IDS } = await import('../src/lib/api-football.js');

const CLE = process.env.API_FOOTBALL_KEY!;
const attendus = new Set<number>(Object.values(LEAGUE_IDS as Record<string, number>));

const parCle = new Map<string, { n: number; id: number; nom: string; pays: string; connue: boolean }>();

for (let d = 0; d < 7; d++) {
  const jour = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, {
    headers: { 'x-apisports-key': CLE },
    cache: 'no-store',
  });
  const j = await r.json();
  for (const f of j?.response ?? []) {
    const nom = String(f?.league?.name ?? '');
    if (!CHAMPIONNATS.includes(nom)) continue;
    const id = Number(f?.league?.id);
    const pays = String(f?.league?.country ?? '');
    const cle = `${id}`;
    const c = parCle.get(cle) ?? { n: 0, id, nom, pays, connue: attendus.has(id) };
    c.n++;
    parCle.set(cle, c);
  }
}

const lignes = [...parCle.values()].sort((a, b) => b.n - a.n);
const voulues = lignes.filter((l) => l.connue);
const parasites = lignes.filter((l) => !l.connue);
const somme = (t: typeof lignes) => t.reduce((s, l) => s + l.n, 0);

console.log('=== COMPÉTITIONS RÉELLEMENT VOULUES ===');
for (const l of voulues) console.log(`  ${String(l.n).padStart(4)}  id ${String(l.id).padStart(4)}  ${l.nom.padEnd(26)} ${l.pays}`);

console.log('\n=== RETENUES PAR HOMONYMIE, JAMAIS APPRISES ===');
for (const l of parasites) console.log(`  ${String(l.n).padStart(4)}  id ${String(l.id).padStart(4)}  ${l.nom.padEnd(26)} ${l.pays}`);

console.log(
  `\n=== ${somme(voulues)} rencontres voulues, ${somme(parasites)} par homonymie ` +
    `(${((100 * somme(parasites)) / Math.max(1, somme(lignes))).toFixed(1)} % de ce que le moteur prépare) ===`
);
