import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { lirePaquetFrais, identifiantEquipe } = await import('../src/lib/precision-reelle.js');
const sb = createAdminClient();

const { data } = await sb
  .from('preuves')
  .select('fixture_id, team1_name, team2_name, team1_logo, team2_logo, competition, date_match, prono_score, score_reel, issue_correcte, score_exact, publiee')
  .eq('publiee', true)
  .order('date_match', { ascending: false })
  .limit(1000);

const ids = (data ?? []).map((p) => String(p.fixture_id)).filter((v) => v && v !== 'null');
const fiches = new Map<string, any>();
for (let i = 0; i < ids.length; i += 20) {
  const r: any = await lirePaquetFrais(ids.slice(i, i + 20));
  for (const f of r?.response ?? []) fiches.set(String(f.fixture.id), f);
}

const lire = (s: string | null) => { const m = String(s ?? '').match(/(\d+)\s*-\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const issue = (a: number, b: number) => (a > b ? 'A' : a < b ? 'B' : 'N');
const sansAccent = (s: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

let ok = 0; const soucis: string[] = [];
for (const p of data ?? []) {
  const f = fiches.get(String(p.fixture_id));
  if (!f) { soucis.push(`f${p.fixture_id} ${p.team1_name} — ${p.team2_name} : fiche introuvable chez le fournisseur`); continue; }
  const reel = lire(p.score_reel), prono = lire(p.prono_score);
  const vrai = [f.goals.home ?? 0, f.goals.away ?? 0];
  // Le sens se contrôle par IDENTIFIANT, jamais par nom : « Angleterre » et
  // « England » désignent la même sélection, et une comparaison de noms
  // inventerait des anomalies là où il n'y en a pas.
  const id1 = identifiantEquipe(p.team1_logo), id2 = identifiantEquipe(p.team2_logo);
  const dom = String(f.teams.home.id), ext = String(f.teams.away.id);
  if (!id1 || !id2) { soucis.push(`f${p.fixture_id} ${p.team1_name} — ${p.team2_name} : équipes non identifiables (logo ${p.team1_logo})`); continue; }
  if ([id1, id2].sort().join('-') !== [dom, ext].sort().join('-')) { soucis.push(`f${p.fixture_id} ${p.team1_name} — ${p.team2_name} : ce ne sont pas les équipes de la rencontre (${f.teams.home.name} — ${f.teams.away.name})`); continue; }
  const inverse = id1 !== dom;
  const attendu = inverse ? [vrai[1], vrai[0]] : vrai;
  if (inverse) { soucis.push(`f${p.fixture_id} SENS INVERSÉ : la carte dit « ${p.team1_name} — ${p.team2_name} », le match est ${f.teams.home.name} — ${f.teams.away.name}`); continue; }
  if (!reel || reel[0] !== attendu[0] || reel[1] !== attendu[1]) { soucis.push(`f${p.fixture_id} ${p.team1_name} — ${p.team2_name} : score affiché ${p.score_reel}, réel ${attendu.join(' - ')}`); continue; }
  if (!prono) { soucis.push(`f${p.fixture_id} ${p.team1_name} — ${p.team2_name} : pronostic illisible`); continue; }
  if (issue(prono[0], prono[1]) !== issue(reel[0], reel[1])) { soucis.push(`f${p.fixture_id} ${p.team1_name} — ${p.team2_name} : PUBLIÉE alors que le pronostic ${p.prono_score} ne donne pas ${p.score_reel}`); continue; }
  if (p.score_exact && (prono[0] !== reel[0] || prono[1] !== reel[1])) { soucis.push(`f${p.fixture_id} : « score exact » annoncé à tort`); continue; }
  ok++;
}
console.log(`\nCartes publiées contrôlées : ${(data ?? []).length} — ${ok} conformes, ${soucis.length} à revoir`);
for (const s of soucis) console.log('  ✖', s);
