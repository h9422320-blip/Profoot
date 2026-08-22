/**
 * LE TUNNEL DE PAIEMENT MARCHE-T-IL ENCORE, ET LE PAYS CHOISI ARRIVE-T-IL ?
 *
 * Crée de VRAIES sessions Chariow — la seule preuve qui vaille — et vérifie
 * que le lien rendu porte bien le pays demandé.
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

const { paysRetenu } = await jiti.import('../src/lib/pays-paiement.ts');
const { initCheckout } = await jiti.import('../src/lib/chariow.ts');

console.log('\n  ══ 1. LE CHOIX DE PAYS EST FILTRÉ AVANT D ÊTRE TRANSMIS ══\n');
const entetes = (o) => new Headers(o);
const cas = [
  ['aucun choix — détection normale', entetes({ 'cf-ipcountry': 'CI' }), undefined, 'CI', 'ip'],
  ['choix valide GN', entetes({ 'cf-ipcountry': 'CI' }), 'GN', 'GN', 'choix'],
  ['choix en minuscules', entetes({ 'cf-ipcountry': 'CI' }), 'sn', 'SN', 'choix'],
  ['code fantaisie ZZ', entetes({ 'cf-ipcountry': 'CI' }), 'ZZ', 'CI', 'ip'],
  ['pays non servi (KP)', entetes({ 'cf-ipcountry': 'CI' }), 'KP', 'CI', 'ip'],
  ['injection', entetes({ 'cf-ipcountry': 'CI' }), '../../etc', 'CI', 'ip'],
];
let echecs = 0;
for (const [nom, h, choix, attenduCode, attenduSource] of cas) {
  const r = paysRetenu(h, undefined, choix);
  const ok = r.code === attenduCode && r.source === attenduSource;
  if (!ok) echecs++;
  console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} ${nom.padEnd(34)} → ${r.code} (${r.source})`);
}

console.log('\n  ══ 2. DE VRAIES SESSIONS CHARIOW ══\n');
for (const pays of ['GN', 'CI', 'FR']) {
  try {
    const s = await initCheckout({
      plan: 'essential_monthly',
      userId: '00000000-0000-0000-0000-000000000000',
      email: 'observation@profootai.com',
      firstName: 'Observation', lastName: 'ProFoot',
      paysAcheteur: pays,
      redirectUrl: 'https://profootai.com/payment-success',
    });
    const u = new URL(s.checkoutUrl);
    const transmis = u.searchParams.get('country');
    const ok = transmis === pays;
    if (!ok) echecs++;
    console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} pays ${pays} → lien créé, country=${transmis}, vente ${s.saleId}`);
  } catch (e) {
    echecs++;
    console.log(`  ÉCHEC pays ${pays} → ${e.message}`);
  }
}

console.log(`\n  ${echecs === 0 ? 'TOUT PASSE.' : echecs + ' ÉCHEC(S).'}\n`);
process.exit(echecs ? 1 : 0);
