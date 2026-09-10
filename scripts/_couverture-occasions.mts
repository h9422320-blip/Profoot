/**
 * SUR COMBIEN DE RENCONTRES LA MOITIÉ « TIRS » DU MOTEUR S'APPLIQUE-T-ELLE ?
 *
 * `butsAttendusOccasions` rend `null` dès qu'UN des deux clubs est inconnu du
 * relevé. La rencontre retombe alors sur le seul modèle des buts — le moteur
 * tourne, mais avec une moitié de cerveau, et rien ne le signale.
 *
 * Ce relevé dit, pour les rencontres réellement au programme, lesquelles sont
 * couvertes et QUELS clubs manquent. C'est la liste des clubs à aller
 * chercher, par ordre d'importance.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { lireForces, butsAttendusOccasions } = await import('../src/lib/forme-occasions.js');
const { CHAMPIONNATS, rangDeCompetition } = await import('../src/lib/precalcul-selection.js');

const releve = await lireForces();
if (!releve) { console.log('AUCUN RELEVE'); process.exit(1); }
console.log(`relevé : ${Object.keys(releve.clubs).length} clubs\n`);

const CLE = process.env.API_FOOTBALL_KEY!;
const jours = [0, 1, 2, 3, 4, 5, 6].map((d) =>
  new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
);

let couverts = 0;
let total = 0;
const manquants = new Map<string, { n: number; ligue: string }>();

for (const jour of jours) {
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, {
    headers: { 'x-apisports-key': CLE },
    cache: 'no-store',
  });
  const j = await r.json();
  const retenus = (j?.response ?? []).filter((f: any) =>
    CHAMPIONNATS.includes(String(f?.league?.name ?? ''))
  );

  let cJour = 0;
  for (const f of retenus) {
    total++;
    const dom = String(f?.teams?.home?.name ?? '');
    const ext = String(f?.teams?.away?.name ?? '');
    const ligue = String(f?.league?.name ?? '');
    const vu = butsAttendusOccasions(releve, dom, ext);
    if (vu) { couverts++; cJour++; continue; }
    for (const nom of [dom, ext]) {
      if (!releve.clubs[nom]) {
        const c = manquants.get(nom) ?? { n: 0, ligue };
        c.n++;
        manquants.set(nom, c);
      }
    }
  }
  console.log(`${jour} : ${cJour}/${retenus.length} rencontres couvertes`);
}

console.log(`\n=== ${couverts}/${total} rencontres couvertes (${((100 * couverts) / Math.max(1, total)).toFixed(1)} %) ===`);
console.log(`\n=== ${manquants.size} clubs absents du relevé, les plus fréquents d'abord ===`);
for (const [nom, c] of [...manquants.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40))
  console.log(`  ${String(c.n).padStart(2)} × ${nom.padEnd(30)} ${c.ligue}`);
