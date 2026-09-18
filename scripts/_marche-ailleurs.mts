// Lecture seule : dans les compétitions où le marché n'est PAS branché, le favori du marché
// (relevé avant le coup d'envoi) contre la dernière analyse lancée avant le match.
// Comparaison par NOM d'équipe gagnante. Usage : npx tsx scripts/_marche-ailleurs.mts [depuis]
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireCotesDuJourPatiemment } = await import('../src/lib/cotes-marche.js');
const { avisDuMarcheBranche } = await import('../src/lib/couche-marche.js');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = process.argv[2] ?? '2026-08-01';
const cotes: any[] = [];
for (let t = Date.parse(depuis); t < Date.now(); t += 86400000) {
  const r = await lireCotesDuJourPatiemment(new Date(t).toISOString().slice(0, 10));
  for (const m of r?.matchs ?? []) if (!avisDuMarcheBranche(m.ligue)) cotes.push(m);
}
const ids = cotes.map((c) => c.id);
const hist: any[] = [], figes: any[] = [];
for (let i = 0; i < ids.length; i += 200) {
  const { data: h } = await sb.from('analysis_history').select('fixture_id, team1_name, team2_name, score, real_score, created_at').in('fixture_id', ids.slice(i, i + 200));
  hist.push(...(h ?? []));
  const { data: f } = await sb.from('predictions_match').select('fixture_id, domicile_nom, exterieur_nom, competition').in('fixture_id', ids.slice(i, i + 200));
  figes.push(...(f ?? []));
}
const lire = (s: any) => { const m = String(s ?? '').match(/(\d+)\s*-\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const vainqueur = (t1: string, t2: string, s: number[]) => (s[0] > s[1] ? t1 : s[0] < s[1] ? t2 : 'nul');
const meme = (a: string, b: string) => a.toLowerCase().slice(0, 6) === b.toLowerCase().slice(0, 6);
const parLigue = new Map<string, number[]>();
const tot = [0, 0, 0, 0, 0, 0];
for (const c of cotes) {
  const f = figes.find((x) => x.fixture_id === c.id);
  const lignes = hist.filter((x) => x.fixture_id === c.id);
  const avecReel = lignes.find((x) => lire(x.real_score));
  const avant = lignes.filter((x) => Date.parse(x.created_at) < Date.parse(c.date)).sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  if (!f || !avecReel || !avant || !lire(avant.score)) continue;
  const reel = vainqueur(avecReel.team1_name, avecReel.team2_name, lire(avecReel.real_score)!);
  const analyse = vainqueur(avant.team1_name, avant.team2_name, lire(avant.score)!);
  const marche = c.proba.dom >= c.proba.ext ? f.domicile_nom : f.exterieur_nom;
  const jM = meme(marche, reel), jA = meme(analyse, reel), d = !meme(marche, analyse);
  const k = `${c.ligue} ${f.competition}`;
  const v = parLigue.get(k) ?? [0, 0, 0, 0, 0, 0];
  const add = (a: number[]) => { a[0]++; a[1] += +jM; a[2] += +jA; if (d) { a[3]++; a[4] += +jM; a[5] += +jA; } };
  add(v); add(tot); parLigue.set(k, v);
}
for (const [k, v] of [...parLigue].sort((a, b) => b[1][0] - a[1][0])) console.log(`${k} : ${v[0]} matchs · marché ${v[1]} · analyse ${v[2]} · désaccords ${v[3]} (marché ${v[4]}, analyse ${v[5]})`);
console.log(`TOTAL : ${tot[0]} matchs · marché ${tot[1]} · analyse ${tot[2]} · désaccords ${tot[3]} (marché ${tot[4]}, analyse ${tot[5]})`);
