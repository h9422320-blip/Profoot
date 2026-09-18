// Lecture seule : en coupe d'Europe, le favori du marché (relevé AVANT le coup d'envoi)
// contre la dernière analyse lancée avant le match, sur les matchs joués.
// Tout est comparé par NOM d'équipe gagnante, pour ne pas dépendre du sens de l'analyse.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireCotesEntre } = await import('../src/lib/cotes-marche.js');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = process.argv[2] ?? '2026-09-10';
const cotes = await lireCotesEntre(new Date(depuis), new Date());
const coupe = [...cotes.values()].filter((c) => [2, 3, 848].includes(c.ligue));
const ids = coupe.map((c) => c.id);
const { data: hist } = await sb.from('analysis_history').select('fixture_id, team1_name, team2_name, score, real_score, created_at').in('fixture_id', ids);
const { data: figes } = await sb.from('predictions_match').select('fixture_id, domicile_nom, exterieur_nom').in('fixture_id', ids);
const lire = (s: any) => { const m = String(s ?? '').match(/(\d+)\s*-\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const vainqueur = (t1: string, t2: string, s: number[]) => (s[0] > s[1] ? t1 : s[0] < s[1] ? t2 : 'nul');
let n = 0, okM = 0, okA = 0, desaccords = 0, desM = 0, desA = 0;
for (const c of coupe) {
  const f = (figes ?? []).find((x) => x.fixture_id === c.id);
  const lignes = (hist ?? []).filter((x) => x.fixture_id === c.id);
  const avecReel = lignes.find((x) => lire(x.real_score));
  const avant = lignes.filter((x) => Date.parse(x.created_at) < Date.parse(c.date)).sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  if (!f || !avecReel || !avant || !lire(avant.score)) continue;
  const reel = vainqueur(avecReel.team1_name, avecReel.team2_name, lire(avecReel.real_score)!);
  const analyse = vainqueur(avant.team1_name, avant.team2_name, lire(avant.score)!);
  const marche = c.proba.dom >= c.proba.ext ? f.domicile_nom : f.exterieur_nom;
  const meme = (a: string, b: string) => a.toLowerCase().slice(0, 6) === b.toLowerCase().slice(0, 6);
  const jM = meme(marche, reel), jA = meme(analyse, reel);
  n++; okM += +jM; okA += +jA;
  if (!meme(marche, analyse)) { desaccords++; desM += +jM; desA += +jA; }
  console.log(`${f.domicile_nom}–${f.exterieur_nom} · vainqueur ${reel} · analyse ${analyse} · marché ${marche} (${c.proba.dom.toFixed(2)}/${c.proba.ext.toFixed(2)})`);
}
console.log(`${n} matchs · marché juste ${okM} · analyse juste ${okA} · désaccords ${desaccords} : marché juste ${desM}, analyse juste ${desA}`);
