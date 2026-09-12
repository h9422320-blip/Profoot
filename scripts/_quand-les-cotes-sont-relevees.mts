/**
 * QUAND CHAQUE JOURNÉE DE COTES A-T-ELLE ÉTÉ RELEVÉE ?
 *
 * Une cote relevée APRÈS les matchs est une cote de clôture : elle contient
 * déjà ce que le marché a appris des compositions, des blessures de dernière
 * minute et des paris engagés. L'utiliser dans une mesure ferait passer la
 * couche du marché pour meilleure qu'elle n'est.
 *
 * Ce script liste chaque journée `cotes:AAAA-MM-JJ` avec sa date d'écriture,
 * et écrit la liste des journées UTILISABLES dans le fichier donné en
 * argument.
 *
 *   npx tsx scripts/_quand-les-cotes-sont-relevees.mts <sortie.json>
 */
import fs from 'node:fs';
import { chargerEnv } from './challenger/commun.mjs';

chargerEnv();
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data, error } = await sb.from('cache_api').select('cle, ecrit_le').ilike('cle', 'cotes:%').limit(500);
if (error) throw new Error(error.message);

const lignes = (data ?? [])
  .map((d: any) => {
    const jour = String(d.cle).slice('cotes:'.length);
    const ecrit = String(d.ecrit_le).slice(0, 10);
    return { jour, ecrit, retard: Math.round((Date.parse(ecrit) - Date.parse(jour)) / 86_400_000) };
  })
  .sort((a, b) => a.jour.localeCompare(b.jour));

console.log(`journées de cotes en réserve : ${lignes.length}`);
for (const l of lignes)
  console.log(`  ${l.jour}  écrite le ${l.ecrit}  ${l.retard > 0 ? `APRÈS les matchs (+${l.retard} j) — à écarter` : 'le jour même ou avant — utilisable'}`);

const propres = lignes.filter((l) => l.retard <= 0).map((l) => l.jour);
console.log(`journées utilisables : ${propres.length} sur ${lignes.length}`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(propres));
