/**
 * TOUT CE QUE LA BASE SAIT D'UN ACHETEUR. LECTURE SEULE.
 *
 * Quand quelqu'un écrit « j'ai payé et je n'ai rien reçu », il y a cinq
 * endroits à regarder, et un seul oublié suffit à répondre à côté :
 *
 *   1. son compte — existe-t-il, sous quelle orthographe exacte ;
 *   2. ses abonnements — ouverts, expirés, à quel nom de vente ;
 *   3. les intentions de paiement parties de profootai.com ;
 *   4. les messages reçus de la boutique, qui portent les achats faits
 *      depuis la vitrine publique sans passer par le site ;
 *   5. le journal du pulse, où dorment les ventes REFUSÉES — une clé
 *      manquante dans l'adresse, et l'accès n'a jamais été ouvert.
 *
 *   node scripts/enquete-client.mjs adresse@exemple.com
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const cible = String(process.argv[2] ?? '').trim().toLowerCase();
if (!cible) throw new Error('usage : node scripts/enquete-client.mjs adresse@exemple.com');
const local = cible.split('@')[0];
console.log(`════ ${cible} ════\n`);

// ── 1. LE COMPTE, ET SES VOISINS ORTHOGRAPHIQUES ──────────────────────────
const users = [];
for (let p = 1; p <= 40; p++) {
  const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 1000 });
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const exact = users.find((u) => String(u.email).toLowerCase() === cible);
console.log('1. COMPTE');
if (exact) {
  console.log(`   TROUVÉ  ${exact.id}`);
  console.log(`   créé le ${String(exact.created_at).slice(0, 16)}   |   dernière entrée : ${exact.last_sign_in_at ? String(exact.last_sign_in_at).slice(0, 16) : 'JAMAIS'}`);
} else {
  console.log('   AUCUN COMPTE à cette adresse exacte.');
}
const voisins = users.filter((u) => {
  const e = String(u.email).toLowerCase();
  if (e === cible) return false;
  return e.includes(local.slice(0, 8)) || local.includes(e.split('@')[0].slice(0, 8));
});
if (voisins.length) {
  console.log(`   adresses proches (faute de frappe possible) : ${voisins.length}`);
  for (const v of voisins.slice(0, 6)) console.log(`      ${v.email}  créé ${String(v.created_at).slice(0, 10)}`);
}

// ── 2. SES ABONNEMENTS ────────────────────────────────────────────────────
console.log('\n2. ACCÈS');
const ids = [exact, ...voisins].filter(Boolean).map((u) => u.id);
if (ids.length) {
  const { data } = await sb.from('subscriptions').select('*').in('user_id', ids);
  if (!data?.length) console.log('   AUCUN abonnement.');
  for (const s of data ?? []) {
    const qui = users.find((u) => u.id === s.user_id)?.email;
    const ouvert = s.expires_at && new Date(s.expires_at) > new Date();
    console.log(`   ${qui}  ${s.plan}  ${s.amount}F  ${s.provider}  ${String(s.created_at).slice(0,10)} → ${String(s.expires_at).slice(0,10)}  ${ouvert ? 'OUVERT' : 'expiré'}  vente=${s.chariow_sale_id}`);
  }
} else console.log('   (pas de compte, donc pas d’accès possible)');

// ── 3. LES INTENTIONS DE PAIEMENT ─────────────────────────────────────────
console.log('\n3. PAIEMENTS PARTIS DE PROFOOTAI.COM');
const { data: pi } = await sb.from('payment_intents').select('*').ilike('email', `%${local}%`);
if (!pi?.length) console.log('   aucune trace.');
for (const p of pi ?? []) {
  console.log(`   ${String(p.created_at).slice(0,16)}  ${p.email}  ${p.plan}  ${p.amount}F  statut=${p.statut_boutique}  vente=${p.sale_id}  ${p.consumed_at ? 'ACCÈS OUVERT' : 'non consommée'}`);
}

// ── 4. LES MESSAGES DE LA BOUTIQUE ────────────────────────────────────────
console.log('\n4. MESSAGES REÇUS DE LA BOUTIQUE');
const ev = [];
for (let d = 0; d < 50000; d += 1000) {
  const { data } = await sb.from('webhook_events').select('provider,event,received_at,payload').range(d, d + 999);
  ev.push(...(data ?? [])); if (!data || data.length < 1000) break;
}
const siens = ev.filter((e) => JSON.stringify(e.payload ?? {}).toLowerCase().includes(local));
if (!siens.length) console.log('   aucun message ne le mentionne.');
for (const e of siens) {
  const p = e.payload ?? {};
  console.log(`   [${e.provider}/${e.event}] ${String(e.received_at).slice(0,16)}  ${JSON.stringify(p).slice(0, 260)}`);
}

// ── 5. LE JOURNAL DU PULSE, OÙ DORMENT LES REFUS ──────────────────────────
console.log('\n5. JOURNAL DU PULSE MAKETOU');
const { data: journal } = await sb.from('cache_api').select('cle,contenu,ecrit_le').like('cle', 'maketou%');
let vu = 0;
for (const j of journal ?? []) {
  if (!Array.isArray(j.contenu)) continue;
  for (const e of j.contenu) {
    if (!JSON.stringify(e).toLowerCase().includes(local)) continue;
    vu++;
    console.log(`   ${String(e.recuLe).slice(0,16)}  ${e.evenement}  ${e.email}  ${e.produit ?? ''}  ${e.montant ?? ''}`);
    if (e.refuse) console.log(`      >>> REFUSÉ : ${e.refuse}`);
    if (e.resultat) console.log(`      résultat : ${JSON.stringify(e.resultat).slice(0, 200)}`);
  }
}
if (!vu) console.log('   rien dans le journal (il ne garde que sept jours).');
