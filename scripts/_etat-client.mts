/**
 * L'ÉTAT EXACT D'UN CLIENT AVANT TOUT GESTE COMMERCIAL.
 *
 * Ne modifie RIEN. Sert à savoir ce qu'il a payé, ce qui lui reste, et ce
 * qu'il a réellement consommé — avant de décider quoi lui offrir.
 *
 *   npx tsx scripts/_etat-client.mts adresse@exemple.com
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { computeEntitlements } = await import('../src/lib/subscription.js');

const email = String(process.argv[2] ?? '').trim().toLowerCase();
if (!email) { console.log('Usage : npx tsx scripts/_etat-client.mts adresse@exemple.com'); process.exit(1); }

const sb = createAdminClient();

// ── LE COMPTE ───────────────────────────────────────────────────────────────
let compte: any = null;
for (let page = 1; page <= 20 && !compte; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('ERREUR : ' + error.message); break; }
  compte = (data?.users ?? []).find((u: any) => String(u.email ?? '').toLowerCase() === email) ?? null;
  if ((data?.users ?? []).length < 1000) break;
}

if (!compte) { console.log(`AUCUN COMPTE pour ${email}`); process.exit(0); }

console.log(`=== ${compte.email} ===`);
console.log(`  identifiant : ${compte.id}`);
console.log(`  inscrit le  : ${String(compte.created_at).slice(0, 19)}`);
console.log(`  derniere    : ${String(compte.last_sign_in_at ?? '—').slice(0, 19)}`);

// ── SES ABONNEMENTS ─────────────────────────────────────────────────────────
const { data: subs } = await sb
  .from('subscriptions')
  .select('*')
  .eq('user_id', compte.id)
  .order('created_at', { ascending: true });

console.log(`\n=== ${subs?.length ?? 0} ABONNEMENT(S) ===`);
for (const s of subs ?? []) {
  const actif = s.expires_at ? new Date(s.expires_at).getTime() > Date.now() : s.plan === 'lifetime';
  console.log(
    `  ${String(s.plan).padEnd(20)} cree ${String(s.created_at).slice(0, 10)}` +
      ` expire ${String(s.expires_at ?? '—').slice(0, 10)}  ${actif ? 'ACTIF' : 'expire'}` +
      `  statut=${s.status ?? '—'}`
  );
}
console.log('  colonnes : ' + Object.keys(subs?.[0] ?? {}).join(', '));

// ── SES DROITS, TELS QUE L'APPLICATION LES CALCULE ──────────────────────────
const droits = await computeEntitlements(sb as any, compte as any);
console.log('\n=== DROITS CALCULES PAR L APPLICATION ===');
console.log('  ' + JSON.stringify(droits));

// ── SA CONSOMMATION ─────────────────────────────────────────────────────────
const { data: usages } = await sb
  .from('analysis_usage')
  .select('*')
  .eq('user_id', compte.id)
  .order('created_at', { ascending: true });

console.log(`\n=== ${usages?.length ?? 0} ANALYSE(S) DECOMPTEE(S) ===`);
for (const u of usages ?? [])
  console.log(`  ${String(u.created_at).slice(0, 19)}  periode ${String(u.period_start).slice(0, 10)}  ${u.match_key}  (${u.plan})`);

const debut = droits.periodStart;
if (debut) {
  const dansPeriode = (usages ?? []).filter((u: any) => String(u.period_start) >= String(debut));
  console.log(`\n  periode en cours depuis ${String(debut).slice(0, 19)}`);
  console.log(`  consommees sur la periode : ${dansPeriode.length}`);
  console.log(`  limite : ${droits.analysisLimit}`);
  console.log(`  RESTANTES : ${Math.max(0, Number(droits.analysisLimit) - dansPeriode.length)}`);
}
