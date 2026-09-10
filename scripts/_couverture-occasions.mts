/**
 * Quelle part des rencontres que l application analyse le releve d occasions
 * sait eclairer.
 *
 * Le denominateur qui compte n est pas « toutes les rencontres du monde » —
 * un samedi en compte seize cents, coupes de jeunes et reserves comprises —
 * mais celles des competitions declarees dans le releve.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { lireForces, butsAttendusOccasions, CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');
const K = process.env.API_FOOTBALL_KEY!;

const releve = await lireForces();
if (!releve) { console.log('RELEVE ABSENT'); process.exit(0); }
const clubs = Object.keys((releve as any).clubs ?? {});
console.log(`releve : ${clubs.length} clubs, etalon ${(releve as any).moyenne}, avantage ${(releve as any).avantageDomicile}/${(releve as any).avantageExterieur}`);
const IDS = new Set(CHAMPIONNATS.map((c: any) => c.id));
console.log(`${CHAMPIONNATS.length} competitions declarees\n`);

for (const d of [0, 1, 2]) {
  const jour = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': K }, cache: 'no-store' });
  const j = await r.json();
  const fx = (j?.response ?? []).filter((f: any) => ['NS', 'TBD'].includes(f?.fixture?.status?.short));
  const declarees = fx.filter((f: any) => IDS.has(Number(f?.league?.id)));
  const eclaire = (f: any) => !!butsAttendusOccasions(releve, f?.teams?.home?.name, f?.teams?.away?.name);
  const c1 = declarees.filter(eclaire).length;
  const c2 = fx.filter(eclaire).length;
  console.log(
    `${jour} : ${c1} / ${declarees.length} dans les competitions declarees ` +
      `(${((100 * c1) / Math.max(1, declarees.length)).toFixed(1)} %)   —   ` +
      `${c2} / ${fx.length} toutes competitions confondues`
  );
  const trous = new Map<string, number>();
  for (const f of declarees) if (!eclaire(f)) trous.set(String(f?.league?.name), (trous.get(String(f?.league?.name)) ?? 0) + 1);
  for (const [nom, n] of [...trous.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`     trou : ${String(n).padStart(3)}  ${nom}`);
}
