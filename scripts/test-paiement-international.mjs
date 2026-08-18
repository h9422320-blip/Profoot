/**
 * QUE VOIT UN ACHETEUR HORS AFRIQUE DE L'OUEST ?
 *
 * La documentation de Chariow dit que les moyens de paiement affichés sont
 * choisis d'après l'ADRESSE IP de l'acheteur. Notre code transmet bien cette IP
 * (`customer_ip`). Reste à savoir ce que ça donne réellement.
 *
 * On crée donc de vraies sessions de paiement avec des IP de France, du Maroc,
 * d'Algérie et de Côte d'Ivoire, et on regarde ce que Chariow renvoie.
 *
 * CE QUE ÇA LAISSE COMME TRACE
 *
 * Quatre sessions « en attente de paiement » de plus dans la boutique, jamais
 * réglées. Sur les 424 ventes existantes dont 348 déjà abandonnées, c'est du
 * bruit négligeable — et c'est le seul moyen de savoir au lieu de supposer.
 * AUCUN paiement n'est effectué.
 */
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);

const API = 'https://api.chariow.com/v1';
const H = {
  Authorization: `Bearer ${env.CHARIOW_API_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

// Des adresses publiques appartenant réellement à ces pays.
const CAS = [
  ['Côte d Ivoire (référence)', 'CI', '160.154.151.9', '0700000000'],
  ['France', 'FR', '90.110.0.1', '600000000'],
  ['Maroc', 'MA', '105.157.0.1', '600000000'],
  ['Algérie', 'DZ', '105.235.137.160', '551234567'],
];

const PRODUIT = env.CHARIOW_PRODUCT_ID_ESSENTIAL;
console.log(`Produit testé : ${PRODUIT} (abonnement Essentiel, 2 000 FCFA)\n`);

for (const [nom, pays, ip, tel] of CAS) {
  const corps = {
    product_id: PRODUIT,
    email: `diagnostic-${pays.toLowerCase()}@profootai.com`,
    first_name: 'Diagnostic',
    last_name: pays,
    redirect_url: 'https://profootai.com/payment-success',
    customer_ip: ip,
    phone: { number: tel, country_code: pays },
    custom_metadata: { app: 'profoot', diagnostic: 'moyens-de-paiement' },
  };

  try {
    const r = await fetch(`${API}/checkout`, { method: 'POST', headers: H, body: JSON.stringify(corps) });
    const j = await r.json();
    console.log(`=== ${nom} (IP ${ip}) — HTTP ${r.status}`);
    if (!r.ok) {
      console.log(`    REFUSÉ : ${JSON.stringify(j).slice(0, 300)}\n`);
      continue;
    }
    const d = j?.data ?? j;
    console.log(`    lien       : ${d?.url ?? d?.checkout_url ?? '—'}`);
    console.log(`    devise     : ${d?.amount?.currency ?? d?.currency ?? '—'}  montant ${d?.amount?.value ?? d?.amount ?? '—'}`);
    const moyens = d?.payment_methods ?? d?.gateways ?? d?.methods ?? null;
    console.log(`    moyens     : ${moyens ? JSON.stringify(moyens) : '(non exposés par l API)'}`);
    console.log(`    champs     : ${Object.keys(d ?? {}).join(', ')}\n`);
  } catch (e) {
    console.log(`=== ${nom} : erreur ${e.message}\n`);
  }
}

console.log('Note : si l API n expose pas la liste des moyens, il faut ouvrir un des');
console.log('liens ci-dessus depuis un navigateur pour voir ce qui est proposé.');
