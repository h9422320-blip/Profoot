/**
 * RÉCOLTE LES MOYENS DE PAIEMENT RÉELS DE CHARIOW, PAYS PAR PAYS.
 *
 * ── POURQUOI ON NE DEVINE PAS ─────────────────────────────────────────────
 *
 * La notice affichée avant la redirection annonce à l'acheteur ce qu'il va
 * trouver sur la page de paiement. Se tromper d'un opérateur, c'est promettre
 * Wave à quelqu'un qui ne le verra pas — et perdre exactement la confiance
 * qu'on cherchait à gagner.
 *
 * La page de paiement est rendue par le serveur de Chariow : les moyens
 * disponibles sont écrits dans le HTML de `?country=XX`. On les lit donc à la
 * source, pour chaque pays, plutôt que de les supposer.
 *
 * Le résultat est écrit dans `src/lib/moyens-paiement.json`, relu par
 * l'application. Relancer ce script suffit à mettre la liste à jour le jour où
 * Chariow ajoute un opérateur.
 */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { initCheckout } = await jiti.import('../src/lib/chariow.ts');

/** Tous les codes ISO-3166-1 alpha-2. */
const PAYS = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/).filter(Boolean);

async function nouvelleSession() {
  const s = await initCheckout({
    plan: 'essential_monthly',
    userId: '00000000-0000-0000-0000-000000000000',
    email: 'observation@profootai.com',
    firstName: 'Observation',
    lastName: 'ProFoot',
    paysAcheteur: 'CI',
    redirectUrl: 'https://profootai.com/payment-success',
  });
  return String(s.checkoutUrl).split('?')[0];
}

/** Les moyens de paiement lus dans la page, avec leur icône. */
function extraire(html) {
  const moyens = [];
  const motif =
    /icons\/methods\/([a-z0-9_]+)\.svg[\s\S]{0,400}?<span class="font-medium text-black">([^<]+)<\/span>/g;
  let m;
  while ((m = motif.exec(html))) {
    if (!moyens.some((x) => x.cle === m[1])) moyens.push({ cle: m[1], nom: m[2].trim() });
  }
  return moyens;
}

/** Le nom du pays tel que Chariow l'écrit, et la devise proposée. */
function contexte(html) {
  const pays = html.match(/Country<\/[^>]+>[\s\S]{0,600}?<span class="[^"]*">([^<]{2,60})<\/span>/)?.[1] ?? null;
  const devises = [...new Set([...html.matchAll(/Choose a currency[\s\S]{0,1200}?/g)].map(() => 1))].length;
  return { pays, choixDevise: devises > 0 };
}

let base = await nouvelleSession();
console.log(`\n  Session d'observation : ${base}\n`);

const resultat = {};
let vides = 0;

for (let i = 0; i < PAYS.length; i++) {
  const code = PAYS[i];
  let moyens = [];
  let nom = null;

  for (let essai = 0; essai < 2; essai++) {
    try {
      const r = await fetch(`${base}?country=${code}`, { cache: 'no-store' });
      const h = await r.text();
      moyens = extraire(h);
      nom = contexte(h).pays;
      if (moyens.length) break;
      // Page vide : la session a probablement expiré, on en refait une.
      base = await nouvelleSession();
    } catch {
      base = await nouvelleSession();
    }
  }

  if (!moyens.length) vides++;
  resultat[code] = { nom, moyens };
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${PAYS.length} pays sondés…`);
}

fs.writeFileSync('scratch-moyens-paiement.json', JSON.stringify(resultat, null, 1));

const avec = Object.entries(resultat).filter(([, v]) => v.moyens.length);
console.log(`\n  ${avec.length} pays avec moyens de paiement, ${vides} sans réponse.\n`);

// Le catalogue complet des moyens rencontrés.
const tous = new Map();
for (const [, v] of avec) for (const m of v.moyens) tous.set(m.cle, m.nom);
console.log(`  ${tous.size} moyens de paiement distincts :`);
for (const [cle, nom] of [...tous].sort()) console.log(`     ${cle.padEnd(24)} ${nom}`);
