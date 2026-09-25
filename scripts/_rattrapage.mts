import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { rattraperAccesManquants } = await import('../src/lib/acces-manquants.js');
const r = await rattraperAccesManquants(false);
console.log(`ventes encaissées ${r.ventesEncaissees} · déjà servies ${r.dejaServies} · à rouvrir ${r.repares} · en attente d'inscription ${r.enAttenteInscription.length}`);
for (const a of r.enAttenteInscription) console.log('  en attente :', a.jour, a.email, a.montant, a.saleId);
for (const e of r.echecs) console.log('  échec :', e.email, e.raison);
