/**
 * REDRESSE LES CARTES DU MUR RESTÉES À L'ENVERS.
 *
 *     node scripts/redresser-mur.mjs             → blanc, n'écrit rien
 *     node scripts/redresser-mur.mjs --appliquer → écrit
 *
 * `construirePreuves` ne relit que les 2 000 analyses vérifiées les plus
 * récentes — soit une quarantaine de rencontres. Les cartes plus anciennes ne
 * repassent donc jamais, et gardent l'ordre tapé par le premier utilisateur au
 * lieu de l'ordre du terrain.
 *
 * Cette réparation les remet d'aplomb une fois pour toutes, en s'appuyant sur
 * la prédiction figée, qui porte l'équipe qui reçoit.
 *
 * ── CE QU'ELLE NE CHANGE PAS ──────────────────────────────────────────────
 *
 * Le VERDICT. Retourner les deux côtés d'une carte laisse « juste » ce qui
 * était juste et « faux » ce qui était faux — c'est vérifié ligne par ligne
 * avant chaque écriture, et une carte dont le verdict bougerait serait
 * refusée. Une réparation qui transformerait un raté en réussite serait bien
 * pire que le défaut qu'elle corrige.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(),'src') } });
const { memeEquipe, inverserScore, lireScore, issue } = await jiti.import('./src/lib/preuves.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const APPLIQUER = process.argv.includes('--appliquer');

const { data: preuves } = await sb.from('preuves').select('*');
const { data: figees } = await sb.from('predictions_match').select('fixture_id, domicile_nom');
const dom = new Map((figees??[]).map(f=>[String(f.fixture_id), f.domicile_nom]));

let redressees=0, refusees=0, sansSens=0;

for (const p of preuves ?? []) {
  const d = dom.get(String(p.fixture_id));
  if (!d) { sansSens++; continue; }
  if (memeEquipe(p.team1_name, d)) continue;

  const pronoRetourne = inverserScore(p.prono_score);
  const reelRetourne  = inverserScore(p.score_reel);

  const bp = lireScore(pronoRetourne);
  const br = lireScore(reelRetourne);
  const nouvelleIssueProno = bp ? issue(bp[0], bp[1]) : null;
  const nouvelleIssueReelle = br ? issue(br[0], br[1]) : null;

  // ── LE GARDE-FOU ────────────────────────────────────────────────────────
  // Le verdict doit être rigoureusement identique après retournement.
  const verdictAvant = p.issue_correcte;
  const verdictApres =
    !!nouvelleIssueProno && !!nouvelleIssueReelle && nouvelleIssueProno === nouvelleIssueReelle;

  if (verdictAvant !== verdictApres) {
    refusees++;
    console.log(`  REFUSÉE — ${p.team1_name} — ${p.team2_name} : le verdict changerait (${verdictAvant} → ${verdictApres}).`);
    continue;
  }

  console.log(
    `  ${p.team1_name} — ${p.team2_name}` +
    `\n      devient  ${p.team2_name} — ${p.team1_name}   annoncé ${pronoRetourne}  ·  réel ${reelRetourne}` +
    `   [${p.issue_correcte ? 'réussi' : 'raté'}, inchangé]`
  );
  redressees++;

  if (APPLIQUER) {
    const { error } = await sb.from('preuves').update({
      team1_name: p.team2_name,
      team2_name: p.team1_name,
      team1_logo: p.team2_logo,
      team2_logo: p.team1_logo,
      prono_score: pronoRetourne,
      score_reel: reelRetourne,
      prono_issue: nouvelleIssueProno,
      issue_reelle: nouvelleIssueReelle,
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);
    if (error) console.log('      ERREUR : ' + error.message);
  }
}

console.log(`\n  ${redressees} carte(s) à redresser, ${refusees} refusée(s), ${sansSens} sans sens officiel connu (laissées telles quelles).`);
console.log(APPLIQUER ? '  ÉCRIT EN BASE.\n' : "  BLANC — rien n'a été écrit. Relancer avec --appliquer.\n");
