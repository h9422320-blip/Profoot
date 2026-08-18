/**
 * D'OÙ VIENNENT LES VISITEURS, ET AVEC QUOI.
 *
 * Lit l'origine relevée à l'inscription et à chaque connexion. Tant qu'un
 * abonné n'est pas revenu depuis la mise en place, il reste « non relevé » —
 * c'est normal, le parc se renseigne à mesure que les gens se connectent.
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

const comptes = [];
for (let page = 1; page <= 30; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  const lot = data?.users ?? [];
  comptes.push(...lot);
  if (lot.length < 200) break;
}

const { data: analyses } = await sb.from('analysis_history').select('user_id').limit(6000);
const actifs = new Set((analyses ?? []).map((a) => a.user_id));

const releves = comptes.filter((u) => u.user_metadata?.origine_vue_le);
console.log(`Comptes : ${comptes.length} — origine relevée pour ${releves.length}`);
if (!releves.length) {
  console.log('\nAucun relevé pour le moment. Il faut au moins une connexion ou une');
  console.log('inscription depuis la mise en service pour que ce tableau se remplisse.');
  process.exit(0);
}

const tableau = (titre, cle) => {
  const par = new Map();
  for (const u of releves) {
    const v = String(u.user_metadata?.[cle] ?? 'inconnu');
    const e = par.get(v) ?? { n: 0, actifs: 0 };
    e.n++;
    if (actifs.has(u.id)) e.actifs++;
    par.set(v, e);
  }
  console.log(`\n=============== ${titre} ===============`);
  console.log('  valeur                  | comptes | ont analysé');
  for (const [v, e] of [...par].sort((a, b) => b[1].n - a[1].n)) {
    const pct = e.n ? Math.round((100 * e.actifs) / e.n) : 0;
    const alerte = e.n >= 5 && pct < 30 ? '   <-- FAIBLE' : '';
    console.log(`  ${v.padEnd(23)} | ${String(e.n).padStart(7)} | ${String(e.actifs).padStart(5)} (${String(pct).padStart(3)} %)${alerte}`);
  }
};

tableau('PAYS', 'pays');
tableau('SYSTÈME', 'systeme');
tableau('NAVIGATEUR', 'navigateur');
tableau('NAVIGATEUR INTÉGRÉ (Instagram, TikTok…)', 'navigateur_integre');

console.log('\n=============== TÉLÉPHONE OU ORDINATEUR ===============');
const mobiles = releves.filter((u) => u.user_metadata?.mobile);
console.log(`  Téléphone   : ${mobiles.length} (${Math.round((100 * mobiles.length) / releves.length)} %)`);
console.log(`  Ordinateur  : ${releves.length - mobiles.length}`);

console.log('\n=============== LES DERNIERS ARRIVÉS ===============');
for (const u of releves.sort((a, b) => new Date(b.user_metadata.origine_vue_le) - new Date(a.user_metadata.origine_vue_le)).slice(0, 15)) {
  const m = u.user_metadata;
  console.log(
    `  ${new Date(m.origine_vue_le).toLocaleString('fr-FR')}  ${String(m.pays ?? '??').padEnd(3)} ` +
    `${String(m.systeme).padEnd(8)} ${String(m.navigateur).padEnd(16)} ` +
    `${m.navigateur_integre ? '[' + m.navigateur_integre + '] ' : ''}${actifs.has(u.id) ? 'a analysé' : 'aucune analyse'}  ${u.email}`
  );
}
