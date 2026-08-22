/** Les deux chemins possibles, mesurés au même instant. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── 1. La base (chemin de secours) ─────────────────────────────────────────
const { data: abos } = await sb.from('subscriptions').select('amount, currency, chariow_sale_id, moneroo_payment_id, created_at')
  .gte('created_at', '2026-08-16T00:00:00Z');
const base = (abos ?? []).filter((a) => a.chariow_sale_id || a.moneroo_payment_id)
  .reduce((s, a) => s + Number(a.amount ?? 0), 0);
console.log(`\n  Base (abonnements)      : ${base.toLocaleString('fr-FR')} FCFA sur ${abos.length} ligne(s)`);

// ── 2. La boutique (chemin normal) ─────────────────────────────────────────
const ventes = [];
let url = 'https://api.chariow.com/v1/sales?per_page=100';
for (let p = 0; p < 60 && url; p++) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (Array.isArray(d?.data)) ventes.push(...d.data);
  let s = d?.pagination?.next_page_url ?? null;
  if (s) { const u = new URL(s); u.searchParams.set('per_page', '100'); s = u.toString(); }
  url = s;
}
const jourDe = (v) => String(v.completed_at ?? v.created_at).slice(0, 10);
const payees = ventes.filter((v) => ['completed', 'settled'].includes(v.status) && jourDe(v) >= '2026-08-16');
const boutique = payees.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
console.log(`  Boutique (Chariow)      : ${boutique.toLocaleString('fr-FR')} FCFA sur ${payees.length} vente(s)`);

// ── 3. Ce que la réserve contient ──────────────────────────────────────────
const { data: res } = await sb.from('cache_api').select('contenu, ecrit_le, expire_le').eq('cle', 'chariow:recettes-jour').maybeSingle();
if (!res) console.log(`  Réserve                 : VIDE — la page n'est jamais passée par Chariow`);
else {
  const somme = Object.entries(res.contenu).filter(([j]) => j >= '2026-08-16').reduce((s, [, p]) => s + p.xof, 0);
  console.log(`  Réserve (écrite ${String(res.ecrit_le).slice(11,16)}) : ${somme.toLocaleString('fr-FR')} FCFA — expire à ${String(res.expire_le).slice(11,16)}`);
}
console.log('');
