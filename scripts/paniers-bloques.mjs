/**
 * QUI D'AUTRE A PU PAYER SANS RECEVOIR ? — LECTURE SEULE.
 *
 * ── CE QUE CE SCRIPT VOIT, ET CE QU'IL NE VOIT PAS ────────────────────────
 *
 * Les paniers vivent chez la boutique, pas chez nous, et nous n'avons pas de
 * clé pour l'interroger. Le cas du 5 septembre 2026 le montre bien : le
 * client avait six paniers VIP bloqués « en attente de paiement » dans le
 * tableau de bord MakeTou, et RIEN de tout cela n'existait dans notre base —
 * il était passé par la vitrine publique, sans jamais toucher notre caisse.
 *
 * Ce script cherche donc les SIGNAUX INDIRECTS, ceux qu'on peut voir d'ici :
 *
 *   A. les passages en caisse partis de profootai.com qui n'ont jamais abouti ;
 *   B. les comptes vivants — connectés récemment — sans le moindre accès ;
 *   C. les ventes arrivées au pulse SANS ouvrir d'accès, quelle qu'en soit la
 *      raison : c'est le seul endroit où une vente perdue laisse une trace.
 *
 * Aucun de ces trois signaux ne prouve un paiement. Ils désignent les comptes
 * à vérifier dans la page « Paniers » de la boutique, filtrée sur « en attente
 * de paiement ».
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tout = async (t, c) => { const o = []; for (let d = 0; d < 200000; d += 1000) { const { data, error } = await sb.from(t).select(c).range(d, d + 999); if (error) throw new Error(t + ' : ' + error.message); o.push(...(data ?? [])); if (!data || data.length < 1000) break; } return o; };

const JOURS = Number(process.argv[2] ?? 7);
const depuis = new Date(Date.now() - JOURS * 86_400_000).toISOString();
console.log(`Fenêtre : ${JOURS} derniers jours (depuis le ${depuis.slice(0, 10)})\n`);

const users = [];
for (let p = 1; p <= 40; p++) {
  const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 1000 });
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const parId = new Map(users.map((u) => [u.id, u]));
const parEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));

const subs = await tout('subscriptions', 'user_id,plan,expires_at,chariow_sale_id,created_at');
const avecAcces = new Set(subs.filter((s) => new Date(s.expires_at) > new Date()).map((s) => s.user_id));

// ── A. NOS PROPRES PASSAGES EN CAISSE SANS SUITE ──────────────────────────
console.log('══ A. PASSAGES EN CAISSE PARTIS DE PROFOOTAI.COM ET RESTÉS SANS SUITE ══');
const pi = await tout('payment_intents', 'sale_id,email,plan,amount,statut_boutique,user_id,consumed_at,created_at');
const enPanne = pi.filter((p) => {
  if (String(p.created_at) < depuis) return false;
  if (p.consumed_at) return false;
  if (['completed', 'settled'].includes(String(p.statut_boutique))) return false;
  const u = parEmail.get(String(p.email).toLowerCase());
  return u && !avecAcces.has(u.id);
});
console.log(`   ${enPanne.length} passage(s) sans accès ouvert, chez des gens qui ONT un compte\n`);
const parPersonne = new Map();
for (const p of enPanne) {
  const k = String(p.email).toLowerCase();
  parPersonne.set(k, [...(parPersonne.get(k) ?? []), p]);
}
for (const [email, l] of [...parPersonne].sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
  const u = parEmail.get(email);
  const derniere = l.map((x) => x.created_at).sort().pop();
  console.log(`   ${email.padEnd(40)} ${String(l.length).padStart(2)} tentative(s)  dernière ${String(derniere).slice(0,16)}  offre ${l[0].plan}`);
  console.log(`      compte créé ${String(u.created_at).slice(0,10)}  |  dernière entrée ${u.last_sign_in_at ? String(u.last_sign_in_at).slice(0,16) : 'JAMAIS'}`);
}

// ── B. COMPTES VIVANTS SANS AUCUN ACCÈS ───────────────────────────────────
console.log('\n══ B. COMPTES CONNECTÉS RÉCEMMENT ET SANS AUCUN ACCÈS ══');
const vivants = users.filter((u) => u.last_sign_in_at && String(u.last_sign_in_at) >= depuis && !avecAcces.has(u.id));
console.log(`   ${vivants.length} compte(s) — la plupart n'ont simplement jamais payé.`);
const insistants = vivants.filter((u) => parPersonne.has(String(u.email).toLowerCase()));
console.log(`   dont ${insistants.length} ont AUSSI un passage en caisse sans suite  <<< à vérifier en priorité`);
for (const u of insistants.slice(0, 15)) console.log(`      ${u.email}`);

// ── C. VENTES ARRIVÉES AU PULSE SANS OUVRIR D'ACCÈS ───────────────────────
console.log('\n══ C. VENTES ARRIVÉES AU PULSE SANS OUVRIR D’ACCÈS ══');
const { data: journal } = await sb.from('cache_api').select('cle,contenu').like('cle', 'maketou%');
let examinees = 0, muettes = 0;
for (const j of journal ?? []) {
  if (!Array.isArray(j.contenu)) continue;
  for (const e of j.contenu) {
    if (String(e.evenement ?? '') !== 'SUCCESSFUL_SALE') continue;
    examinees++;
    const ouvert = e?.resultat?.ouvert === true;
    const dejaCredite = /déjà créditée/i.test(String(e?.resultat?.motif ?? ''));
    if (ouvert || dejaCredite) continue;
    muettes++;
    console.log(`   ${String(e.recuLe).slice(0,16)}  ${e.email}  ${e.produit ?? ''}  ${e.montant ?? ''}`);
    console.log(`      ${e.refuse ? 'REFUSÉ : ' + e.refuse : 'motif : ' + JSON.stringify(e.resultat ?? {}).slice(0, 200)}`);
  }
}
console.log(`   ${examinees} vente(s) examinée(s) dans le journal, ${muettes} sans ouverture d’accès.`);

console.log('\n── CE QUE CE SCRIPT NE PEUT PAS VOIR ──');
console.log('   Les paniers de la boutique. Un acheteur venu par la vitrine publique');
console.log('   n’apparaît nulle part ici tant que son paiement n’aboutit pas.');
console.log('   À contrôler dans MakeTou → Paniers, filtre « En attente de paiement ».');
