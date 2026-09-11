/** Un relevé complet au rythme doux du challenger : combien de refus du fournisseur ? */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { releverCotes } = await import('../src/lib/cotes-marche.js');
const t0 = Date.now();
const r = await releverCotes(new Date(), 30 * 60_000, 3, 1_500);
console.log(`RELEVE : ${r.matchs} rencontres sur ${r.jours} journées, ${r.ligues} championnats, en ${Math.round((Date.now() - t0) / 1000)} s`);
