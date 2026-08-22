/** PREUVE DE COUVERTURE — ce que Chariow propose réellement, pays par pays. */
import fs from 'fs';

const decoder = (s) =>
  String(s ?? '')
    .replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&eacute;/g, 'é').replace(/&nbsp;/g, ' ');

const d = JSON.parse(fs.readFileSync('scratch-moyens-paiement.json', 'utf8'));
const entrees = Object.entries(d).map(([code, v]) => ({
  code, nom: decoder(v.nom), moyens: v.moyens.map((m) => m.nom),
}));

const avec = entrees.filter((e) => e.moyens.length);
const vides = entrees.filter((e) => !e.moyens.length);

console.log(`\n  ══ POINT 1 — COUVERTURE ══\n`);
console.log(`  Pays sondés ......................... ${entrees.length}`);
console.log(`  Pays avec au moins un moyen ......... ${avec.length}`);
console.log(`  Pays avec une liste VIDE ............ ${vides.length}${vides.length ? '  → ' + vides.map((e) => e.code).join(', ') : ''}`);

const seulementCarte = avec.filter((e) => e.moyens.length === 1 && /^card$/i.test(e.moyens[0]));
console.log(`\n  ══ POINT 3 — PAYS AVEC « CARD » COMME SEUL MOYEN ══\n`);
console.log(`  ${seulementCarte.length} pays :\n`);
for (const e of seulementCarte.sort((a, b) => a.nom.localeCompare(b.nom)))
  console.log(`     ${e.code}  ${e.nom}`);

console.log(`\n\n  ══ POINT 2 — LES ${avec.length} PAYS, UN PAR UN ══\n`);
for (const e of avec.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
  console.log(`  ${e.code}  ${e.nom.slice(0, 28).padEnd(29)} ${e.moyens.join(', ')}`);

// Le catalogue, pour vérifier qu'aucun nom n'est inventé.
const tous = new Set();
for (const e of avec) for (const m of e.moyens) tous.add(m);
console.log(`\n  ${tous.size} moyens de paiement distincts sur l'ensemble du monde.\n`);
