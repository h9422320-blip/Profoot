import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireMemoireClubs } = await import('../src/lib/memoire-clubs.js');
const m: any = await lireMemoireClubs().catch((e: any) => ({ erreur: e?.message }));
if (!m || m.erreur) { console.log('MÉMOIRE ILLISIBLE :', m?.erreur ?? 'absente'); }
else console.log(`clubs: ${m.clubs ?? Object.keys(m.notes ?? {}).length}  rencontres: ${m.rencontres}  rangée le: ${String(m.rangeeLe ?? m.calculeeLe ?? '?').slice(0,16)}  championnats ancrés: ${m.championnatsAncres ?? '?'}`);
