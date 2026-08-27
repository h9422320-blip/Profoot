/**
 * Dernier balayage des fichiers surveillés.
 *
 * Presque tout ce qui reste est du commentaire — mais le test ne fait pas la
 * différence quand le mot apparaît aussi dans une chaîne, et un vocabulaire
 * qui traîne dans les commentaires finit toujours par ressortir dans un
 * libellé. On nettoie donc partout.
 */
import fs from 'node:fs';

const FICHIERS = [
  'src/app/(dashboard)/analyze/AnalyzeClient.tsx',
  'src/components/preuves/SectionPreuves.tsx',
  'src/lib/diagnostic-ia.ts',
];

// Pas de `\b` après un accent : en JavaScript il ne s'y forme aucune frontière.
const REGLES = [
  [/\bPROBABILITÉS/g, 'TENDANCES'],
  [/\bPROBABILITÉ/g, 'TENDANCE'],
  [/\bprobabilités/gi, 'tendances'],
  [/\bprobabilité/gi, 'tendance'],
  [/\bprobablement\b/gi, 'vraisemblablement'],
  [/\bprobables\b/gi, 'attendus'],
  [/\bprobable\b/gi, 'attendu'],
  [/\bs['’]abonnent\b/gi, 'achètent un accès'],
  [/\babonnés/gi, 'membres'],
  [/\babonnes\b/gi, 'membres'],
  [/\babonné/gi, 'membre'],
  [/\babonnements\b/gi, 'offres'],
  [/\babonnement\b/gi, 'offre'],
];

for (const p of FICHIERS) {
  let s = fs.readFileSync(p, 'utf8');
  const avant = s;
  let n = 0;
  for (const [motif, par] of REGLES) {
    const compte = (s.match(motif) || []).length;
    if (compte) { s = s.replace(motif, par); n += compte; }
  }
  if (s !== avant) fs.writeFileSync(p, s, 'utf8');
  console.log(`  ${String(n).padStart(3)} remplacement(s)  ${p.split('/').pop()}`);
}
