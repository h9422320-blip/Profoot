/** PREUVE — le cas exact vu en production : Rennes vs PSG, forme 1-1-3 et 1-2-2. */
import { composerApercu } from '../src/lib/apercu-vendeur';
import { trahitLeVerdict } from '../src/lib/apercu-ia';

// Donnees telles que l API les rend : buts et victoires SUR LA SAISON.
const RENNES = { recentMatches:['W','D','L','L','L'], goalsScored:59, goalsConceded:48, cleanSheets:8, avgPossession:52, winStreak:17, played:38, name:'Rennes' };
const PSG    = { recentMatches:['D','L','D','W','L'], goalsScored:81, goalsConceded:35, cleanSheets:14, avgPossession:61, winStreak:24, played:38, name:'Paris Saint Germain' };
const CITY   = { recentMatches:['L','D','W','W','L'], goalsScored:96, goalsConceded:34, cleanSheets:15, avgPossession:65, winStreak:28, played:38, name:'Manchester City' };
const BOURNE = { recentMatches:['W','W','W','D','L'], goalsScored:49, goalsConceded:60, cleanSheets:5, avgPossession:44, winStreak:12, played:38, name:'Bournemouth' };

const CAS: [string,string,any,any,any][] = [
  ['Rennes','Paris Saint Germain',RENNES,PSG,{competition:'Ligue 1',stade:'Roazhon Park'}],
  ['Bournemouth','Manchester City',BOURNE,CITY,{competition:'Premier League',stade:'Vitality Stadium'}],
  ['Manchester City','Rennes',CITY,RENNES,{competition:'Ligue des Champions',stade:'Etihad Stadium'}],
];

for (const [a,b,f1,f2,ctx] of CAS) {
  const t = composerApercu(a,b,f1,f2,ctx);
  console.log(`\n${'─'.repeat(76)}`);
  console.log(`  ${a} vs ${b}`);
  console.log(`${'─'.repeat(76)}\n`);
  console.log(`  ${t}\n`);
  const absurdites = [
    [/\b\d{2,}\s+victoires?\s+cons/i, 'une serie de 2 chiffres'],
    [/\b([4-9]|\d{2,})[.,]\d\s+buts?\s+par\s+match/i, 'une moyenne de buts irrealiste'],
    [/La première équipe|La seconde/, 'un nom d equipe manquant'],
  ] as [RegExp,string][];
  const trouve = absurdites.filter(([r]) => r.test(t)).map(([,q]) => q);
  console.log(trouve.length ? `  ECHEC — ${trouve.join(', ')}` : `  OK — noms presents, chiffres realistes.`);
  const f = trahitLeVerdict(t);
  console.log(f ? `  ECHEC — trahit ${f}` : `  OK — aucun verdict revele.`);
}
console.log('');
