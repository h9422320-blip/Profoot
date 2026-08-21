import { toTeaser } from '../src/lib/analysis-teaser';

const analyseComplete = (t1: string, t2: string, f1: any, f2: any, extra: any) => ({
  team1: { name: t1, logo: 'l1' }, team2: { name: t2, logo: 'l2' },
  competition: 'Ligue 1', date: '2026-08-22', venue: 'Stade',
  globalForm: { team1: f1, team2: f2 },
  // ── TOUT CE QUI DOIT RESTER AU CHAUD ──
  quickSummary: `Les buts attendus penchent vers ${t1} : 1.9 contre 1.36.`,
  predictedScore: '2-1', winner: t1,
  winProb: 52, drawProb: 26, loseProb: 22,
  confidence: 88, confidenceLabel: 'Très élevée',
  expectedGoals: { team1: 1.9, team2: 1.36 },
  scenarios: [
    `${t1} ouvre le score à la 15e par Mendy (note 8/10), puis scelle la victoire 2-1.`,
    'Scénario 2 : match nul 1-1 après égalisation tardive.',
    'Scénario 3 : victoire étriquée 1-0.',
  ],
  sections: [1,2,3,4,5,6,7].map(n => ({ titre: `Section ${n}`, texte: 'contenu payant' })),
  ...extra,
});

const CAS = [
  { nom: 'FAVORI NET', t1: 'Real Madrid', t2: 'Espanyol',
    f1: { recentMatches:['W','W','W','W','D'], goalsScored:12, goalsConceded:3, cleanSheets:3, avgPossession:62, winStreak:4 },
    f2: { recentMatches:['L','L','D','L','W'], goalsScored:4, goalsConceded:9, cleanSheets:1, avgPossession:41, winStreak:0 } },
  { nom: 'MATCH SERRE', t1: 'Arsenal', t2: 'Coventry',
    f1: { recentMatches:['W','W','D','W','W'], goalsScored:9, goalsConceded:4, cleanSheets:2, avgPossession:58, winStreak:2 },
    f2: { recentMatches:['W','D','W','L','W'], goalsScored:8, goalsConceded:6, cleanSheets:2, avgPossession:47, winStreak:1 } },
  { nom: 'GROS OUTSIDER', t1: 'Marseille', t2: 'Strasbourg',
    f1: { recentMatches:['W','L','W','W','L'], goalsScored:8, goalsConceded:7, cleanSheets:1, avgPossession:54, winStreak:0 } ,
    f2: { recentMatches:['L','L','L','L','D'], goalsScored:2, goalsConceded:11, cleanSheets:0, avgPossession:38, winStreak:0 } },
];

const INTERDITS = ['predictedScore','winner','winProb','drawProb','loseProb','confidence','confidenceLabel','expectedGoals','scenarios','sections','quickSummary','scenario'];
const MOTS_INTERDITS = [/\b2\s*-\s*1\b/, /\b1\.9\b/, /\b1\.36\b/, /\b52\s*%/, /très élevée/i, /Mendy/i, /buts attendus/i, /victoire\s+2/i];

let toutBon = true;
const apercus: string[] = [];

for (const c of CAS) {
  const complet = analyseComplete(c.t1, c.t2, c.f1, c.f2, {});
  const gratuit = await toTeaser(complet);
  const json = JSON.stringify(gratuit);
  apercus.push(String(gratuit.apercu));

  console.log(`\n${'═'.repeat(78)}`);
  console.log(`  ${c.nom} — ${c.t1} vs ${c.t2}`);
  console.log('═'.repeat(78));
  console.log(`\n  CE QUE LE GRATUIT REÇOIT (apercu) :\n`);
  console.log(`  « ${gratuit.apercu} »\n`);

  console.log(`  CHAMPS PRESENTS DANS LA REPONSE SERVEUR :`);
  console.log(`     ${Object.keys(gratuit).join(', ')}\n`);

  const fuites = INTERDITS.filter(f => f in gratuit);
  const mots = MOTS_INTERDITS.filter(r => r.test(json));

  if (fuites.length) { toutBon = false; console.log(`  ECHEC — champs verrouilles presents : ${fuites.join(', ')}`); }
  else console.log(`  OK — aucun des ${INTERDITS.length} champs verrouilles n est present.`);

  if (mots.length) { toutBon = false; console.log(`  ECHEC — valeur verrouillee trouvee dans le JSON : ${mots}`); }
  else console.log(`  OK — ni score, ni proba, ni buts attendus, ni buteur dans le JSON brut.`);

  // Le payant, lui, doit tout avoir.
  const payant = complet;
  const manquants = INTERDITS.filter(f => f !== 'scenario' && !(f in payant));
  console.log(manquants.length ? `  ECHEC PAYANT — manque : ${manquants}` : `  OK — le payant recoit bien les ${INTERDITS.length - 1} champs complets.`);
}

console.log(`\n${'═'.repeat(78)}`);
console.log('  SPECIFICITE : les trois apercus sont-ils differents ?');
console.log('═'.repeat(78));
const uniques = new Set(apercus);
console.log(`\n  ${uniques.size} texte(s) distinct(s) sur ${apercus.length} matchs.`);
if (uniques.size !== apercus.length) { toutBon = false; console.log('  ECHEC — deux matchs produisent le meme texte.'); }
else console.log('  OK — chaque affiche a son propre texte.\n');

console.log(toutBon ? '  >>> TOUT EST VERROUILLE <<<\n' : '  >>> DES FUITES SUBSISTENT <<<\n');
process.exit(toutBon ? 0 : 1);
