/**
 * CE QUE LE MOTEUR A ANNONCÉ SUR LES SÉLECTIONS, ET CE QUI EST ARRIVÉ.
 *
 * Les prédictions réelles de production, confrontées à leur résultat. C'est la
 * seule preuve qui vaille : le banc ne rejoue que des clubs.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const lignes: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb
    .from('analysis_history')
    .select('fixture_id, competition, score, real_score, predicted_winner, real_winner, winner_correct, created_at')
    .not('verified_at', 'is', null)
    .not('fixture_id', 'is', null)
    .order('id', { ascending: true })
    .range(de, de + 999);
  if (error) throw new Error(error.message);
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const inter = /Nations League|Africa Cup|Friendlies|Qualification|CONCACAF|Copa|Euro|World Cup/i;
const sel = lignes.filter((l) => inter.test(String(l.competition ?? '')));
// Une rencontre compte pour une : la première analyse vérifiée fait foi.
const parMatch = new Map<number, any>();
for (const l of sel) if (!parMatch.has(Number(l.fixture_id))) parMatch.set(Number(l.fixture_id), l);
const m = [...parMatch.values()];
console.log(`${lignes.length} analyses vérifiées, dont ${sel.length} de sélections → ${m.length} rencontres distinctes\n`);

const issue = (s: string | null) => { const x = String(s ?? '').match(/(-?\d+)\s*-\s*(-?\d+)/); if (!x) return null; const a = +x[1], b = +x[2]; return a > b ? 0 : a === b ? 1 : 2; };
const NOM = ['domicile', 'nul', 'extérieur'];
const avec = m.map((l) => ({ a: issue(l.score), r: issue(l.real_score) })).filter((x) => x.a !== null && x.r !== null);
console.log(`${avec.length} rencontres lisibles des deux côtés`);
for (const [titre, champ] of [['CE QUI ARRIVE', 'r'], ['CE QUE LE MOTEUR ANNONCE', 'a']] as const) {
  console.log(`\n${titre}`);
  for (let i = 0; i < 3; i++) {
    const n = avec.filter((x) => (x as any)[champ] === i).length;
    console.log(`  ${NOM[i].padEnd(10)} ${String(n).padStart(4)}  ${((100 * n) / avec.length).toFixed(1)} %`);
  }
}
const justes = avec.filter((x) => x.a === x.r).length;
console.log(`\nvainqueurs justes : ${justes}/${avec.length} — ${((100 * justes) / avec.length).toFixed(1)} %`);
for (let i = 0; i < 3; i++) {
  const l = avec.filter((x) => x.a === i);
  if (l.length >= 15) console.log(`  quand il annonce ${NOM[i].padEnd(10)} (${l.length}) → juste ${((100 * l.filter((x) => x.r === i).length) / l.length).toFixed(1)} %`);
}
