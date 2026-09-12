/**
 * QUE REGARDENT VRAIMENT LES ABONNÉS, ET LE MOTEUR VOIT-IL CES MATCHS ?
 * Lecture seule.
 *
 * Le relevé des tirs vaut 60 % du calcul, mais il ne couvre que les
 * compétitions qu'on y a mises. Ce script croise DEUX choses :
 *
 *   - ce que les abonnés ont réellement fait analyser (`jugements_moteur`) ;
 *   - ce que le relevé couvre (`CHAMPIONNATS` de `forme-occasions.ts`).
 *
 * Il sort la liste des compétitions les plus analysées que le moteur ne voit
 * PAS, pour que la prochaine vague serve à quelqu'un.
 *
 *   npx tsx scripts/_quelles-competitions-les-abonnes-analysent.mts
 */
import { chargerEnv } from './challenger/commun.mjs';

chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');
const sb = createAdminClient();

// La table des jugements garde le NOM de la compétition, pas son numéro.
const sansAccents = (x: string) =>
  x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const couvert = new Set<string>((CHAMPIONNATS as unknown as any[]).map((c) => sansAccents(String(c.nom))));

const jugements: any[] = [];
for (let de = 0; de < 120_000; de += 1000) {
  const { data, error } = await sb.from('jugements_moteur').select('ligue, issue_juste, date_match').range(de, de + 999);
  if (error) throw new Error(error.message);
  jugements.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const parLigue = new Map<string, { n: number; justes: number; recent: number }>();
const ilYaTroisMois = Date.now() - 90 * 86_400_000;
for (const j of jugements) {
  const l = String(j.ligue ?? '').trim();
  if (!l) continue;
  const c = parLigue.get(l) ?? { n: 0, justes: 0, recent: 0 };
  c.n++;
  if (j.issue_juste) c.justes++;
  if (Date.parse(String(j.date_match)) >= ilYaTroisMois) c.recent++;
  parLigue.set(l, c);
}

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const liste = [...parLigue].sort((a, b) => b[1].n - a[1].n);
const horsReleve = liste.filter(([l]) => !couvert.has(sansAccents(l)));

console.log(`${jugements.length} pronostics jugés, ${liste.length} compétitions distinctes.`);
console.log(`${liste.length - horsReleve.length} sont au relevé des tirs, ${horsReleve.length} n'y sont pas.\n`);
console.log('── LES PLUS ANALYSÉES QUE LE MOTEUR NE VOIT PAS ─────────────────────');
console.log('  compétition                        jugés   3 derniers mois   vainqueur juste');
for (const [ligue, c] of horsReleve.slice(0, 22))
  console.log(`  ${ligue.slice(0, 34).padEnd(34)} ${String(c.n).padStart(5)}   ${String(c.recent).padStart(9)}         ${pc(c.justes, c.n).padStart(7)}`);

const totalHors = horsReleve.reduce((s, [, c]) => s + c.n, 0);
const totalRecentHors = horsReleve.reduce((s, [, c]) => s + c.recent, 0);
console.log(
  `\nEn tout : ${totalHors} pronostics hors relevé (${pc(totalHors, jugements.length)} de tout), ` +
    `dont ${totalRecentHors} sur les trois derniers mois.`
);
