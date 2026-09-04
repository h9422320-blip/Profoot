/**
 * QUI EST À SEC, ABONNEMENT ENCORE VALIDE ?
 *
 * Ce sont les clients que la page des tarifs a empêchés de racheter jusqu'au
 * 4 septembre 2026 : plus une seule analyse, un accès toujours ouvert, et un
 * bouton grisé sous « Accès Actif ».
 *
 * Lecture seule.
 */
import fs from 'node:fs';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = ligne.indexOf('=');
  if (i > 0 && !ligne.startsWith('#')) process.env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
}

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const tout = async (table, colonnes) => {
  const s = [];
  for (let d = 0; d < 500_000; d += 1000) {
    const { data, error } = await sb.from(table).select(colonnes).range(d, d + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    s.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return s;
};

const QUOTA = { essential_monthly: 20, pro_monthly: 50, vip_yearly: Infinity };
const DUREE = { essential_monthly: 30, pro_monthly: 30, vip_yearly: 365 };

const abos = await tout('subscriptions', 'user_id,plan,status,expires_at,created_at');
const usages = await tout('analysis_usage', 'user_id,period_start');
const maintenant = Date.now();

/** Début de la période en cours, comme le fait `currentPeriodStart`. */
const debutPeriode = (depuis, jours) => {
  const t0 = new Date(depuis).getTime();
  const cycle = jours * 86_400_000;
  const passes = Math.floor((maintenant - t0) / cycle);
  return new Date(t0 + Math.max(0, passes) * cycle);
};

const parClient = new Map();
for (const a of abos) {
  const actif = a.expires_at ? new Date(a.expires_at).getTime() > maintenant : a.plan === 'lifetime';
  if (!actif) continue;
  const q = QUOTA[a.plan];
  if (q === undefined) continue;
  const e = parClient.get(a.user_id) ?? { quota: 0, illimite: false, debut: null, expire: null };
  if (q === Infinity) e.illimite = true;
  else e.quota += q;
  const d = debutPeriode(a.created_at, DUREE[a.plan]).toISOString();
  if (!e.debut || d < e.debut) e.debut = d;
  if (!e.expire || a.expires_at > e.expire) e.expire = a.expires_at;
  parClient.set(a.user_id, e);
};

const consommees = new Map();
for (const u of usages) {
  const e = parClient.get(u.user_id);
  if (!e || !e.debut) continue;
  // Comparer des NOMBRES : la base rend « 2026-08-15 00:00:00+00 » et le
  // calcul produit « 2026-08-15T00:00:00.000Z ». En texte, l'espace passe
  // avant le T et TOUT était écarté — le relevé annonçait 0 à sec.
  if (new Date(u.period_start).getTime() < new Date(e.debut).getTime() - 1000) continue;
  consommees.set(u.user_id, (consommees.get(u.user_id) ?? 0) + 1);
}

const asec = [];
for (const [id, e] of parClient) {
  if (e.illimite) continue;
  const utilisees = consommees.get(id) ?? 0;
  if (utilisees >= e.quota) asec.push({ id, utilisees, quota: e.quota, expire: e.expire });
}

// La liste des comptes se PAGINE : une seule page en couvre mille sur les
// sept mille sept cents, et six clients sur sept n'auraient qu'un identifiant.
const mail = new Map();
for (let page = 1; page <= 20; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  const lot = data?.users ?? [];
  for (const u of lot) mail.set(u.id, u.email);
  if (lot.length < 1000) break;
}

console.log(`ABONNÉS ACTIFS ............ ${parClient.size}`);
console.log(`À SEC, ACCÈS ENCORE OUVERT  ${asec.length}\n`);
asec
  .sort((a, b) => String(a.expire).localeCompare(String(b.expire)))
  .forEach((c) =>
    console.log(
      `  ${(mail.get(c.id) ?? c.id).padEnd(38)} ${c.utilisees}/${c.quota}  accès jusqu'au ${String(c.expire).slice(0, 10)}`
    )
  );

// ── CONTRÔLE : les plus proches de la limite ────────────────────────────────
const proches = [];
for (const [id, e] of parClient) {
  if (e.illimite) continue;
  const u = consommees.get(id) ?? 0;
  proches.push({ id, u, q: e.quota, reste: e.quota - u, expire: e.expire });
}
proches.sort((a, b) => a.reste - b.reste);
console.log('\nLES DIX PLUS PROCHES DE LA LIMITE :');
proches.slice(0, 10).forEach((c) =>
  console.log(
    `  ${(mail.get(c.id) ?? c.id).padEnd(38)} ${c.u}/${c.q}  reste ${c.reste}  jusqu'au ${String(c.expire).slice(0, 10)}`
  )
);
