/* L'apprentissage quotidien tourne-t-il ? Lecture seule. */
import fs from 'node:fs';
for (const brut of fs.readFileSync('.env.local', 'utf8').split(String.fromCharCode(10))) {
  const l = brut.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { count } = await sb.from('jugements_moteur').select('*', { count: 'exact', head: true });
const { data: derniers } = await sb.from('jugements_moteur').select('juge_le, date_match').order('juge_le', { ascending: false }).limit(1);
console.log('jugements en tout : ' + count + ' ; dernier jugement ecrit le ' + String(derniers?.[0]?.juge_le).slice(0, 16) + ' (match du ' + String(derniers?.[0]?.date_match).slice(0, 10) + ')');
for (let d = 0; d < 4; d++) {
  const j = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const { count: n } = await sb.from('jugements_moteur').select('*', { count: 'exact', head: true }).gte('juge_le', j + 'T00:00:00Z').lte('juge_le', j + 'T23:59:59Z');
  console.log('  juges le ' + j + ' : ' + n);
}
for (const cle of ['fiabilite:apprise-v6', 'forces:occasions-v6', 'forces-championnats:v1']) {
  const { data } = await sb.from('cache_api').select('ecrit_le').eq('cle', cle).maybeSingle();
  const h = data?.ecrit_le ? ((Date.now() - Date.parse(data.ecrit_le)) / 3600000).toFixed(1) + ' h' : 'ABSENT';
  console.log('  ' + cle.padEnd(24) + ' ecrit il y a ' + h);
}
const { data: cal } = await sb.from('calibrage_moteur').select('*').limit(1);
console.log('  calibrage_moteur : ' + (cal ? 'lisible' : 'absent'));
