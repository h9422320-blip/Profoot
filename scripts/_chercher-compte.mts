// Lecture seule : pour une adresse de vente, les comptes existants qui lui ressemblent,
// avec leur abonnement et leur dernière activité.
//   npx tsx scripts/_chercher-compte.mts <adresse> [<adresse> …]
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tous: any[] = [];
for (let page = 1; page < 60; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  tous.push(...(data?.users ?? []));
  if (!data || data.users.length < 1000) break;
}
const lettres = (s: string) => s.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
const chiffres = (s: string) => s.split('@')[0].replace(/[^0-9]/g, '');
for (const adresse of process.argv.slice(2).map((x) => x.toLowerCase())) {
  console.log(`\n=== ${adresse}`);
  const l = lettres(adresse), c = chiffres(adresse);
  const proches = tous.filter((u) => {
    const e = String(u.email ?? '').toLowerCase();
    if (e === adresse) return true;
    const le = lettres(e);
    return (l.length >= 5 && (le.includes(l.slice(0, 6)) || l.includes(le.slice(0, 6)) && le.length >= 5)) || (c.length >= 6 && chiffres(e).includes(c.slice(0, 6)));
  });
  for (const u of proches.slice(0, 10)) {
    const { data: abo } = await sb.from('subscriptions').select('plan, status, expires_at, provider, chariow_sale_id').eq('user_id', u.id);
    const { data: h } = await sb.from('analysis_history').select('created_at').eq('user_id', u.id).order('created_at', { ascending: false }).limit(1);
    console.log(`  ${u.email} · créé ${String(u.created_at).slice(0, 16)} · connecté ${String(u.last_sign_in_at).slice(0, 16)} · dernière analyse ${h?.[0]?.created_at?.slice(0, 16) ?? '—'} · ${JSON.stringify(abo)}`);
  }
  if (!proches.length) console.log('  aucun compte ressemblant');
  const { data: pi } = await sb.from('payment_intents').select('*').ilike('email', adresse).limit(3);
  if (pi?.length) console.log('  payment_intents :', JSON.stringify(pi).slice(0, 600));
}
