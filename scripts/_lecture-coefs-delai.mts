/** La lecture des coefficients echoue-t-elle sous le garde-temps de 1,5 s ? */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { lireForcesChampionnats } = await import('../src/lib/forces-championnats.js');
let nuls = 0; const durees: number[] = [];
for (let k = 0; k < 12; k++) {
  const t = Date.now();
  const f = await lireForcesChampionnats();
  durees.push(Date.now() - t);
  if (!f) nuls++;
}
durees.sort((a, b) => a - b);
console.log(`12 lectures : ${nuls} echec(s) silencieux (rapport force a 1)`);
console.log(`durees ms : min ${durees[0]}, mediane ${durees[6]}, max ${durees[11]}`);
