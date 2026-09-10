/** Ce que la nouvelle colonne affichera, jour par jour, face a MakeTou. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { recettesParJour, surcoutAcheteurMaketou, totalMaketou, tauxMaketou } = await import('../src/lib/recettes-boutique.js');
const { DERNIER_JOUR_CHARIOW } = await import('../src/lib/recettes-histoire.js');
const parJour = (await recettesParJour()) ?? {};
const jours = Object.keys(parJour).filter((j) => j > DERNIER_JOUR_CHARIOW).sort().slice(-14);
console.log('  jour        ventes   CHEZ MAKETOU   prix de vente   commission   net');
for (const j of jours) {
  const p = parJour[j];
  const chez = p.xof + surcoutAcheteurMaketou(p.xof);
  console.log(
    `  ${j}  ${String(p.ventes).padStart(4)}   ${String(chez).padStart(10)} F   ${String(p.xof).padStart(10)} F   ` +
      `${String(p.fraisXof ?? 0).padStart(8)} F   ${String(p.xof - (p.fraisXof ?? 0)).padStart(8)} F`
  );
}
const mt = totalMaketou(parJour);
console.log(`\n  TOTAL MakeTou : ${mt.ventes} ventes`);
console.log(`    chez MakeTou (« Revenus totaux ») : ${(mt.xof + surcoutAcheteurMaketou(mt.xof)).toLocaleString('fr-FR')} F`);
console.log(`    prix de vente (base partenaire)   : ${mt.xof.toLocaleString('fr-FR')} F`);
console.log(`    commission boutique (${(tauxMaketou()*100).toFixed(0)} %)         : ${mt.fraisXof.toLocaleString('fr-FR')} F`);
console.log(`    net (« solde en attente »)        : ${(mt.xof - mt.fraisXof).toLocaleString('fr-FR')} F`);
