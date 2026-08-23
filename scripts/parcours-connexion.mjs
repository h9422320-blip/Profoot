/** Le chemin des gens qui butent sur la connexion. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data } = await sb.from('visites_pages').select('*').order('entre_le', { ascending: false }).limit(3000);

const passages = new Map();
for (const l of data ?? []) {
  const liste = passages.get(l.visite_id) ?? [];
  liste.push(l);
  passages.set(l.visite_id, liste);
}
for (const l of passages.values()) l.sort((a, b) => a.ordre - b.ordre);

console.log(`\n  ${data?.length ?? 0} pages vues · ${passages.size} visites\n`);

// ── Combien touchent aux pages de connexion ─────────────────────────────
const compte = new Map();
for (const l of data ?? []) compte.set(l.chemin, (compte.get(l.chemin) ?? 0) + 1);
console.log('  ══ PAGES LIÉES À LA CONNEXION ══\n');
for (const c of ['/login', '/signup', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe'])
  console.log(`  ${c.padEnd(30)} ${compte.get(c) ?? 0} vue(s)`);

// ── Les parcours qui passent par « mot de passe oublié » ────────────────
console.log('\n  ══ LES VISITES QUI CHERCHENT À RÉCUPÉRER UN MOT DE PASSE ══\n');
let n = 0;
for (const [, liste] of passages) {
  if (!liste.some((l) => l.chemin.includes('mot-de-passe'))) continue;
  n++;
  if (n <= 12)
    console.log(`  ${String(liste[0].pays ?? '—').padEnd(3)} ${liste.map((l) => l.chemin).join(' → ')}`);
}
console.log(`\n  ${n} visite(s) sur ${passages.size} — ${Math.round((n / Math.max(1, passages.size)) * 100)} %`);

// ── Et celles qui butent sur /login sans aller plus loin ────────────────
let bloques = 0;
for (const [, liste] of passages) {
  const derniere = liste[liste.length - 1];
  if (derniere.chemin === '/login' && liste.length > 1) bloques++;
}
console.log(`  ${bloques} visite(s) se terminent sur /login — la personne n'est pas entrée.\n`);
