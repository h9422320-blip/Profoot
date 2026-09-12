/**
 * OÙ EN EST LE MOTEUR, EN PRODUCTION. Lecture seule.
 *
 * Ce que les abonnés ont réellement vu : chaque pronostic confronté à son
 * résultat, dans `jugements_moteur`. Par période et selon la confiance.
 *
 * Le 2026-09-06 à 02 h 20 (commit f2dd1be), le moteur aux OCCASIONS est passé
 * en ligne : c'est la coupure qui compte pour savoir si le travail a payé.
 */
import { chargerEnv } from './challenger/commun.mjs';

chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const jugements: any[] = [];
for (let de = 0; de < 120_000; de += 1000) {
  const { data, error } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  if (error) throw new Error(error.message);
  jugements.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const mesure = (l: any[]) => {
  const n = l.length;
  const justes = l.filter((x) => x.issue_juste).length;
  const brier = n ? l.reduce((s, x) => s + Number(x.brier ?? 0), 0) / n : 0;
  return { n, justes, brier };
};
const dire = (titre: string, l: any[]) => {
  const t = mesure(l);
  // La confiance AFFICHÉE est le plus fort des trois pourcentages ; la
  // colonne `confiance` de la table mesure autre chose (elle dépasse 74 sur
  // 97 % des lignes).
  const tendance = (x: any) => {
    const p = [Number(x.proba_domicile), Number(x.proba_nul), Number(x.proba_exterieur)];
    const m = Math.max(...p);
    return m <= 1 ? 100 * m : m;
  };
  const surs = l.filter((x) => tendance(x) >= 60);
  const ts = mesure(surs);
  const fortes = l.filter((x) => tendance(x) >= 74);
  const tf = mesure(fortes);
  const domFortes = fortes.filter((x) => x.issue_prevue === 'domicile');
  const td = mesure(domFortes);
  console.log(
    `${titre.padEnd(34)} ${String(t.n).padStart(5)} jugés  vainqueur ${pc(t.justes, t.n).padStart(7)}  ` +
      `sûr ≥60 % ${pc(ts.justes, ts.n).padStart(7)} (${String(ts.n).padStart(4)})  ` +
      `≥74 % ${pc(tf.justes, tf.n).padStart(7)} (${String(tf.n).padStart(3)})  ` +
      `≥74 % à domicile ${pc(td.justes, td.n).padStart(7)} (${String(td.n).padStart(3)})`
  );
};

const jour = (x: any) => String(x.date_match).slice(0, 10);
const BASCULE = '2026-09-06';
console.log(`jugements en base : ${jugements.length}, du ${jour(jugements.reduce((a, b) => (jour(a) < jour(b) ? a : b)))} au ${jour(jugements.reduce((a, b) => (jour(a) > jour(b) ? a : b)))}\n`);
dire('ENSEMBLE', jugements);
dire('AVANT le moteur aux tirs', jugements.filter((x) => jour(x) < BASCULE));
dire('DEPUIS le moteur aux tirs', jugements.filter((x) => jour(x) >= BASCULE));
console.log('');
const issues = new Set(jugements.map((x) => x.issue_prevue));
console.log(`issues annoncées présentes : ${[...issues].join(' | ')}`);
