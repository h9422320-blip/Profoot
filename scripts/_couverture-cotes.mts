// Lecture seule : les cotes relevées couvrent-elles les matchs des sept grands championnats ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireCotesDuJour } = await import('../src/lib/cotes-marche.js');
const { CHAMPIONNATS_DU_MARCHE } = await import('../src/lib/couche-marche.js');
for (let d = -1; d <= 3; d++) {
  const jour = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const r = await lireCotesDuJour(jour);
  const grands = (r?.matchs ?? []).filter((m: any) => CHAMPIONNATS_DU_MARCHE.has(Number(m.ligue)));
  const parLigue = new Map<number, number>();
  for (const m of grands) parLigue.set(m.ligue, (parLigue.get(m.ligue) ?? 0) + 1);
  console.log(`${jour} : ${r ? `${r.matchs.length} matchs cotés, relevé le ${String(r.releveLe).slice(0, 16)}` : 'aucun relevé'} · grands championnats ${grands.length} ${[...parLigue].map(([l, n]) => `${l}:${n}`).join(' ')}`);
}
