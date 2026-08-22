import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Les abonnements juste AVANT et APRÈS la fenêtre, au cas où la coupure diffère.
for (const [libelle, du, au] of [
  ['15 août', '2026-08-15T00:00:00Z', '2026-08-16T00:00:00Z'],
  ['22 août après 11 h', '2026-08-22T11:00:00Z', '2026-08-23T00:00:00Z'],
]) {
  const { data } = await sb.from('subscriptions').select('plan, amount, created_at, status')
    .gte('created_at', du).lt('created_at', au).order('created_at');
  const somme = (data ?? []).reduce((s, a) => s + Number(a.amount ?? 0), 0);
  console.log(`\n  ${libelle} : ${data?.length ?? 0} abonnement(s), ${somme} FCFA`);
  for (const a of data ?? []) console.log(`     ${a.created_at.slice(0,16)}  ${a.plan}  ${a.amount}  ${a.status}`);
}

// Des paiements enregistrés comme échoués côté site mais peut-être encaissés.
const { data: ech } = await sb.from('echecs_paiement').select('*')
  .gte('cree_le', '2026-08-16T00:00:00Z').lt('cree_le', '2026-08-23T00:00:00Z')
  .order('cree_le');
console.log(`\n  Échecs de paiement relevés sur la période : ${ech?.length ?? 'table absente'}`);
for (const e of (ech ?? []).slice(0, 20))
  console.log(`     ${String(e.cree_le).slice(0,16)}  ${e.email ?? '—'}  ${e.plan ?? '—'}  ${e.cause ?? e.message ?? ''}`.slice(0, 130));
console.log('');
