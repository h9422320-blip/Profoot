/**
 * BILAN — L ARGENT, L USAGE, LA FIDELISATION. Diagnostic seul.
 * La boutique Chariow fait foi pour l argent, jamais notre base.
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
const { listSalesEncaissees } = await jiti.import('./src/lib/chariow.ts');

const pc = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const titre = (t) => console.log(`\n${'═'.repeat(74)}\n  ${t}\n${'═'.repeat(74)}\n`);
const lireTout = async (table, colonnes, filtrer = (q) => q) => {
  const tout = [];
  for (let de = 0; de < 80000; de += 1000) {
    const { data, error } = await filtrer(sb.from(table).select(colonnes)).range(de, de + 999);
    if (error) { console.log(`  [erreur ${table}] ${error.message}`); break; }
    if (!data?.length) break;
    tout.push(...data);
    if (data.length < 1000) break;
  }
  return tout;
};

const ventes = await listSalesEncaissees();
const abos = await lireTout('subscriptions', 'user_id, plan, amount, created_at');
const usage = await lireTout('analysis_usage', 'user_id, created_at');
const { count: comptes } = await sb.from('profiles').select('id', { count: 'exact', head: true });

titre('4. LES CHIFFRES CLES');

const totalXof = ventes.reduce((s, v) => s + (Number(v.amount?.value) || 0), 0);
const jourDe = (d) => String(d ?? '').slice(0, 10);
const dates = ventes.map((v) => v.created_at).filter(Boolean).sort();
const jours = Math.max(1, Math.round((Date.now() - Date.parse(dates[0])) / 86400000));

console.log(`  Ventes encaissées ............ ${ventes.length}`);
console.log(`  Recettes cumulées ............ ${totalXof.toLocaleString('fr-FR')} FCFA`);
console.log(`  Boutique ouverte depuis ...... ${jours} jours`);
console.log(`  Recette moyenne par jour ..... ${Math.round(totalXof / jours).toLocaleString('fr-FR')} FCFA`);

const acheteurs = new Set(ventes.map((v) => String(v.customer?.email ?? '').toLowerCase()).filter(Boolean));
console.log(`\n  Comptes inscrits ............. ${comptes ?? '—'}`);
console.log(`  Acheteurs distincts .......... ${acheteurs.size}`);
console.log(`  Conversion compte -> payant .. ${pc(acheteurs.size, comptes ?? 0)} %`);

const ontAnalyse = new Set(usage.map((u) => u.user_id)).size;
console.log(`  Comptes ayant lancé au moins une analyse : ${ontAnalyse} (${pc(ontAnalyse, comptes ?? 0)} %)`);
console.log(`  Analyses consommées au total : ${usage.length}`);

// ── Fidelisation ────────────────────────────────────────────────────────
const parClient = new Map();
for (const v of ventes) {
  const c = String(v.customer?.email ?? '').toLowerCase();
  if (!c) continue;
  if (!parClient.has(c)) parClient.set(c, []);
  parClient.get(c).push(v);
}
const revenus = [...parClient.values()].filter((l) => l.length > 1);
console.log(`\n  Ont payé plus d une fois ..... ${revenus.length} sur ${parClient.size} (${pc(revenus.length, parClient.size)} %)`);

// Epuisement du credit d entree.
const parUtilisateur = new Map();
for (const u of usage) parUtilisateur.set(u.user_id, (parUtilisateur.get(u.user_id) ?? 0) + 1);
const parCompte = new Map();
for (const a of abos) {
  if (!parCompte.has(a.user_id)) parCompte.set(a.user_id, []);
  parCompte.get(a.user_id).push(a);
}
const essentiels = [...parCompte.entries()].filter(([, l]) => l[0].plan === 'essential_monthly');
const aSec = essentiels.filter(([u]) => (parUtilisateur.get(u) ?? 0) >= 20);
const reste = essentiels.filter(([u]) => (parUtilisateur.get(u) ?? 0) < 20);
const rachat = (l) => l.filter(([, a]) => a.length > 1).length;
console.log(`\n  Entrés par l offre 2 000 F ... ${essentiels.length}`);
console.log(`    à sec (20 analyses finies) : ${aSec.length}, dont ${rachat(aSec)} ont repayé (${pc(rachat(aSec), aSec.length)} %)`);
console.log(`    il leur en reste ......... : ${reste.length}, dont ${rachat(reste)} ont repayé (${pc(rachat(reste), reste.length)} %)`);

// ── Evolution jour par jour ─────────────────────────────────────────────
titre('4b. LES DERNIERS JOURS');

const parJour = new Map();
for (const v of ventes) {
  const j = jourDe(v.created_at);
  if (!j) continue;
  if (!parJour.has(j)) parJour.set(j, { n: 0, xof: 0 });
  const e = parJour.get(j);
  e.n++;
  e.xof += Number(v.amount?.value) || 0;
}
const analysesParJour = new Map();
for (const u of usage) {
  const j = jourDe(u.created_at);
  analysesParJour.set(j, (analysesParJour.get(j) ?? 0) + 1);
}
const nouveauxParJour = new Map();
for (const [, l] of parCompte) {
  const j = jourDe(l[0].created_at);
  nouveauxParJour.set(j, (nouveauxParJour.get(j) ?? 0) + 1);
}

console.log('  jour         ventes    recettes   analyses   nouveaux abonnés');
console.log('  ' + '─'.repeat(66));
for (const j of [...parJour.keys()].sort().slice(-10)) {
  const e = parJour.get(j);
  console.log(
    `  ${j}   ${String(e.n).padStart(6)} ${String(e.xof.toLocaleString('fr-FR')).padStart(11)}` +
    ` ${String(analysesParJour.get(j) ?? 0).padStart(10)} ${String(nouveauxParJour.get(j) ?? 0).padStart(18)}`
  );
}

// ── Ce que Chariow dit du passage en caisse ─────────────────────────────
titre('4c. DE LA CAISSE AU PAIEMENT');

const { listRecentSales } = await jiti.import('./src/lib/chariow.ts');
const toutes = await listRecentSales();
const parStatut = new Map();
for (const v of toutes) parStatut.set(String(v.status), (parStatut.get(String(v.status)) ?? 0) + 1);
console.log('  Ce que la boutique enregistre, tous statuts confondus :\n');
for (const [s, n] of [...parStatut].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(6)}  ${s}`);
}
console.log(`\n  Total enregistré par la boutique : ${toutes.length}`);
console.log(`  Dont encaissé : ${ventes.length} (${pc(ventes.length, toutes.length)} %)`);
console.log('');
