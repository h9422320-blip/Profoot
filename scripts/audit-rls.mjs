/** Une table sans RLS est lisible par quiconque a la clé publique. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);

// La clé ANONYME : exactement ce dont dispose n'importe quel visiteur.
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const TABLES = [
  'subscriptions', 'analysis_history', 'payment_intents', 'user_profiles',
  'partners', 'preuves', 'predictions_match', 'jugements_moteur', 'cache_api',
  'analysis_usage', 'matchs_debloques', 'webhook_events', 'echecs_analyse',
  'visites_pages', 'calibrage_ligue', 'app_settings', 'conversations_vip',
];

console.log('\n  ══ CE QU UN VISITEUR PEUT LIRE AVEC LA CLÉ PUBLIQUE ══\n');
console.log('  table                    lecture   lignes   verdict');
console.log('  ' + '-'.repeat(64));

for (const t of TABLES) {
  const { data, error, count } = await anon.from(t).select('*', { count: 'exact' }).limit(1);
  let verdict, lecture;
  if (error) {
    if (/permission denied|not allowed|violates/i.test(error.message)) { lecture = 'refusée'; verdict = 'OK — protégée'; }
    else if (/does not exist|schema cache/i.test(error.message)) { lecture = '—'; verdict = 'table absente'; }
    else { lecture = 'erreur'; verdict = error.message.slice(0, 28); }
  } else if (data && data.length > 0) {
    lecture = 'AUTORISÉE'; verdict = '⚠ EXPOSÉE — données lisibles';
  } else {
    lecture = 'vide'; verdict = 'RLS active ou table vide';
  }
  console.log(`  ${t.padEnd(24)} ${String(lecture).padEnd(9)} ${String(count ?? '—').padEnd(8)} ${verdict}`);
}
console.log('');
