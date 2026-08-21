/** PREUVE — l aperçu redige par l IA, sur trois matchs reels. */
import fs from 'fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i > 0) process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const { obtenirApercu } = await import('../src/lib/apercu-ia');
const { trahitLeVerdict } = await import('../src/lib/apercu-ia');

const CAS = [
  ['FAVORI NET', 'Real Madrid', 'Espanyol',
    { recentMatches:['W','W','W','W','D'], goalsScored:12, goalsConceded:3, cleanSheets:3, avgPossession:62, winStreak:4 },
    { recentMatches:['L','L','D','L','W'], goalsScored:4, goalsConceded:9, cleanSheets:1, avgPossession:41, winStreak:0 }],
  ['MATCH SERRE', 'Arsenal', 'Coventry',
    { recentMatches:['W','W','D','W','W'], goalsScored:9, goalsConceded:4, cleanSheets:2, avgPossession:58, winStreak:2 },
    { recentMatches:['W','D','W','L','W'], goalsScored:8, goalsConceded:6, cleanSheets:2, avgPossession:47, winStreak:1 }],
  ['GROS OUTSIDER', 'Marseille', 'Strasbourg',
    { recentMatches:['W','L','W','W','L'], goalsScored:8, goalsConceded:7, cleanSheets:1, avgPossession:54, winStreak:0 },
    { recentMatches:['L','L','L','L','D'], goalsScored:2, goalsConceded:11, cleanSheets:0, avgPossession:38, winStreak:0 }],
] as const;

const textes: string[] = [];
for (const [nom, t1, t2, f1, f2] of CAS) {
  const debut = Date.now();
  const r = await obtenirApercu(t1, t2, f1 as any, f2 as any);
  textes.push(r.texte);
  console.log(`\n${'═'.repeat(76)}\n  ${nom} — ${t1} vs ${t2}\n${'═'.repeat(76)}`);
  console.log(`  source : ${r.source}${r.rejet ? ` (rejet : ${r.rejet})` : ''}   ${Date.now() - debut} ms\n`);
  console.log(`  « ${r.texte} »\n`);
  const f = trahitLeVerdict(r.texte);
  console.log(f ? `  ECHEC — trahit ${f}` : `  OK — ne trahit ni score, ni proba, ni vainqueur, ni confiance.`);
}

// Deuxieme passage : doit venir de la reserve, sans nouvel appel paye.
console.log(`\n${'═'.repeat(76)}\n  CACHE — deuxieme passage sur les memes matchs\n${'═'.repeat(76)}\n`);
for (const [, t1, t2, f1, f2] of CAS) {
  const debut = Date.now();
  const r = await obtenirApercu(t1, t2, f1 as any, f2 as any);
  console.log(`  ${t1} — ${t2} : source=${r.source}  ${Date.now() - debut} ms  ${r.source === 'reserve' ? 'OK (aucun appel paye)' : 'ATTENTION : regenere'}`);
}
console.log(`\n  Textes distincts : ${new Set(textes).size}/${textes.length}\n`);
