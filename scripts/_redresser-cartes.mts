/**
 * REMET À L'ENDROIT LES CARTES DU MUR DONT LE RECEVEUR EST INVERSÉ.
 *
 * Le correctif de `preuves.ts` (27 septembre 2026) oriente les cartes NEUVES
 * d'après la fiche du match. Les cartes déjà écrites, elles, ne sont pas
 * relues — le quota du fournisseur interdit de redemander chaque fiche à
 * chaque reconstruction. Ce script les reprend une fois.
 *
 *   npx tsx scripts/_redresser-cartes.mts            (montre, n'écrit rien)
 *   npx tsx scripts/_redresser-cartes.mts --ecrire
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { lirePaquetFrais, identifiantEquipe } = await import('../src/lib/precision-reelle.js');
const { inverserScore } = await import('../src/lib/preuves.js');
const sb = createAdminClient();
const ecrire = process.argv.includes('--ecrire');

// Supabase rend mille lignes au maximum, en silence : sans pagination, un
// tiers du mur ne serait jamais relu.
const data: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data: page, error } = await sb
    .from('preuves')
    .select('id, fixture_id, team1_name, team1_logo, team2_name, team2_logo, prono_score, score_reel, prono_issue, issue_reelle')
    .not('fixture_id', 'is', null)
    .order('id', { ascending: true })
    .range(de, de + 999);
  if (error) throw new Error(error.message);
  data.push(...(page ?? []));
  if (!page || page.length < 1000) break;
}
console.log(`${data.length} cartes lues.`);

// Drapeaux des sélections compris : sans cela, « Angleterre — Norvège »
// restait à l'envers.
const idDe = (logo: string | null) => identifiantEquipe(logo);
const ids = [...new Set(data.map((p) => String(p.fixture_id)))];
const fiches = new Map<string, any>();
for (let i = 0; i < ids.length; i += 20) {
  const r: any = await lirePaquetFrais(ids.slice(i, i + 20));
  for (const f of r?.response ?? []) fiches.set(String(f.fixture.id), f);
  if (i % 200 === 0) console.log(`  … ${i}/${ids.length} fiches`);
}

const retourne = (i: string | null) => (i === 'team1' ? 'team2' : i === 'team2' ? 'team1' : i);
let corrigees = 0;
for (const p of data ?? []) {
  const f = fiches.get(String(p.fixture_id));
  if (!f) continue;
  const id1 = idDe(p.team1_logo), id2 = idDe(p.team2_logo);
  const dom = String(f.teams?.home?.id ?? '');
  if (!id1 || !id2 || !dom) continue;
  // Les deux équipes doivent être celles de la rencontre.
  if ([id1, id2].sort().join('-') !== [dom, String(f.teams?.away?.id ?? '')].sort().join('-')) continue;
  if (id1 === dom) continue; // déjà à l'endroit

  corrigees++;
  console.log(`${p.team1_name} — ${p.team2_name}  →  ${f.teams.home.name} — ${f.teams.away.name}   (prono ${p.prono_score} → ${inverserScore(p.prono_score)}, réel ${p.score_reel} → ${inverserScore(p.score_reel)})`);
  if (ecrire) {
    const { error } = await sb.from('preuves').update({
      team1_name: p.team2_name, team1_logo: p.team2_logo,
      team2_name: p.team1_name, team2_logo: p.team1_logo,
      prono_score: inverserScore(p.prono_score),
      score_reel: inverserScore(p.score_reel),
      prono_issue: retourne(p.prono_issue),
      issue_reelle: retourne(p.issue_reelle),
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);
    if (error) console.error('  ✖ écriture impossible :', error.message);
  }
}
console.log(`\n${corrigees} carte(s) à remettre à l'endroit sur ${data.length}${ecrire ? ' — écrites' : ' — RIEN ÉCRIT (ajouter --ecrire)'}`);
