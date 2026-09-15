/**
 * OÙ PASSENT LES SECONDES ENTRE LE CLIC ET L'APPLICATION.
 *
 * L'action de connexion (`src/app/login/actions.ts`) enchaîne plusieurs
 * allers-retours réseau AVANT de rediriger. Chacun est justifié pris seul ;
 * mis bout à bout, ils font attendre quelqu'un qui a déjà tapé son mot de
 * passe.
 *
 * Ce relevé chronomètre chaque étape séparément, sur le compte de test interne
 * uniquement, pour savoir laquelle coûte vraiment — plutôt que de supprimer au
 * hasard.
 *
 *   npx tsx scripts/_ou-passe-le-temps-de-connexion.mts
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

const EMAIL = 'ui.test@profoot-test.com';
const MOT_DE_PASSE = process.env.BANC_MOT_DE_PASSE ?? 'BancEssai!2026interne';

const { createClient } = await import('@supabase/supabase-js');
const { lireReserve, ecrireReserve } = await import('../src/lib/api-football.js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const chrono = async <T,>(nom: string, faire: () => Promise<T>): Promise<T> => {
  const t = Date.now();
  const r = await faire();
  console.log(`  ${nom.padEnd(46)} ${String(Date.now() - t).padStart(6)} ms`);
  return r;
};

const PASSAGES = 3;
console.log(`\nTrois passages, pour ne pas conclure sur un hasard de réseau.\n`);

for (let i = 1; i <= PASSAGES; i++) {
  console.log(`PASSAGE ${i}`);
  const total = Date.now();

  await chrono('1. lire le compteur de tentatives', () => lireReserve('limite:connexion:' + EMAIL));
  await chrono('2. écrire le compteur de tentatives', () =>
    ecrireReserve('limite:connexion:' + EMAIL, { coups: [] }, 15 * 60 * 1000)
  );

  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await chrono('3. signInWithPassword', () =>
    sb.auth.signInWithPassword({ email: EMAIL, password: MOT_DE_PASSE })
  );
  if (error) {
    console.log(`     ÉCHEC : ${error.message}`);
    break;
  }

  await chrono('4. effacer le compteur (2e écriture)', () =>
    ecrireReserve('limite:connexion:' + EMAIL, { coups: [] }, 15 * 60 * 1000)
  );
  await chrono('5. updateUser (relevé du pays et de l appareil)', () =>
    sb.auth.updateUser({ data: { banc_essai_mesure: new Date().toISOString() } })
  );

  console.log(`  ${'TOTAL AVANT LA REDIRECTION'.padEnd(46)} ${String(Date.now() - total).padStart(6)} ms`);
  console.log('');
  void data;
}
