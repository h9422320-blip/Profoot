/**
 * OÙ SE TROUVENT LES 80 % ? — LECTURE SEULE.
 *
 * On ne peut pas rendre TOUS les matchs prévisibles. Mais on peut ne montrer
 * que ceux qui le sont. Ce script mesure, sur les 3 467 rencontres jugées, le
 * taux de réussite atteint selon le seuil de probabilité retenu — et combien
 * de matchs il reste chaque jour à ce seuil.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tout = async (t, c) => { const o = []; for (let d = 0; d < 300000; d += 1000) { const { data, error } = await sb.from(t).select(c).range(d, d + 999); if (error) throw new Error(error.message); o.push(...(data ?? [])); if (!data || data.length < 1000) break; } return o; };
const j = (await tout('jugements_moteur', '*')).filter((x) => x.issue_reelle && x.proba_domicile != null);
const maxP = (x) => Math.max(Number(x.proba_domicile), Number(x.proba_nul), Number(x.proba_exterieur));
const favori = (x) => { const p = { domicile: +x.proba_domicile, nul: +x.proba_nul, exterieur: +x.proba_exterieur }; return Object.entries(p).sort((a,b)=>b[1]-a[1])[0][0]; };

// Combien de jours couvre l'échantillon ?
const jours = new Set(j.map((x) => String(x.date_match).slice(0, 10))).size;
console.log(`${j.length} rencontres sur ${jours} jours — ${(j.length/jours).toFixed(1)} par jour en moyenne.\n`);
console.log('   seuil     matchs retenus   par jour   RÉUSSITE');
for (const s of [50, 60, 65, 70, 75, 80, 85, 90]) {
  const l = j.filter((x) => maxP(x) >= s);
  if (l.length < 25) { console.log(`   ${String(s).padStart(3)} %      ${String(l.length).padStart(5)}          —        trop peu`); continue; }
  const b = l.filter((x) => favori(x) === x.issue_reelle).length;
  const ic = 1.96 * Math.sqrt((b/l.length)*(1-b/l.length)/l.length) * 100;
  console.log(`   ${String(s).padStart(3)} %      ${String(l.length).padStart(5)}       ${(l.length/jours).toFixed(1).padStart(5)}      ${(100*b/l.length).toFixed(1)} % ± ${ic.toFixed(1)}`);
}

console.log('\n   ET EN CROISANT AVEC LE CHAMPIONNAT (seuil 70 %) :');
const parLigue = new Map();
for (const x of j) {
  if (maxP(x) < 70) continue;
  const k = String(x.ligue ?? '');
  if (!parLigue.has(k)) parLigue.set(k, { n: 0, b: 0 });
  const o = parLigue.get(k); o.n++; if (favori(x) === x.issue_reelle) o.b++;
}
const bonnes = [...parLigue].filter(([, o]) => o.n >= 15).sort((a, b) => (b[1].b/b[1].n) - (a[1].b/a[1].n));
for (const [lig, o] of bonnes.slice(0, 10)) console.log(`      ${lig.slice(0,26).padEnd(27)} ${String(o.n).padStart(4)} matchs → ${(100*o.b/o.n).toFixed(1)} %`);
