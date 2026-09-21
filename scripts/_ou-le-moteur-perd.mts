// Lecture seule d'un résultat de banc : où le moteur se trompe, et de combien.
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const liste: any[] = r.variantes[process.argv[3] ?? 'champion'];
const pc = (a: number, n: number) => (n ? ((100 * a) / n).toFixed(1) + ' %' : '—');
const NOMS: any = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1' };

function table(titre: string, cle: (p: any) => string | null, ordre?: string[]) {
  const par = new Map<string, { n: number; justes: number; annonce: number; brier: number }>();
  for (const p of liste) {
    const k = cle(p);
    if (k === null) continue;
    const c = par.get(k) ?? { n: 0, justes: 0, annonce: 0, brier: 0 };
    c.n++;
    if (p.parScore === p.reel) c.justes++;
    c.annonce += p.probas[p.parScore];
    c.brier += p.probas.reduce((s: number, v: number, i: number) => s + (v - (i === p.reel ? 1 : 0)) ** 2, 0);
    par.set(k, c);
  }
  console.log('\n── ' + titre);
  const cles = ordre ?? [...par.keys()].sort();
  for (const k of cles) {
    const c = par.get(k);
    if (!c) continue;
    const annonce = (100 * c.annonce) / c.n;
    const reel = (100 * c.justes) / c.n;
    console.log(
      `   ${k.padEnd(26)} ${String(c.n).padStart(5)} matchs · annoncé ${annonce.toFixed(1)} % · arrivé ${reel.toFixed(1)} % · écart ${(reel - annonce >= 0 ? '+' : '') + (reel - annonce).toFixed(1)}`
    );
  }
}

console.log(`${liste.length} rencontres · ${pc(liste.filter((p) => p.parScore === p.reel).length, liste.length)} de vainqueurs justes`);
table('par championnat', (p) => NOMS[p.ligue] ?? String(p.ligue));
table('par certitude annoncée', (p) => {
  const m = Math.max(...p.probas);
  if (m < 0.4) return 'a. moins de 40 %';
  if (m < 0.5) return 'b. 40 à 50 %';
  if (m < 0.6) return 'c. 50 à 60 %';
  if (m < 0.7) return 'd. 60 à 70 %';
  return 'e. 70 % et plus';
});
table('selon le camp annoncé', (p) => (p.parScore === 0 ? 'a. celui qui reçoit' : p.parScore === 1 ? 'b. le nul' : 'c. celui qui se déplace'));
table('par mois de la saison', (p) => {
  const mois = Number(String(p.date).slice(5, 7));
  if ([8, 9].includes(mois)) return 'a. août-septembre';
  if ([10, 11].includes(mois)) return 'b. octobre-novembre';
  if ([12, 1].includes(mois)) return 'c. décembre-janvier';
  if ([2, 3].includes(mois)) return 'd. février-mars';
  return 'e. avril-mai';
});
table('par total de buts attendus', (p) => {
  const t = (p.butsAttendus?.[0] ?? 0) + (p.butsAttendus?.[1] ?? 0);
  if (t < 2.2) return 'a. moins de 2,2';
  if (t < 2.6) return 'b. 2,2 à 2,6';
  if (t < 3.0) return 'c. 2,6 à 3,0';
  return 'd. 3,0 et plus';
});
// Le nul : le moteur ne l'annonce presque jamais, et il arrive souvent.
const nuls = liste.filter((p) => p.reel === 1).length;
const nulsAnnonces = liste.filter((p) => p.parScore === 1).length;
console.log(`\n── le nul : annoncé ${pc(nulsAnnonces, liste.length)} des rencontres, arrivé ${pc(nuls, liste.length)}`);
// Et quand le moteur se trompe, perd-il contre le nul ou contre l'autre camp ?
const rates = liste.filter((p) => p.parScore !== p.reel && p.parScore !== 1);
console.log(
  `── sur ${rates.length} pronostics ratés (hors nul annoncé) : ${pc(rates.filter((p) => p.reel === 1).length, rates.length)} finissent par un nul, ` +
    `${pc(rates.filter((p) => p.reel !== 1).length, rates.length)} par la victoire de l'autre`
);
