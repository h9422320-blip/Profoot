import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { paysRetenu } from '../src/lib/pays-paiement';
import { moyensDuPays, PAYS_SERVIS, MOYEN_GENERIQUE } from '../src/lib/moyens-paiement';

const lire = (p: string) => fs.readFileSync(p, 'utf8');
const entetes = (o: Record<string, string>) => new Headers(o);

/**
 * LA NOTICE DE PAIEMENT NE DOIT RIEN PROMETTRE QU'ELLE NE TIENNE.
 *
 * Elle annonce à l'acheteur ce qu'il va trouver sur la page Chariow. Se
 * tromper d'un opérateur, c'est promettre Wave à quelqu'un qui ne le verra
 * pas — et perdre exactement la confiance qu'on cherchait à gagner.
 */
test('CONTRAT — un code pays inconnu ne part jamais chez Chariow', () => {
  // Chariow retombe SILENCIEUSEMENT sur la Guinée pour tout code qu'il ne
  // reconnaît pas : `country=ZZ` renvoie Orange Money Guinée. Un code non
  // filtré ferait donc voir des moyens guinéens à n'importe qui.
  for (const fantaisie of ['ZZ', 'XX', '../../etc', '1', 'FRANCE', '']) {
    const r = paysRetenu(entetes({ 'cf-ipcountry': 'CI' }), undefined, fantaisie);
    assert.equal(
      r.code,
      'CI',
      `Le code « ${fantaisie} » a été transmis tel quel. Chariow l'aurait remplacé ` +
        `par la Guinée sans rien dire, et l'acheteur aurait vu les mauvais moyens.`
    );
  }
});

test('CONTRAT — un pays choisi à la main passe devant la détection', () => {
  // Sans cela, la correction affichée à l'acheteur ne servirait à rien : il
  // choisirait son pays et verrait quand même la page de l'autre.
  const r = paysRetenu(entetes({ 'cf-ipcountry': 'GB' }), undefined, 'CI');
  assert.equal(r.code, 'CI');
  assert.equal(r.source, 'choix');
});

test('CONTRAT — sans choix, la détection d avant est intacte', () => {
  const r = paysRetenu(entetes({ 'cf-ipcountry': 'GN' }));
  assert.equal(r.code, 'GN');
  assert.equal(r.source, 'ip');
});

test('CONTRAT — aucun pays servi n a une liste de moyens vide', () => {
  assert.ok(PAYS_SERVIS.length >= 240, `Seulement ${PAYS_SERVIS.length} pays servis.`);
  const vides = PAYS_SERVIS.filter((p) => !p.moyens.length);
  assert.equal(
    vides.length,
    0,
    `${vides.length} pays sans moyen de paiement : la notice n'aurait rien à montrer.`
  );
});

test('CONTRAT — les moyens annoncés sont ceux relevés chez Chariow', () => {
  // Trois pays vérifiés à la main sur les vraies pages de paiement.
  assert.deepEqual(
    moyensDuPays('CI')?.moyens.map((m) => m.cle),
    ['wave', 'orange_money', 'djamo', 'mtn', 'moov', 'card']
  );
  assert.deepEqual(
    moyensDuPays('GN')?.moyens.map((m) => m.cle),
    ['orange_money', 'mtn', 'card']
  );
  // L'Autriche n'a que la carte : ne rien inventer là où il n'y a rien.
  assert.deepEqual(moyensDuPays('AT')?.moyens.map((m) => m.cle), ['card']);
});

test('CONTRAT — les territoires que Chariow ne reconnaît pas sont exclus', () => {
  // BQ, BV, EH et HM héritaient des moyens guinéens à cause du repli
  // silencieux. On aurait promis Orange Money au Sahara occidental.
  for (const code of ['BQ', 'BV', 'EH', 'HM', 'KP', 'VE']) {
    assert.equal(
      moyensDuPays(code),
      null,
      `${code} est revenu dans la table : c'est le repli Guinée de Chariow, pas ses vrais moyens.`
    );
  }
});

test('CONTRAT — la carte est nommée pour rassurer, jamais « Card »', () => {
  assert.match(MOYEN_GENERIQUE.nom, /Visa/);
  assert.match(MOYEN_GENERIQUE.nom, /Mastercard/);
});

test('CONTRAT — chaque moyen affiché a son icône en local', () => {
  const manquantes = new Set<string>();
  for (const p of PAYS_SERVIS)
    for (const m of p.moyens)
      if (!fs.existsSync(`public/moyens/${m.cle}.svg`)) manquantes.add(m.cle);
  assert.equal(
    manquantes.size,
    0,
    `Icônes absentes : ${[...manquantes].join(', ')}. Sur un téléphone en 3G, une ` +
      `image qui ne charge pas casse la confiance qu'on cherche à créer ici.`
  );
});

/**
 * ── LA NOTICE NE DOIT PAS RETENIR L'ACHETEUR ─────────────────────────────
 *
 * Un obstacle de plus sur le chemin du paiement serait le contraire du but.
 */
test('CONTRAT — la notice repart toute seule au bout de cinq secondes', () => {
  const src = lire('src/components/NoticePaiement.tsx');
  assert.match(src, /const SECONDES = 5/);
  assert.match(
    src,
    /if \(reste <= 0\) \{\s*\n\s*partir\(\);/,
    'La redirection automatique a disparu : quelqu\'un qui ne clique pas resterait bloqué.'
  );
});

test('CONTRAT — la notice n est chargée qu au clic sur une offre', () => {
  // Elle embarque la table des 243 pays. Un import classique l'aurait mise
  // dans le téléphone de chaque visiteur, y compris ceux qui n'achètent pas.
  for (const page of [
    'src/app/(dashboard)/pricing/PricingClient.tsx',
    'src/app/(dashboard)/expert/page.tsx',
  ]) {
    const src = lire(page);
    assert.match(
      src,
      /dynamic\(\(\) => import\("@\/components\/NoticePaiement"\), \{ ssr: false \}\)/,
      `${page} charge la notice d'emblée : quarante-huit kilo-octets envoyés à tout le monde.`
    );
  }
});
