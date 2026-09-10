/**
 * A-T-IL PAYÉ, ET OÙ ? — lecture seule.
 *
 * Cherche la trace d'un achat sous toutes les formes qu'elle peut prendre :
 * intention de paiement, événement de la boutique, livraison sans compte.
 * Cherche aussi le NOM, car une adresse mal saisie à la boutique laisse la
 * trace sous un autre courriel.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const email = String(process.argv[2] ?? '').trim().toLowerCase();
// De quoi retrouver une adresse mal tapée : « diarrasouleyman220 » sans le
// domaine, et le nom de famille seul.
const morceaux = [email, email.split('@')[0], 'diarra', 'souleyman'].filter(Boolean);

for (const table of ['payment_intents', 'webhook_events', 'livraisons_sans_compte']) {
  console.log(`\n=== ${table} ===`);
  const { data: echantillon, error: e0 } = await sb.from(table).select('*').limit(1);
  if (e0) { console.log('  (table absente : ' + e0.message + ')'); continue; }
  const colonnes = Object.keys(echantillon?.[0] ?? {});
  console.log('  colonnes : ' + colonnes.join(', '));

  // On relit tout et on filtre en mémoire : les traces d'un même acheteur
  // peuvent vivre dans n'importe laquelle des colonnes de texte.
  const tout: any[] = [];
  for (let de = 0; de < 40000; de += 1000) {
    const { data } = await sb.from(table).select('*').range(de, de + 999);
    tout.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const trouves = tout.filter((r) => {
    const brut = JSON.stringify(r).toLowerCase();
    return morceaux.some((m) => m.length > 4 && brut.includes(m));
  });
  console.log(`  ${tout.length} ligne(s) au total, ${trouves.length} concernant cet acheteur`);
  for (const t of trouves) console.log('  → ' + JSON.stringify(t).slice(0, 600));
}
