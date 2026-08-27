/** Toutes les occurrences restantes dans les fichiers surveillés par le test. */
import fs from 'node:fs';

const PAGES = [
  'src/app/LandingClient.tsx', 'src/app/login/page.tsx', 'src/app/signup/page.tsx',
  'src/app/support/page.tsx', 'src/app/cgv/page.tsx', 'src/app/not-found.tsx',
  'src/app/layout.tsx', 'src/app/(dashboard)/preuves/page.tsx',
  'src/app/(dashboard)/expert/page.tsx', 'src/app/(dashboard)/analyze/AnalyzeClient.tsx',
  'src/app/(dashboard)/history/page.tsx', 'src/app/(dashboard)/history/list/page.tsx',
  'src/app/(dashboard)/pricing/PricingClient.tsx', 'src/app/mentions-legales/page.tsx',
  'src/components/preuves/SectionPreuves.tsx', 'src/dictionaries/fr.ts',
  'src/lib/preuves.ts', 'src/lib/diagnostic-ia.ts', 'src/lib/courriel.ts',
];

const MOTIF = /(?<!im)\bprobabilit[ée]|\bprobables?\b|\bprobablement\b|\bprobas?\b|\babonnements?\b|\b[stm]['’]abonner\b|\babonn[ée]/i;

let total = 0;
for (const p of PAGES) {
  let src;
  try { src = fs.readFileSync(p, 'utf8'); } catch { continue; }
  src.split(/\r?\n/).forEach((ligne, i) => {
    if (!MOTIF.test(ligne)) return;
    total++;
    const m = ligne.match(new RegExp('.{0,40}' + MOTIF.source + '.{0,40}', 'i'));
    console.log(`${p}:${i + 1}`);
    console.log(`    …${(m ? m[0] : ligne.trim()).replace(/\s+/g, ' ')}…`);
  });
}
console.log(`\n  ${total} occurrence(s) restante(s)`);
