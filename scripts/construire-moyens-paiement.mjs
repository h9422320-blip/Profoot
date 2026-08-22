/**
 * Construit le fichier de données lu par l'application, à partir de la récolte.
 *
 * Les noms de pays sont écrits EN FRANÇAIS ici, une fois pour toutes : les
 * produire dans le navigateur obligerait chaque téléphone à charger la table
 * des noms de régions, pour un résultat identique à chaque fois.
 */
import fs from 'fs';

const brut = JSON.parse(fs.readFileSync('scratch-moyens-paiement.json', 'utf8'));
const nomsFr = new Intl.DisplayNames(['fr'], { type: 'region' });

/**
 * Le libellé montré à l'acheteur.
 *
 * Les marques gardent leur nom — « Wave » s'écrit Wave partout. Seuls les
 * moyens génériques sont traduits : « Card » ne rassure personne, « Carte
 * bancaire (Visa / Mastercard) » si.
 */
const LIBELLES = {
  card: 'Carte bancaire (Visa / Mastercard)',
  card_cb: 'Cartes Bancaires',
  bank_transfer: 'Virement bancaire',
  bank_account: 'Compte bancaire',
  ussd: 'USSD (code sur le téléphone)',
};

const sortie = {};
for (const [code, v] of Object.entries(brut)) {
  if (!v.moyens?.length) continue;
  let nom;
  try { nom = nomsFr.of(code); } catch { nom = null; }
  sortie[code] = {
    nom: nom && nom !== code ? nom : v.nom,
    moyens: v.moyens.map((m) => ({ cle: m.cle, nom: LIBELLES[m.cle] ?? m.nom })),
  };
}

fs.writeFileSync('src/lib/moyens-paiement.json', JSON.stringify(sortie, null, 1));
console.log(`\n  ${Object.keys(sortie).length} pays écrits dans src/lib/moyens-paiement.json`);

// Les icônes, rapatriées une fois pour toutes.
const icones = new Set();
for (const v of Object.values(sortie)) for (const m of v.moyens) icones.add(m.cle);
fs.mkdirSync('public/moyens', { recursive: true });
let ok = 0, rates = [];
for (const cle of icones) {
  const chemin = `public/moyens/${cle}.svg`;
  if (fs.existsSync(chemin)) { ok++; continue; }
  try {
    const r = await fetch(`https://assets.orqexcdn.com/icons/methods/${cle}.svg`);
    if (!r.ok) { rates.push(cle); continue; }
    fs.writeFileSync(chemin, Buffer.from(await r.arrayBuffer()));
    ok++;
  } catch { rates.push(cle); }
}
console.log(`  ${ok}/${icones.size} icône(s) dans public/moyens/${rates.length ? ' — manquantes : ' + rates.join(', ') : ''}`);
console.log(`  Échantillon : ${JSON.stringify(sortie.CI)}\n`);
