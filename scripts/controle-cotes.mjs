/**
 * LE POINT DE CONTRÔLE DES COTES.
 *
 * ── CE QU'IL RÉPOND ───────────────────────────────────────────────────────
 *
 * Le marché est-il meilleur que notre moteur ? Et un mélange des deux bat-il
 * chacun pris seul ? Trois questions qui décident si les cotes méritent
 * d'entrer en production.
 *
 * ── POURQUOI IL PEUT TOURNER DÈS AUJOURD'HUI ──────────────────────────────
 *
 * On croyait devoir attendre trois semaines que les analyses s'accumulent.
 * Deux choses ont supprimé ce délai :
 *
 *   — la validation n'a pas besoin de nos abonnés. Il faut une cote, un
 *     résultat, et ce que le modèle aurait dit. Rien de tout cela n'exige
 *     qu'un client ait payé pour l'analyse ;
 *
 *   — interrogé championnat par championnat, le fournisseur rend aussi les
 *     rencontres RÉCEMMENT JOUÉES. Le relevé du 24 août 2026 a ramené des
 *     matchs du 17 au 23, déjà terminés.
 *
 * ── LA RÈGLE QUI REND LA MESURE HONNÊTE ───────────────────────────────────
 *
 * Le modèle est reconstruit sur le seul passé de chaque match : il ne voit
 * jamais le résultat qu'il annonce. Et le verdict se prend sur DEUX MOITIÉS
 * séparées — un mélange qui ne gagne que sur l'une est du hasard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { chargerMatchs, nouveauJuge, normaliser } from './banc.mjs';
import { meilleurPoisson } from './modeles3.mjs';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { lireCotesEntre } = await jiti.import('./src/lib/cotes-marche.ts');

// ── Les cotes relevées, sur les trente derniers jours ────────────────────
const fin = new Date();
const debut = new Date(fin.getTime() - 30 * 86400000);
const cotes = await lireCotesEntre(debut, fin);
console.log(`\n  Fenetre lue : du ${debut.toISOString().slice(0, 10)} au ${fin.toISOString().slice(0, 10)}`);
console.log(`  ${cotes.size} rencontres cotées en réserve.`);
console.log(`  cle de service : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'presente' : 'ABSENTE'}`);

// ── Les résultats, depuis notre collecte ─────────────────────────────────
const matchs = chargerMatchs();
const parId = new Map(matchs.map((m) => [m.id, m]));

const utilisables = [...cotes.values()].filter((c) => parId.has(c.id));
console.log(`  ${utilisables.length} d'entre elles sont jouées et connues.\n`);

if (utilisables.length < 30) {
  console.log('  Trop peu pour conclure. Le relevé quotidien fera grossir ce nombre.\n');
  process.exit(0);
}

// ── On rejoue le modèle jusqu'à chaque match ─────────────────────────────
//
// Un seul parcours chronologique : le modèle apprend de tout, et l'on note sa
// prédiction au moment où il rencontre un match coté.
const aMesurer = new Set(utilisables.map((c) => c.id));
const modele = meilleurPoisson();
const predictions = new Map();

for (const m of matchs) {
  if (aMesurer.has(m.id)) predictions.set(m.id, modele.predire(m));
  modele.apprendre(m);
}

// ── Les candidats ────────────────────────────────────────────────────────
const MELANGES = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1];

const versBanc = (p) => ({ dom: p.dom, nul: p.nul, ext: p.ext });

const juges = new Map();
const moities = new Map();
for (const w of MELANGES) {
  const nom = w === 0 ? 'Modele seul' : w === 1 ? 'Marche seul' : `Melange ${Math.round(w * 100)} % marche`;
  juges.set(w, nouveauJuge(nom));
  moities.set(w, [nouveauJuge(nom), nouveauJuge(nom)]);
}

const tries = utilisables.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
const milieu = Date.parse(tries[Math.floor(tries.length / 2)].date);

let sansPrediction = 0;

for (const c of tries) {
  const p = predictions.get(c.id);
  const reel = parId.get(c.id);
  if (!p || !reel) { sansPrediction++; continue; }

  for (const w of MELANGES) {
    // Moyenne géométrique : deux avis qui doutent produisent un doute, pas une
    // moyenne tiède. C'est la façon habituelle de mélanger des probabilités.
    const melange = normaliser({
      dom: Math.pow(p.probas.dom, 1 - w) * Math.pow(c.proba.dom, w),
      nul: Math.pow(p.probas.nul, 1 - w) * Math.pow(c.proba.nul, w),
      ext: Math.pow(p.probas.ext, 1 - w) * Math.pow(c.proba.ext, w),
    });
    juges.get(w).ajouter(versBanc(melange), p.score, reel);
    moities.get(w)[Date.parse(c.date) < milieu ? 0 : 1].ajouter(versBanc(melange), p.score, reel);
  }
}

if (sansPrediction) console.log(`  (${sansPrediction} rencontres sans prediction rejouable, ecartees)\n`);

console.log('  ══ LE MARCHE CONTRE LE MOTEUR ══\n');
console.log('  candidat                     matchs  vainqueur     Brier   log-loss   1re moitie  2e moitie  verdict');
console.log('  ' + '─'.repeat(104));

const base = juges.get(0).bilan();
const baseA = moities.get(0)[0].bilan();
const baseB = moities.get(0)[1].bilan();
const s = (v, d = 1) => (v > 0 ? '+' : '') + Math.round(v * 10 ** d) / 10 ** d;

for (const w of MELANGES) {
  const b = juges.get(w).bilan();
  const a = moities.get(w)[0].bilan();
  const c = moities.get(w)[1].bilan();
  const dA = Math.round((a.vainqueur - baseA.vainqueur) * 10) / 10;
  const dB = Math.round((c.vainqueur - baseB.vainqueur) * 10) / 10;
  const verdict = w === 0 ? '<- reference' : dA > 0 && dB > 0 ? 'TIENT' : dA < 0 && dB < 0 ? 'pire' : 'ne tient pas';
  console.log(
    `  ${b.nom.padEnd(28)} ${String(b.n).padStart(5)} ${String(b.vainqueur).padStart(9)} %` +
    ` ${String(b.brier).padStart(9)} ${String(b.logloss).padStart(10)}` +
    ` ${(w === 0 ? '' : s(dA) + ' pt').padStart(11)} ${(w === 0 ? '' : s(dB) + ' pt').padStart(10)}  ${verdict}`
  );
}

// ── Le segment qui compte pour la suite : les matchs internes ────────────
const COUPES = new Set([2, 3, 848, 531]);
const internes = tries.filter((c) => !COUPES.has(c.ligue));
if (internes.length >= 30) {
  console.log('\n  ══ SUR LES SEULS MATCHS DE CHAMPIONNAT ══\n');
  console.log('  candidat                     matchs  vainqueur   log-loss');
  console.log('  ' + '─'.repeat(58));
  for (const w of MELANGES) {
    const j = nouveauJuge('');
    for (const c of internes) {
      const p = predictions.get(c.id);
      const reel = parId.get(c.id);
      if (!p || !reel) continue;
      const melange = normaliser({
        dom: Math.pow(p.probas.dom, 1 - w) * Math.pow(c.proba.dom, w),
        nul: Math.pow(p.probas.nul, 1 - w) * Math.pow(c.proba.nul, w),
        ext: Math.pow(p.probas.ext, 1 - w) * Math.pow(c.proba.ext, w),
      });
      j.ajouter(versBanc(melange), p.score, reel);
    }
    const b = j.bilan();
    const nom = w === 0 ? 'Modele seul' : w === 1 ? 'Marche seul' : `Melange ${Math.round(w * 100)} % marche`;
    console.log(`  ${nom.padEnd(28)} ${String(b.n).padStart(5)} ${String(b.vainqueur).padStart(9)} % ${String(b.logloss).padStart(10)}`);
  }
}

// ── La calibration du marche : sert-il de reference fiable ? ─────────────
console.log('\n  ══ LE MARCHE EST-IL BIEN CALIBRE ? ══\n');
for (const x of juges.get(1).calibration().filter((c) => c.n >= 15)) {
  console.log(`    ${String(x.de).padStart(3)}-${String(x.a).padStart(3)} %  ${String(x.n).padStart(4)} matchs   promis ${String(x.promis).padStart(3)} %  tenu ${String(x.tenu).padStart(3)} %   ${x.promis - x.tenu > 0 ? '+' : ''}${x.promis - x.tenu} pt`);
}
console.log('');
