/**
 * Vide les listes du jour rangées dans la réserve, pour qu'elles soient
 * rebâties avec les coupes d'Europe.
 *
 * Les cartes du carrousel sont mises de côté jusqu'à minuit. Élargir la liste
 * des compétitions ne change donc rien tant que la version d'hier dort en
 * réserve : il faut la retirer une fois, la suivante se reconstruit seule.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const jours = [0, 1].map((d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10));
const cles = [
  'selection:du-jour-v2',
  ...jours.flatMap((j) => [`matchs-du-jour:v1:${j}`, `prochains-grands-matchs:v1:${j}`]),
];

for (const cle of cles) {
  const { error } = await sb.from('cache_api').delete().eq('cle', cle);
  console.log(`${error ? 'ECHEC  ' : 'retiree'} ${cle}${error ? ' — ' + error.message : ''}`);
}
