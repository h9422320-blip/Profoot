/**
 * BILAN — CE QUI SE PASSE A LA CAISSE. Diagnostic seul.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { listRecentSales } = await jiti.import('./src/lib/chariow.ts');

const pc = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

// Combien de comptes ? La table s appelle comment ?
const { data: liste } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
let comptes = null;
try {
  let page = 1;
  let n = 0;
  for (;;) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    const u = data?.users ?? [];
    n += u.length;
    if (u.length < 1000) break;
    page++;
    if (page > 20) break;
  }
  comptes = n;
} catch (e) {
  console.log('  comptes illisibles : ' + e.message);
}
console.log(`\n  Comptes inscrits : ${comptes ?? '—'}`);

const toutes = await listRecentSales();
const jourDe = (d) => String(d ?? '').slice(0, 10);

// Les echecs sont-ils recents, ou anciens ?
const parJourStatut = new Map();
for (const v of toutes) {
  const j = jourDe(v.created_at);
  if (!j) continue;
  if (!parJourStatut.has(j)) parJourStatut.set(j, {});
  const e = parJourStatut.get(j);
  const s = String(v.status);
  e[s] = (e[s] ?? 0) + 1;
}

console.log('\n  ══ LA CAISSE, JOUR PAR JOUR ══\n');
console.log('  jour         arrivés   payés   abandonnés   échoués   % payé');
console.log('  ' + '─'.repeat(66));
for (const j of [...parJourStatut.keys()].sort().slice(-10)) {
  const e = parJourStatut.get(j);
  const payes = (e.settled ?? 0) + (e.completed ?? 0);
  const total = Object.values(e).reduce((s, n) => s + n, 0);
  console.log(
    `  ${j}   ${String(total).padStart(7)} ${String(payes).padStart(7)}` +
    ` ${String(e.abandoned ?? 0).padStart(12)} ${String(e.failed ?? 0).padStart(9)} ${String(pc(payes, total)).padStart(7)} %`
  );
}

// Le produit change-t-il quelque chose ?
console.log('\n  ══ PAR PRODUIT ══\n');
const parProduit = new Map();
for (const v of toutes) {
  const p = String(v.product?.name ?? '?');
  if (!parProduit.has(p)) parProduit.set(p, { total: 0, payes: 0, echoues: 0 });
  const e = parProduit.get(p);
  e.total++;
  if (['settled', 'completed'].includes(String(v.status))) e.payes++;
  if (String(v.status) === 'failed') e.echoues++;
}
console.log('  arrivés   payés   échoués   % payé   produit');
console.log('  ' + '─'.repeat(70));
for (const [p, e] of [...parProduit].sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `  ${String(e.total).padStart(7)} ${String(e.payes).padStart(7)} ${String(e.echoues).padStart(9)}` +
    ` ${String(pc(e.payes, e.total)).padStart(7)} %   ${p.slice(0, 40)}`
  );
}
console.log('');
