/**
 * Crée UNE session de paiement réelle, pour observer la page Chariow.
 *
 * Rien n'est débité : la session reste en attente de paiement. On s'en sert
 * uniquement pour lire, de nos yeux, quels moyens de paiement Chariow propose
 * réellement selon le pays — plutôt que de les supposer.
 */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { initCheckout } = await jiti.import('../src/lib/chariow.ts');

const s = await initCheckout({
  plan: 'essential_monthly',
  userId: '00000000-0000-0000-0000-000000000000',
  email: 'observation@profootai.com',
  firstName: 'Observation',
  lastName: 'ProFoot',
  redirectUrl: 'https://profootai.com/payment-success',
  paysAcheteur: 'BF',
});
console.log('\n  LIEN :', s.checkoutUrl, '\n  VENTE :', s.saleId, '\n');
