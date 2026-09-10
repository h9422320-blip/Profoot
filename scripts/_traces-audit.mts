/**
 * Combien de temps la tâche d'audit prend, et à quelle heure elle passe.
 *
 * Le bloc d'apprentissage est le dernier de la tâche : s'il n'est jamais
 * atteint, la durée le dit avant tout le reste.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data, error } = await sb
  .from('audits')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(12);

if (error) {
  const { data: d2 } = await sb.from('audits').select('*').limit(1);
  console.log('colonnes : ' + Object.keys(d2?.[0] ?? {}).join(', '));
  console.log('erreur : ' + error.message);
} else {
  for (const a of data ?? [])
    console.log(
      `${String(a.cree_le ?? a.created_at).slice(0, 19)}  ${String(a.duree_ms).padStart(7)} ms  ` +
        `${a.anomalies?.length ?? 0} anomalie(s), ${a.avertissements?.length ?? 0} avertissement(s)`
    );
}
