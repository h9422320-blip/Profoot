/**
 * Retire la marque de fraicheur de l entretien, pour que la prochaine visite
 * du mur public le relance tout de suite au lieu d attendre vingt heures.
 *
 * Sert a verifier en production un correctif qui vit dans cette chaine.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
for (const cle of ['entretien:dernier', 'entretien:verrou']) {
  const { data } = await sb.from('cache_api').select('contenu, ecrit_le').eq('cle', cle).maybeSingle();
  console.log(`${cle} : ${data ? JSON.stringify(data.contenu).slice(0, 40) + ' (ecrit ' + String(data.ecrit_le).slice(0, 19) + ')' : 'absent'}`);
}
if (process.argv.includes('--retirer')) {
  for (const cle of ['entretien:dernier', 'entretien:verrou']) {
    const { error } = await sb.from('cache_api').delete().eq('cle', cle);
    console.log(`${error ? 'ECHEC' : 'retiree'} ${cle}`);
  }
}
