/** PREUVE — la structure Visifoot : Resume + Scenario, sans verdict. */
import { toTeaser } from '../src/lib/analysis-teaser';
import { trahitLeVerdict } from '../src/lib/apercu-ia';

const complet = (t1: string, t2: string, f1: any, f2: any, comp: string, stade: string) => ({
  competition: comp, venue: stade,
  globalForm: { team1: { ...f1, name: t1 }, team2: { ...f2, name: t2 } },
  quickSummary: `Les buts attendus penchent vers ${t1} : 1.92 contre 1.11.`,
  predictedScore: '2-1', winner: t1, winProb: 52, drawProb: 26, loseProb: 22,
  confidence: 88, confidenceLabel: 'Très élevée',
  expectedGoals: { team1: 1.92, team2: 1.11 },
  scenarios: [{ content: `${t1} ouvre par Mendy (8/10) et scelle la victoire 2-1.` }, { content: 'B' }, { content: 'C' }],
  sections: [1,2,3,4,5,6,7].map(n => ({ titre: `S${n}` })),
});

const RENNES = { recentMatches:['W','D','L','L','L'], goalsScored:59, goalsConceded:48, cleanSheets:8, avgPossession:52, winStreak:17, played:38 };
const PSG    = { recentMatches:['D','L','D','W','L'], goalsScored:81, goalsConceded:35, cleanSheets:14, avgPossession:61, winStreak:24, played:38 };
const CITY   = { recentMatches:['L','D','W','W','L'], goalsScored:96, goalsConceded:34, cleanSheets:15, avgPossession:65, winStreak:28, played:38 };
const BOURNE = { recentMatches:['W','W','W','D','L'], goalsScored:49, goalsConceded:60, cleanSheets:5, avgPossession:44, winStreak:12, played:38 };

const CAS: [string,string,any,any,string,string][] = [
  ['Rennes','Paris Saint Germain',RENNES,PSG,'Ligue 1','Roazhon Park'],
  ['Bournemouth','Manchester City',BOURNE,CITY,'Premier League','Vitality Stadium'],
];

const INTERDITS = ['predictedScore','winner','winProb','drawProb','loseProb','expectedGoals','scenarios','scenario','sections','quickSummary'];

for (const [a,b,f1,f2,comp,stade] of CAS) {
  const g: any = await toTeaser(complet(a,b,f1,f2,comp,stade), a, b);
  console.log(`\n${'═'.repeat(74)}\n  ${a} vs ${b}  (compte GRATUIT)\n${'═'.repeat(74)}`);
  console.log(`\n  RESUME RAPIDE\n  ${g.apercuResume}\n`);
  console.log(`  SCENARIO #1\n  ${g.apercuScenario}\n`);
  console.log(`  CONFIANCE : ${g.confidence} — ${g.confidenceLabel}\n`);
  console.log(`  CHAMPS ENVOYES : ${Object.keys(g).join(', ')}\n`);
  const fuites = INTERDITS.filter(f => f in g);
  console.log(fuites.length ? `  ECHEC — ${fuites.join(', ')}` : `  OK — aucun des ${INTERDITS.length} champs exploitables.`);
  const json = JSON.stringify(g);
  // On cherche les CLES du verdict, jamais des nombres nus : 52 est aussi la
  // possession de Rennes, legitimement envoyee avec la forme affichee.
  const mots: [string,RegExp][] = [
    ['le score', /"predictedScore"|\b2\s*-\s*1\b/],
    ['les buts attendus', /"expectedGoals"|1\.92|1\.11/],
    ['une probabilite', /"winProb"|"drawProb"|"loseProb"/],
    ['un buteur', /mendy/i],
    ['un scenario', /"scenarios"|scelle la victoire/i],
  ];
  const trouves = mots.filter(([,r])=>r.test(json)).map(([q])=>q);
  console.log(trouves.length ? `  ECHEC — dans le JSON : ${trouves.join(', ')}` : `  OK — ni score, ni buts attendus, ni proba, ni buteur dans le JSON.`);
  const v = trahitLeVerdict(`${g.apercuResume} ${g.apercuScenario}`);
  console.log(v ? `  ECHEC — le texte trahit ${v}` : `  OK — le recit ne penche pour personne.`);
}
console.log('');
