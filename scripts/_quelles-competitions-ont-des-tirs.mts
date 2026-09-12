/**
 * QUELLES COMPÉTITIONS LE FOURNISSEUR DOCUMENTE-T-IL EN TIRS ? Lecture seule.
 *
 * La moitié « occasions » du moteur vaut 60 % de son calcul, et elle exige les
 * tirs des DEUX clubs. Tout championnat absent du relevé rend le moteur
 * aveugle sur chaque match où l'un de ses clubs apparaît — y compris en coupe
 * d'Europe.
 *
 * Ce balayage prend deux rencontres déjà jouées par compétition et regarde si
 * la fiche du fournisseur contient « Shots on Goal » et « Shots insidebox ».
 * Douce par construction : une demande à la fois, une demi-seconde de pause,
 * et la réserve répond pour tout ce qui a déjà été lu.
 *
 *   npx tsx scripts/_quelles-competitions-ont-des-tirs.mts
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES } from './challenger/commun.mjs';

chargerEnv();
const { apiFootball, CACHE_TTL } = await import('../src/lib/api-football.js');
const { CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');

const dejaAuReleve = new Set<number>((CHAMPIONNATS as unknown as any[]).map((c) => Number(c.id)));
const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
rencontres.sort((a, b) => b.date.localeCompare(a.date));

// Deux rencontres récentes par compétition, et le nom d'un club pour s'y retrouver.
const parLigue = new Map<number, any[]>();
for (const m of rencontres) {
  const l = Number(m.ligue);
  const liste = parLigue.get(l) ?? [];
  if (liste.length < 2) {
    liste.push(m);
    parLigue.set(l, liste);
  }
}

const nombre = (stats: any[], type: string) => {
  const s = stats?.find((x: any) => x?.type === type);
  const v = Number(s?.value);
  return Number.isFinite(v) ? v : null;
};

const avecTirs: { ligue: number; exemple: string; cadres: number; surface: number }[] = [];
const sansTirs: { ligue: number; exemple: string }[] = [];
const indecis: { ligue: number; exemple: string }[] = [];

for (const [ligue, matchs] of [...parLigue].sort((a, b) => a[0] - b[0])) {
  if (dejaAuReleve.has(ligue)) continue;
  let verdict: 'avec' | 'sans' | 'indecis' = 'indecis';
  let cadres = 0;
  let surface = 0;
  for (const m of matchs) {
    try {
      const r = await apiFootball<any>(`/fixtures/statistics?fixture=${m.id}`, CACHE_TTL.TEAM_INFO);
      const rep = Array.isArray(r) ? r : (r?.response ?? []);
      if (rep.length < 2) continue;
      const c = nombre(rep[0]?.statistics, 'Shots on Goal');
      const s = nombre(rep[0]?.statistics, 'Shots insidebox');
      if (c !== null && s !== null) {
        verdict = 'avec';
        cadres = c;
        surface = s;
        break;
      }
      verdict = 'sans';
    } catch {
      // Une fiche illisible ne dit rien de la compétition : on essaie l'autre.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const exemple = `${matchs[0].nomDom} — ${matchs[0].nomExt}`;
  if (verdict === 'avec') avecTirs.push({ ligue, exemple, cadres, surface });
  else if (verdict === 'sans') sansTirs.push({ ligue, exemple });
  else indecis.push({ ligue, exemple });
  await new Promise((r) => setTimeout(r, 500));
}

console.log(`${dejaAuReleve.size} compétitions sont déjà au relevé des tirs.\n`);
console.log(`── CANDIDATES : le fournisseur documente leurs tirs (${avecTirs.length}) ──`);
for (const x of avecTirs) console.log(`  ligue ${String(x.ligue).padEnd(5)} ${x.exemple.slice(0, 46).padEnd(46)} (${x.cadres} cadrés, ${x.surface} dans la surface)`);
console.log(`\n── SANS TIRS : aucun relevé ne pourra jamais les couvrir (${sansTirs.length}) ──`);
for (const x of sansTirs) console.log(`  ligue ${String(x.ligue).padEnd(5)} ${x.exemple.slice(0, 46)}`);
if (indecis.length) {
  console.log(`\n── INDÉCISES : fiches illisibles aujourd'hui (${indecis.length}) ──`);
  for (const x of indecis) console.log(`  ligue ${String(x.ligue).padEnd(5)} ${x.exemple.slice(0, 46)}`);
}
console.log(`\nÀ essayer : ${avecTirs.map((x) => x.ligue).join(', ')}`);
