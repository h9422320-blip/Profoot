/**
 * LES CINQ CAS DOUTEUX, TRANCHÉS UN PAR UN.
 *
 * Le contrôle général les a signalés parce qu'il suppose qu'une vente doit
 * toujours produire un abonnement. Ce n'est pas vrai de l'achat à l'unité, et
 * ce n'est pas vrai des ventes antérieures au mécanisme actuel. On regarde donc
 * ce que chaque compte POSSÈDE réellement et ce qu'il a PU FAIRE.
 *
 * Lecture seule.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const quand = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

const CAS = [
  ['gopegop65@gmail.com', '2 achats à 600 F — achat de match à l unité'],
  ['kuzmabah@gmail.com', '9 000 F le 08/08 — aucune trace payment_intents'],
  ['ob42654@gmail.com', '6 000 F le 07/08 — aucune trace payment_intents'],
  ['thebigfood2@gmail.com', '5 000 F le 07/08 — aucune trace payment_intents'],
  ['pascalirung@gmail.com', '3 000 F — accès ouvert, zéro analyse'],
];

// Toutes les pages de comptes, pour retrouver un identifiant depuis un e-mail.
const comptes = new Map();
for (let page = 1; page <= 30; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  const lot = data?.users ?? [];
  for (const u of lot) comptes.set(String(u.email).toLowerCase(), u);
  if (lot.length < 200) break;
}
console.log(`Comptes lus : ${comptes.size}\n`);

for (const [email, contexte] of CAS) {
  console.log(`========================================================`);
  console.log(`${email}`);
  console.log(`  contexte : ${contexte}`);

  const u = comptes.get(email.toLowerCase());
  if (!u) { console.log('  !! AUCUN COMPTE avec cette adresse'); continue; }
  console.log(`  compte créé le ${quand(u.created_at)} — dernière connexion ${quand(u.last_sign_in_at)}`);

  const { data: abos } = await sb.from('subscriptions').select('*').eq('user_id', u.id).order('created_at', { ascending: false });
  if (!abos?.length) console.log('  abonnement : AUCUN');
  for (const a of abos ?? []) {
    const vivant = a.status === 'active' && (!a.expires_at || new Date(a.expires_at) > new Date());
    console.log(`  abonnement : ${a.plan} — ${a.status} — ${a.amount} F — expire ${quand(a.expires_at)} ${vivant ? '(VIVANT)' : '(éteint)'}`);
  }

  const { count: analyses } = await sb.from('analysis_history').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
  console.log(`  analyses lancées : ${analyses ?? 0}`);

  const { data: dernieres } = await sb.from('analysis_history')
    .select('team1_name, team2_name, created_at').eq('user_id', u.id)
    .order('created_at', { ascending: false }).limit(3);
  for (const d of dernieres ?? []) console.log(`     ${quand(d.created_at)}  ${d.team1_name} — ${d.team2_name}`);

  // Achats à l'unité, s'il en existe une table.
  for (const t of ['match_purchases', 'achats_match', 'analysis_credits', 'credits']) {
    const { data, error } = await sb.from(t).select('*').eq('user_id', u.id);
    if (error) continue;
    console.log(`  table « ${t} » : ${data?.length ?? 0} ligne(s)`);
    for (const r of data ?? []) console.log(`     ${JSON.stringify(r).slice(0, 200)}`);
  }

  const { data: traces } = await sb.from('payment_intents').select('sale_id, plan, amount, created_at, consumed_at').eq('user_id', u.id).order('created_at', { ascending: false });
  console.log(`  traces de paiement : ${traces?.length ?? 0}`);
  for (const t of traces ?? []) console.log(`     ${quand(t.created_at)} ${t.amount} F ${t.plan} — consommée ${quand(t.consumed_at)}`);
  console.log('');
}
