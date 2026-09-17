// Lecture seule : le journal du pulse MakeTou — pays, moyen de paiement, résultat.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireReserve } = await import('../src/lib/api-football.js');
const pays = (process.argv[2] ?? '').toUpperCase();
const j = (await lireReserve<any[]>('maketou:pulse:recus'))?.contenu ?? [];
const lignes = (Array.isArray(j) ? j : []).filter((l) => !pays || String(l?.pays ?? '').toUpperCase() === pays);
console.log(`journal : ${Array.isArray(j) ? j.length : 0} entrée(s)${pays ? ` · ${lignes.length} pour ${pays}` : ''}`);
const compte = (f: (l: any) => string) => {
  const m = new Map<string, number>();
  for (const l of lignes) m.set(f(l), (m.get(f(l)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
console.log('\npar pays :', compte((l) => String(l?.pays ?? '?')).map(([k, n]) => `${k}=${n}`).join('  '));
console.log('par moyen de paiement :');
for (const [k, n] of compte((l) => String(l?.moyen ?? 'non transmis'))) console.log(`  ${String(n).padStart(4)}  ${k}`);
console.log('par événement :', compte((l) => String(l?.evenement ?? l?.erreur ?? '?')).map(([k, n]) => `${k}=${n}`).join('  '));
console.log('accès ouvert :', compte((l) => String(l?.resultat?.ouvert ?? '—')).map(([k, n]) => `${k}=${n}`).join('  '));
console.log('\nles vingt dernières entrées :');
for (const l of lignes.slice(0, 20))
  console.log(`  ${String(l?.recuLe ?? '').slice(0, 16)} ${String(l?.evenement ?? l?.erreur ?? '').padEnd(16)} ${String(l?.pays ?? '?').padEnd(4)} ${String(l?.moyen ?? 'moyen non transmis').padEnd(22)} ${String(l?.montant ?? '').padStart(6)} ${String(l?.email ?? '')} ${l?.resultat?.ouvert === true ? 'ACCÈS OUVERT' : l?.resultat?.motif ?? l?.refuse ?? ''}`);
