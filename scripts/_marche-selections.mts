/**
 * LE MARCHÉ CONTRE LA NOTE ELO, SUR LES MATCHS DE SÉLECTIONS JOUÉS.
 *
 * Mesure en avant : les cotes sont relevées avant le match depuis le
 * 22 septembre 2026 (`SELECTIONS_COTEES_EN_OBSERVATION`), la note Elo est
 * celle de la réserve. Le marché ne sera branché (`MARCHE_EN_OBSERVATION`)
 * que s'il bat la note Elo ici.
 *
 *   npx tsx scripts/_marche-selections.mts 2026-09-23 2026-10-15
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireCotesEntre, SELECTIONS_COTEES_EN_OBSERVATION } = await import('../src/lib/cotes-marche.js');
const { lireEloSelections, avisEloPour } = await import('../src/lib/forces-selections.js');
const [debut, fin] = [process.argv[2] ?? '2026-09-23', process.argv[3] ?? new Date().toISOString().slice(0, 10)];
const cotes = await lireCotesEntre(new Date(debut), new Date(fin + 'T23:59:59Z'));
const elo: any = await lireEloSelections();
const cle = process.env.API_FOOTBALL_KEY;
const get = async (p: string) => (await (await fetch('https://v3.football.api-sports.io/' + p, { headers: { 'x-apisports-key': String(cle) } })).json());
const t: Record<string, { n: number; marche: number; elo: number; desac: number; desacMarche: number; brierM: number; brierE: number }> = {};
for (const c of cotes.values()) {
  if (!SELECTIONS_COTEES_EN_OBSERVATION.includes(Number(c.ligue))) continue;
  const f = (await get(`fixtures?id=${c.id}`)).response?.[0];
  if (!f || !['FT', 'AET', 'PEN'].includes(f.fixture.status.short)) continue;
  const e = (avisEloPour as any)(elo, f.teams.home.id, f.teams.away.id, c.ligue);
  if (!e) continue;
  const bd = f.goals.home, be = f.goals.away, reel = bd > be ? 0 : bd === be ? 1 : 2;
  const pm = [c.proba.dom, c.proba.nul, c.proba.ext], pe = [e.dom, e.nul, e.ext];
  const vm = pm[0] >= pm[2] ? 0 : 2, ve = pe[0] >= pe[2] ? 0 : 2;
  const k = String(c.ligue); t[k] ??= { n: 0, marche: 0, elo: 0, desac: 0, desacMarche: 0, brierM: 0, brierE: 0 };
  const x = t[k]; x.n++; if (vm === reel) x.marche++; if (ve === reel) x.elo++;
  if (vm !== ve) { x.desac++; if (vm === reel) x.desacMarche++; }
  x.brierM += pm.reduce((s, v, i) => s + (v - (i === reel ? 1 : 0)) ** 2, 0);
  x.brierE += pe.reduce((s, v, i) => s + (v - (i === reel ? 1 : 0)) ** 2, 0);
}
for (const [l, x] of Object.entries(t))
  console.log(`ligue ${l} : ${x.n} matchs · marché ${x.marche} justes · Elo ${x.elo} justes · désaccords ${x.desac} (marché juste ${x.desacMarche}) · Brier marché ${(x.brierM / x.n).toFixed(4)} Elo ${(x.brierE / x.n).toFixed(4)}`);
if (!Object.keys(t).length) console.log('Aucun match de sélections joué avec cote relevée dans la période.');
