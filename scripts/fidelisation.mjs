/**
 * LE PRODUIT RETIENT-IL, OU SE CONTENTE-T-IL D'ATTIRER ?
 *
 * On lit les ventes encaissées de la boutique — la seule source qui fasse foi
 * pour l'argent — et on regarde combien de clients reviennent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';

// Les clés vivent dans .env.local ; ce script n'est pas lancé par Next.
for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });

const { listSalesEncaissees } = await jiti.import('./src/lib/chariow.ts');

const ventes = await listSalesEncaissees();
console.log(`\n  ${ventes.length} ventes encaissées lues depuis la boutique.\n`);

// ── On regroupe par client ────────────────────────────────────────────────
// L'e-mail identifie le client mieux que l'identifiant Chariow : un même
// acheteur peut repasser en caisse sans être reconnu par la boutique.
const parClient = new Map();
for (const v of ventes) {
  const cle = String(v.customer?.email ?? v.customer?.id ?? '').trim().toLowerCase();
  if (!cle) continue;
  if (!parClient.has(cle)) parClient.set(cle, []);
  parClient.get(cle).push(v);
}
for (const l of parClient.values()) {
  l.sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
}

const clients = [...parClient.values()];
const revenus = clients.filter((l) => l.length > 1);

console.log(`  ══ FIDÉLISATION DEPUIS LE LANCEMENT ══\n`);
console.log(`  Acheteurs distincts ......... ${clients.length}`);
console.log(`  Ont acheté plus d'une fois .. ${revenus.length}`);
console.log(`  Taux de rachat .............. ${Math.round(revenus.length / Math.max(1, clients.length) * 1000) / 10} %`);

// ── Délai avant le rachat ─────────────────────────────────────────────────
const delais = [];
for (const l of revenus) {
  for (let i = 1; i < l.length; i++) {
    const j = (new Date(l[i].created_at) - new Date(l[i - 1].created_at)) / 86400000;
    if (Number.isFinite(j) && j >= 0) delais.push(j);
  }
}
if (delais.length) {
  delais.sort((a, b) => a - b);
  const moy = delais.reduce((s, x) => s + x, 0) / delais.length;
  const median = delais[Math.floor(delais.length / 2)];
  console.log(`\n  Rachats observés ............ ${delais.length}`);
  console.log(`  Délai moyen avant rachat .... ${Math.round(moy * 10) / 10} jours`);
  console.log(`  Délai médian ................ ${Math.round(median * 10) / 10} jours`);
  console.log(`  Le plus rapide / le plus long ${Math.round(delais[0] * 10) / 10} j  /  ${Math.round(delais[delais.length - 1] * 10) / 10} j`);
}

// ── Combien d'achats par client ───────────────────────────────────────────
const parNombre = new Map();
for (const l of clients) parNombre.set(l.length, (parNombre.get(l.length) ?? 0) + 1);
console.log(`\n  ══ NOMBRE D'ACHATS PAR CLIENT ══\n`);
for (const [n, c] of [...parNombre].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${String(n).padStart(2)} achat${n > 1 ? 's' : ' '} : ${String(c).padStart(4)} client${c > 1 ? 's' : ''} ${'█'.repeat(Math.round(c / clients.length * 40))}`);
}

// ── Quel produit se rachète ───────────────────────────────────────────────
const suites = new Map();
for (const l of revenus) {
  for (let i = 1; i < l.length; i++) {
    const de = String(l[i - 1].product?.name ?? '?');
    const vers = String(l[i].product?.name ?? '?');
    const cle = `${de}  →  ${vers}`;
    suites.set(cle, (suites.get(cle) ?? 0) + 1);
  }
}
if (suites.size) {
  console.log(`\n  ══ CE QUI SE RACHÈTE APRÈS QUOI ══\n`);
  for (const [c, n] of [...suites].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(n).padStart(3)} fois   ${c}`);
  }
}

// ── L'évolution mois par mois ─────────────────────────────────────────────
const mois = new Map();
for (const l of clients) {
  const m = String(l[0].created_at ?? '').slice(0, 7);
  if (!m) continue;
  if (!mois.has(m)) mois.set(m, { nouveaux: 0, revenus: 0 });
  mois.get(m).nouveaux++;
  if (l.length > 1) mois.get(m).revenus++;
}
console.log(`\n  ══ PAR MOIS DE PREMIER ACHAT ══\n`);
console.log(`  mois      nouveaux   dont revenus   part`);
for (const [m, e] of [...mois].sort()) {
  console.log(`  ${m}   ${String(e.nouveaux).padStart(8)}   ${String(e.revenus).padStart(12)}   ${String(Math.round(e.revenus / e.nouveaux * 100)).padStart(3)} %`);
}
console.log('');
