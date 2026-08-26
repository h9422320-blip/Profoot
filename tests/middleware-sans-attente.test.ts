/**
 * ★ ACQUIS — LE MIDDLEWARE NE FAIT PLUS ATTENDRE LE VISITEUR.
 *
 * ── LE 26 AOÛT 2026 ───────────────────────────────────────────────────────
 *
 * Toutes les pages du site sont prérendues et servies par le CDN — le build le
 * confirme, tout est marqué statique. Le middleware est donc la SEULE chose qui
 * s'exécute à chaque requête, et le seul endroit où le site peut encore être
 * lent.
 *
 * Mesuré en comparant une adresse qui le traverse à une image qui l'évite,
 * cinq tours d'affilée :
 *
 *     /            1,565s  0,523s  0,363s  0,465s  1,013s
 *     /pricing     0,585s  0,309s  0,349s  0,276s  2,517s
 *     /logo.png    0,619s  0,461s  0,406s  0,306s  0,400s   ← sans middleware
 *
 * L'image reste plate ; les pages font des pointes à deux secondes et demie.
 * L'écart tenait à une lecture en base — l'état de maintenance — que le
 * middleware ATTENDAIT. Le cache mémoire de trente secondes meurt avec
 * l'instance, et chaque instance neuve rouvrait une connexion pendant que le
 * visiteur regardait une page blanche.
 *
 * ── CE QUE CES TESTS PROTÈGENT ────────────────────────────────────────────
 *
 *   1. une valeur périmée est servie SANS attendre la relecture ;
 *   2. la relecture ne part qu'une fois, même sous dix requêtes simultanées ;
 *   3. un échec laisse le site OUVERT — jamais l'inverse ;
 *   4. le middleware ne réclame pas l'identité sur les pages publiques.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/app-settings.ts'), 'utf8');
const middleware = fs.readFileSync(
  path.join(process.cwd(), 'src/utils/supabase/middleware.ts'),
  'utf8'
);

/** Un client Supabase de comédie, dont on choisit la lenteur et la réponse. */
function client(ms: number, ligne: any, compteur: { appels: number }) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          compteur.appels++;
          return new Promise((r) => setTimeout(() => r({ data: ligne }), ms));
        },
      };
    },
  };
}

test("★ ACQUIS — une valeur périmée est servie sans attendre la relecture", async () => {
  const { maintenanceActive, invaliderCacheReglages } = await import('../src/lib/app-settings');
  const compteur = { appels: 0 };

  // Premier passage : l'instance ne sait rien, elle attend une fois.
  invaliderCacheReglages();
  const c = client(30, { maintenance: false }, compteur);
  await maintenanceActive(c as any);
  assert.equal(compteur.appels, 1, 'La première lecture n’a pas eu lieu.');

  // La valeur est maintenant en mémoire. Même périmée, elle doit ressortir
  // immédiatement : c'est tout l'objet du correctif.
  const lent = client(3000, { maintenance: false }, compteur);
  const debut = Date.now();
  const r = await maintenanceActive(lent as any);
  const ecoule = Date.now() - debut;

  assert.equal(r.active, false);
  assert.ok(
    ecoule < 100,
    `Le middleware a attendu ${ecoule} ms. C'est exactement le défaut mesuré le ` +
      `26 août 2026 : des pointes à deux secondes et demie sur chaque page, ` +
      `alors qu'une image servie sans middleware restait sous les 0,6 s.`
  );
});

test('★ ACQUIS — dix requêtes simultanées ne déclenchent qu’une lecture', async () => {
  const { maintenanceActive, invaliderCacheReglages } = await import('../src/lib/app-settings');
  const compteur = { appels: 0 };
  invaliderCacheReglages();

  const c = client(40, { maintenance: false }, compteur);
  await Promise.all(Array.from({ length: 10 }, () => maintenanceActive(c as any)));

  assert.equal(
    compteur.appels,
    1,
    `${compteur.appels} lectures pour dix requêtes : une instance froide ouvrirait ` +
      `autant de connexions qu'elle reçoit de visiteurs, ce qui est précisément ` +
      `ce qui a saturé la base le 25 août 2026.`
  );
});

test('★ ACQUIS — une lecture qui échoue laisse le site OUVERT', async () => {
  const { maintenanceActive, invaliderCacheReglages } = await import('../src/lib/app-settings');
  invaliderCacheReglages();

  const casse = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return Promise.reject(new Error('base morte')); },
      };
    },
  };

  const r = await maintenanceActive(casse as any);
  assert.equal(
    r.active,
    false,
    'Une base injoignable ferait basculer le site en maintenance : ' +
      'mieux vaut un site accessible pendant une maintenance oubliée.'
  );
});

test('★ ACQUIS — le service avant relecture est bien celui du code', () => {
  // Le comportement ci-dessus tient à trois lignes qu'un refactor peut défaire
  // sans qu'aucun test de valeur ne bronche : la valeur connue est CAPTURÉE,
  // la relecture est lancée sans `await`, et la réponse part aussitôt.
  assert.match(source, /const connu = cache\.valeur;/, 'La valeur connue n’est plus capturée.');
  assert.match(source, /void relancer\(\);/, 'La relecture est de nouveau attendue.');
  assert.match(
    source,
    /let rafraichissement: Promise<AppSettings> \| null/,
    'Le verrou qui empêche les lectures simultanées a disparu.'
  );
});

test("★ ACQUIS — le middleware ne réclame pas l'identité sur les pages publiques", () => {
  // Le 25 août 2026, `getUser()` partait à CHAQUE requête : 23 127 appels
  // d'authentification par heure, sur un serveur de base déjà saturé.
  const sansCommentaires = middleware
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith('//') || l.trim().startsWith('*') ? '' : l))
    .join('\n');

  const appels = (sansCommentaires.match(/auth\.getUser\(\)/g) ?? []).length;
  assert.equal(appels, 1, `getUser() est appelé ${appels} fois — il doit l'être une seule.`);
  assert.match(
    sansCommentaires,
    /besoinDIdentite \? \(await supabase\.auth\.getUser\(\)\)/,
    "L'identité n'est plus conditionnée : elle repart sur chaque page publique."
  );
});
