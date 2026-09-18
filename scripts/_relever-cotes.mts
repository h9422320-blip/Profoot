// Relève les cotes des journées à venir (le même travail que le challenger de 11 h).
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { releverCotes } = await import('../src/lib/cotes-marche.js');
const t = Date.now();
const r = await releverCotes(new Date(), Number(process.argv[2] ?? 10) * 60_000);
console.log(JSON.stringify({ jours: r.jours, matchs: r.matchs, ligues: r.ligues }), `· ${Math.round((Date.now() - t) / 1000)} s`);
