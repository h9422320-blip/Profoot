import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES } from './challenger/commun.mjs';
chargerEnv();
const { lireForcesChampionnats } = await import('../src/lib/forces-championnats.js');
const h = await lireForcesChampionnats();
const R: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const ligueDe = (nom: string) => {
  const compte = new Map<number, number>();
  for (const m of R)
    if (![2, 3, 848].includes(Number(m.ligue)) && (m.nomDom === nom || m.nomExt === nom))
      compte.set(Number(m.ligue), (compte.get(Number(m.ligue)) ?? 0) + 1);
  return [...compte].sort((a, b) => b[1] - a[1])[0];
};
for (const nom of ['Sabah FA', 'Manchester United', 'Qarabag', 'FC Levadia Tallinn', 'Kauno Žalgiris', 'Shamrock Rovers']) {
  const l = ligueDe(nom);
  const coef = l ? (h as any)?.coefficients?.[String(l[0])] : undefined;
  console.log(`${nom.padEnd(20)} championnat ${String(l?.[0] ?? '—').padEnd(5)} (${l?.[1] ?? 0} matchs)  coefficient ${coef === undefined ? 'ABSENT' : Number(coef).toFixed(3)}`);
}
const coefs = Object.entries((h as any)?.coefficients ?? {}).map(([id, c]) => ({ id, c: Number(c) })).sort((a, b) => a.c - b.c);
console.log(`\n${coefs.length} championnats dans la hiérarchie, du plus faible au plus fort :`);
console.log('  ' + coefs.slice(0, 8).map((x) => `${x.id}:${x.c.toFixed(2)}`).join('  '));
console.log('  ' + coefs.slice(-8).map((x) => `${x.id}:${x.c.toFixed(2)}`).join('  '));
