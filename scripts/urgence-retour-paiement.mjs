/**
 * URGENCE — que voit un acheteur EN REVENANT de la caisse ?
 *
 * S'il retombe sur la page de connexion, il vient de payer et le site lui
 * redemande son mot de passe. C'est le genre de chose qui fait dire « le site
 * bugue », et personne ne le signale : on abandonne, on ne se plaint pas.
 *
 * Lecture seule.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const depuis = new Date(Date.now() - 10 * 86400000).toISOString();
const lignes = [];
for (let de = 0; de < 80000; de += 1000) {
  const { data, error } = await sb
    .from('visites_pages')
    .select('visite_id, chemin, entre_le, mobile, pays')
    .gte('entre_le', depuis)
    .order('entre_le', { ascending: true })
    .range(de, de + 999);
  if (error) { console.log('  erreur : ' + error.message); break; }
  if (!data?.length) break;
  lignes.push(...data);
  if (data.length < 1000) break;
}

const parVisite = new Map();
for (const l of lignes) {
  if (!parVisite.has(l.visite_id)) parVisite.set(l.visite_id, []);
  parVisite.get(l.visite_id).push(l);
}

const etape = (c) => (String(c).startsWith('/~') ? String(c).slice(2).split('/')[0] : null);

let partisEnCaisse = 0;
let revenusSucces = 0;
let revenusLogin = 0;
let revenusEchec = 0;
let jamaisRevenus = 0;
const apresCaisse = new Map();

for (const [, l] of parVisite) {
  const i = l.findIndex((x) => etape(x.chemin) === 'depart-caisse');
  if (i < 0) continue;
  partisEnCaisse++;

  const suite = l.slice(i + 1).filter((x) => !String(x.chemin).startsWith('/~'));
  if (!suite.length) { jamaisRevenus++; continue; }

  const premiere = String(suite[0].chemin);
  apresCaisse.set(premiere, (apresCaisse.get(premiere) ?? 0) + 1);

  if (premiere.startsWith('/payment-success')) revenusSucces++;
  else if (premiere.startsWith('/login')) revenusLogin++;
  else if (premiere.startsWith('/payment-failed')) revenusEchec++;
}

const pc = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

console.log(`\n  ══ APRES LE DEPART VERS LA CAISSE — 10 DERNIERS JOURS ══\n`);
console.log(`  ${partisEnCaisse} visites sont parties vers Chariow.\n`);
console.log(`  ${String(revenusSucces).padStart(5)}  reviennent sur la page de confirmation   ${pc(revenusSucces, partisEnCaisse)} %`);
console.log(`  ${String(revenusLogin).padStart(5)}  retombent sur la page de CONNEXION       ${pc(revenusLogin, partisEnCaisse)} %`);
console.log(`  ${String(revenusEchec).padStart(5)}  reviennent sur la page d echec           ${pc(revenusEchec, partisEnCaisse)} %`);
console.log(`  ${String(jamaisRevenus).padStart(5)}  ne reviennent jamais sur le site         ${pc(jamaisRevenus, partisEnCaisse)} %`);

if (apresCaisse.size) {
  console.log(`\n  ══ LA PREMIERE PAGE VUE AU RETOUR ══\n`);
  for (const [c, n] of [...apresCaisse].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${String(n).padStart(5)}  ${c}`);
  }
}
console.log('');
