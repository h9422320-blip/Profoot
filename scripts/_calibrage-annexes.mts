// Lecture seule : les chiffres annexes affichés tiennent-ils leur promesse ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = process.argv[2] ?? '2026-08-21';
const lignes: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data } = await sb
    .from('analysis_history')
    .select('analysis_data, real_score, competition, created_at, fixture_id')
    .not('verified_at', 'is', null)
    .gte('created_at', `${depuis}T00:00:00Z`)
    // Sans ORDRE, deux lectures par tranches ne rendent pas les mêmes lignes :
    // la base est libre de changer l'ordre entre deux requêtes. Mesuré le
    // 20 septembre 2026 : 44 973 cas au premier passage, 16 945 au second.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(de, de + 999);
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const lire = (s: any) => { const m = String(s ?? '').match(/(\d+)\s*-\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const paris: Record<string, [number, number, number]> = {};
const tranches: Record<string, Record<string, [number, number, number]>> = {};
const parTranche = (nom: string, p: number, arrive: boolean) => {
  if (!(p > 0) || p > 100) return;
  const k = String(Math.min(9, Math.floor(p / 10)) * 10).padStart(2, '0');
  tranches[nom] ??= {};
  tranches[nom][k] ??= [0, 0, 0];
  tranches[nom][k][0]++;
  tranches[nom][k][1] += p;
  tranches[nom][k][2] += arrive ? 1 : 0;
};
const CINQ_GRANDS_NOMS = new Set(['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']);
const ajoute = (nom: string, p: number, arrive: boolean) => {
  if (!(p > 0) || p > 100) return;
  paris[nom] ??= [0, 0, 0];
  paris[nom][0]++;
  paris[nom][1] += p;
  paris[nom][2] += arrive ? 1 : 0;
};
// ── UN MATCH COMPTE POUR UN ────────────────────────────────────────────
//
// Un match très demandé est analysé cinquante fois : compter les analyses
// reviendrait à mesurer la popularité, pas la justesse. On garde la PREMIÈRE
// analyse de chaque rencontre.
const parMatch = new Map<string, any>();
for (const l of lignes) {
  const cle = String(l.fixture_id ?? `${l.competition}|${l.created_at}`);
  if (!parMatch.has(cle)) parMatch.set(cle, l);
}
console.log(`${parMatch.size} rencontres distinctes sur ${lignes.length} analyses`);
for (const l of parMatch.values()) {
  const r = lire(l.real_score);
  const d: any = l.analysis_data;
  if (!r || !d) continue;
  const total = r[0] + r[1];
  ajoute('les deux marquent', Number(d?.predictions?.btts?.yes), r[0] > 0 && r[1] > 0);
  parTranche('les deux marquent', Number(d?.predictions?.btts?.yes), r[0] > 0 && r[1] > 0);
  parTranche('plus de 2,5 buts', Number(d?.predictions?.overUnder?.over25), total > 2.5);
  parTranche(
    `plus de 2,5 · ${String(l.created_at) >= '2026-09-18' ? 'AVEC le total du marché' : 'avant le 18 sept.'}`,
    Number(d?.predictions?.overUnder?.over25),
    total > 2.5
  );
  ajoute('plus de 1,5 but', Number(d?.predictions?.overUnder?.over15), total > 1.5);
  const groupe = CINQ_GRANDS_NOMS.has(String(l.competition)) ? 'cinq grands' : 'ailleurs';
  const recent = String(l.created_at) >= '2026-09-18';
  ajoute('plus de 2,5 buts', Number(d?.predictions?.overUnder?.over25), total > 2.5);
  ajoute(`plus de 2,5 · ${groupe}`, Number(d?.predictions?.overUnder?.over25), total > 2.5);
  ajoute(`plus de 2,5 · ${recent ? 'depuis le 18 sept.' : 'avant le 18 sept.'}`, Number(d?.predictions?.overUnder?.over25), total > 2.5);
  ajoute(`buts réels moyens · ${groupe}`, 100, total > 2.5);
  ajoute('plus de 3,5 buts', Number(d?.predictions?.overUnder?.over35), total > 3.5);
  ajoute('cage inviolée (équipe 1)', Number(d?.predictions?.cleanSheet?.team1), r[1] === 0);
  ajoute('cage inviolée (équipe 2)', Number(d?.predictions?.cleanSheet?.team2), r[0] === 0);
}
console.log(`${lignes.length} analyses vérifiées depuis le ${depuis}`);
for (const [nom, t] of Object.entries(tranches)) {
  console.log(`
${nom} — par tranche annoncée`);
  for (const k of Object.keys(t).sort()) {
    const b = t[k];
    if (b[0] < 30) continue;
    const annonce = b[1] / b[0];
    const reel = (100 * b[2]) / b[0];
    console.log(`  ${k}-${Number(k) + 10} % : ${String(b[0]).padStart(4)} matchs · annoncé ${annonce.toFixed(1)} · arrivé ${reel.toFixed(1)} · écart ${reel - annonce > 0 ? '+' : ''}${(reel - annonce).toFixed(1)}`);
  }
}
console.log('');
for (const [nom, v] of Object.entries(paris)) {
  const annonce = v[1] / v[0];
  const reel = (100 * v[2]) / v[0];
  const ecart = reel - annonce;
  console.log(
    `${nom.padEnd(26)} ${String(v[0]).padStart(5)} cas · annoncé ${annonce.toFixed(1)} % · arrivé ${reel.toFixed(1)} % · écart ${ecart > 0 ? '+' : ''}${ecart.toFixed(1)}`
  );
}
