/**
 * Les 244 qui cliquent une offre puis ne font rien : quittent-ils le site,
 * ou vont-ils ailleurs chez nous ?
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const depuis = new Date(Date.now() - 3 * 86400000).toISOString();
const lignes = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('visites_pages')
    .select('visite_id, chemin, entre_le, mobile, pays')
    .gte('entre_le', depuis)
    .order('entre_le', { ascending: true })
    .range(de, de + 999);
  if (error) { console.log('erreur: ' + error.message); break; }
  if (!data?.length) break; lignes.push(...data); if (data.length < 1000) break;
}
console.log(`\n  ${lignes.length} lignes lues sur 3 jours.\n`);

const parVisite = new Map();
for (const l of lignes) {
  if (!parVisite.has(l.visite_id)) parVisite.set(l.visite_id, []);
  parVisite.get(l.visite_id).push(l);
}

const etapeDe = (chemin) => (String(chemin).startsWith('/~') ? String(chemin).slice(2).split('/')[0] : null);
const ISSUES = new Set(['notice-continuer', 'notice-fermee', 'notice-auto', 'depart-caisse']);

let evapores = 0, avecIssue = 0;
let partisDuSite = 0, allesAilleurs = 0;
let evaporeMobile = 0, evaporeOrdi = 0, issueMobile = 0, issueOrdi = 0;
const apres = new Map();
const paysEvapores = new Map();

for (const [, liste] of parVisite) {
  const iClic = liste.findIndex((l) => etapeDe(l.chemin) === 'offre-cliquee');
  if (iClic < 0) continue;

  const suite = liste.slice(iClic + 1);
  const aUneIssue = suite.some((l) => ISSUES.has(etapeDe(l.chemin) ?? ''));
  const mobile = liste[iClic].mobile === true;

  if (aUneIssue) {
    avecIssue++;
    if (mobile) issueMobile++; else issueOrdi++;
    continue;
  }

  evapores++;
  if (mobile) evaporeMobile++; else evaporeOrdi++;
  const p = liste[iClic].pays ?? '??';
  paysEvapores.set(p, (paysEvapores.get(p) ?? 0) + 1);

  const pagesApres = suite.filter((l) => !String(l.chemin).startsWith('/~'));
  if (!pagesApres.length) partisDuSite++;
  else {
    allesAilleurs++;
    const d = pagesApres[0].chemin;
    apres.set(d, (apres.get(d) ?? 0) + 1);
  }
}

console.log('  ══ APRÈS LE CLIC SUR UNE OFFRE ══\n');
console.log(`  ${String(avecIssue).padStart(4)}  ont une issue enregistrée`);
console.log(`  ${String(evapores).padStart(4)}  n'en ont aucune`);
console.log(`\n  Parmi ces ${evapores} :`);
console.log(`  ${String(partisDuSite).padStart(4)}  n'ouvrent plus AUCUNE page — ils ont quitté le site`);
console.log(`  ${String(allesAilleurs).padStart(4)}  ouvrent une autre page de ProFoot`);

if (apres.size) {
  console.log(`\n  ══ OÙ VONT CEUX QUI RESTENT ══\n`);
  for (const [c, n] of [...apres].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${String(n).padStart(4)}  ${c}`);
  }
}

const pc = (a, b) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);
console.log(`\n  ══ TÉLÉPHONE OU ORDINATEUR ? ══\n`);
console.log(`  Sur téléphone   : ${evaporeMobile} évaporés, ${issueMobile} avec issue  →  ${pc(evaporeMobile, issueMobile)} % d'évaporation`);
console.log(`  Sur ordinateur  : ${evaporeOrdi} évaporés, ${issueOrdi} avec issue  →  ${pc(evaporeOrdi, issueOrdi)} % d'évaporation`);

console.log(`\n  ══ PAYS DES ÉVAPORÉS ══\n`);
for (const [p, n] of [...paysEvapores].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${String(n).padStart(4)}  ${p}`);
}
console.log('');
