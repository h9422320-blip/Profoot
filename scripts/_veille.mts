import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { recettesParJour, surcoutAcheteurMaketou } = await import('../src/lib/recettes-boutique.js');
const { DERNIER_JOUR_CHARIOW } = await import('../src/lib/recettes-histoire.js');
const pj = (await recettesParJour()) ?? {};
const auj = new Date().toISOString().slice(0,10);
const cle = auj.slice(0,7);
let v=0,x=0;
for (const [j,p] of Object.entries(pj)) { if (j>DERNIER_JOUR_CHARIOW && j.startsWith(cle) && j<auj) { v+=p.ventes; x+=p.xof; } }
console.log(`  jusqu'a hier      : ${v} ventes, ${(x+surcoutAcheteurMaketou(x)).toLocaleString('fr-FR')} F   <- ce que MakeTou montre`);
let v2=0,x2=0;
for (const [j,p] of Object.entries(pj)) { if (j>DERNIER_JOUR_CHARIOW && j.startsWith(cle)) { v2+=p.ventes; x2+=p.xof; } }
console.log(`  aujourd'hui compris : ${v2} ventes, ${(x2+surcoutAcheteurMaketou(x2)).toLocaleString('fr-FR')} F   <- votre caisse reelle`);
