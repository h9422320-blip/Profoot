import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { recettesParJour, surcoutAcheteurMaketou, parMois, totalMaketou } = await import('../src/lib/recettes-boutique.js');
const { DERNIER_JOUR_CHARIOW } = await import('../src/lib/recettes-histoire.js');
const pj = (await recettesParJour()) ?? {};

console.log('=== CHAQUE MOIS, DANS LES TROIS LECTURES ===');
console.log('  mois      ventes    chez MakeTou     prix de vente          net');
for (const [mois, m] of [...parMois(pj)].sort()) {
  const chez = m.xof + surcoutAcheteurMaketou(m.xof);
  console.log(`  ${mois}  ${String(m.ventes).padStart(5)}   ${String(chez).padStart(12)} F ${String(m.xof).padStart(12)} F ${String(m.xof - (m.fraisXof ?? 0)).padStart(12)} F`);
}

console.log('\n=== SEPTEMBRE SEUL (du 1er au 10) ===');
let v = 0, x = 0, f = 0;
for (const [j, p] of Object.entries(pj)) {
  if (!j.startsWith('2026-09')) continue;
  v += p.ventes; x += p.xof; f += p.fraisXof ?? 0;
}
console.log(`  ${v} ventes`);
console.log(`  chez MakeTou   ${(x + surcoutAcheteurMaketou(x)).toLocaleString('fr-FR')} F`);
console.log(`  prix de vente  ${x.toLocaleString('fr-FR')} F`);
console.log(`  net            ${(x - f).toLocaleString('fr-FR')} F`);

const mt = totalMaketou(pj);
console.log('\n=== DEPUIS L OUVERTURE DE MAKETOU (28 aout) ===');
console.log(`  ${mt.ventes} ventes`);
console.log(`  chez MakeTou   ${(mt.xof + surcoutAcheteurMaketou(mt.xof)).toLocaleString('fr-FR')} F`);
console.log(`  prix de vente  ${mt.xof.toLocaleString('fr-FR')} F`);
console.log(`  net            ${(mt.xof - mt.fraisXof).toLocaleString('fr-FR')} F`);

console.log('\n=== AOUT MAKETOU SEUL (28 au 31) ===');
let v2 = 0, x2 = 0;
for (const [j, p] of Object.entries(pj)) {
  if (j <= DERNIER_JOUR_CHARIOW || !j.startsWith('2026-08')) continue;
  v2 += p.ventes; x2 += p.xof;
}
console.log(`  ${v2} ventes, ${(x2 + surcoutAcheteurMaketou(x2)).toLocaleString('fr-FR')} F chez MakeTou`);
