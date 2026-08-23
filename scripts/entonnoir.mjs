/** Le tunnel de vente, de bout en bout : mesure maison + caisse Chariow. */
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
const { lireBilanVisites } = await jiti.import('../src/lib/mesure-visites.ts');
const { listSalesEncaissees } = await jiti.import('../src/lib/chariow.ts');

const HEURES = 24;
const b = await lireBilanVisites(HEURES);

console.log(`\n  ══ LE TUNNEL DE VENTE — ${HEURES} DERNIÈRES HEURES ══\n`);
console.log(`  ${b.visites} visites · ${b.partMobile} % sur téléphone\n`);

const e = (cle) => b.entonnoir.find((x) => x.cle === cle) ?? { visites: 0, partPrecedente: null, perdues: 0 };
const ligne = (nom, x, retrait = false) =>
  console.log(
    `  ${retrait ? '   ' : ''}${String(x.visites).padStart(retrait ? 5 : 8)}  ${nom.padEnd(retrait ? 33 : 36)}` +
    (x.partPrecedente !== null ? `${String(x.partPrecedente).padStart(5)} %` : '')
  );

ligne('ont vu les tarifs', e('tarifs'));
ligne('ont cliqué sur une offre', e('offre-cliquee'));
console.log('');
ligne('ont cliqué « Continuer »', e('notice-continuer'), true);
ligne('sont partis après 20 s, sans agir', e('notice-auto'), true);
ligne('ont fermé la notice', e('notice-fermee'), true);
ligne('lien de paiement en échec', e('echec-lien'), true);
console.log('');
ligne('sont partis vers la caisse', e('depart-caisse'));

// ── Ce que dit la caisse, sur la même journée ────────────────────────────
const V = await listSalesEncaissees();
const jour = (v) => String(v.completed_at ?? v.created_at).slice(0, 10);
const auj = new Date().toISOString().slice(0, 10);
const payes = V.filter((v) => jour(v) === auj);
const somme = payes.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
console.log(`  ${String(payes.length).padStart(8)}  ont payé${' '.repeat(28)}` +
  (e('depart-caisse').visites > 0 ? `${String(Math.round(payes.length / e('depart-caisse').visites * 100)).padStart(5)} %` : ''));
console.log(`\n  Recette du jour : ${somme.toLocaleString('fr-FR')} FCFA\n`);
