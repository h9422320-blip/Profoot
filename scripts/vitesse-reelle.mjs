/**
 * LA VITESSE DU SITE EN PRODUCTION, MESURÉE.
 *
 * Diagnostic seul. Aucune supposition : on demande les pages au vrai serveur
 * et on chronomètre ce qu'un visiteur attend.
 *
 * ── CE QUI EST MESURÉ ─────────────────────────────────────────────────────
 *
 *   — le PREMIER OCTET : le temps que le serveur met à commencer à répondre.
 *     C'est lui qui fait dire « ça rame » avant même qu'on voie quelque chose ;
 *   — le POIDS TRANSMIS : ce que le téléphone doit vraiment télécharger.
 *
 * ── UNE ERREUR À NE PAS REFAIRE ───────────────────────────────────────────
 *
 * `fetch` décompresse tout seul. Compter la longueur du texte reçu donne le
 * poids DÉCOMPRESSÉ — trois fois trop. Le 23 août 2026, cela a fait conclure
 * à 620 Ko de JavaScript là où 199 Ko passaient réellement sur le réseau.
 * On lit donc l'en-tête `content-length`, qui est le poids sur le fil.
 */
const BASE = process.argv[2] ?? 'https://profootai.com';

const PAGES = [
  ['/', 'accueil'],
  ['/analyze', 'analyse (la plus visitée)'],
  ['/pricing', 'tarifs'],
  ['/login', 'connexion'],
  ['/signup', 'inscription'],
  ['/competitions', 'compétitions'],
  ['/preuves', 'mur de preuves'],
  ['/matches', 'matchs'],
];

const chrono = async (url) => {
  const debut = Date.now();
  let premierOctet = null;
  const r = await fetch(url, { redirect: 'manual', cache: 'no-store' });
  premierOctet = Date.now() - debut;
  const corps = await r.arrayBuffer();
  const total = Date.now() - debut;
  return {
    statut: r.status,
    premierOctet,
    total,
    // Le poids sur le fil, pas le poids décompressé.
    octets: Number(r.headers.get('content-length')) || corps.byteLength,
    cache: r.headers.get('x-vercel-cache') ?? '—',
    region: r.headers.get('x-vercel-id')?.split(':')[0] ?? '—',
  };
};

console.log(`\n  ${BASE}\n`);
console.log('  page                        statut  1er octet   total    poids    cache');
console.log('  ' + '─'.repeat(74));

const lents = [];
for (const [chemin, nom] of PAGES) {
  try {
    // Deux passages : le premier peut payer un démarrage à froid.
    await chrono(BASE + chemin).catch(() => null);
    const m = await chrono(BASE + chemin);
    const ko = Math.round(m.octets / 1024);
    console.log(
      `  ${nom.padEnd(28)} ${String(m.statut).padStart(4)} ${String(m.premierOctet + ' ms').padStart(10)}` +
      ` ${String(m.total + ' ms').padStart(8)} ${String(ko + ' Ko').padStart(9)}   ${m.cache}`
    );
    if (m.premierOctet > 1000) lents.push([nom, m.premierOctet]);
  } catch (e) {
    console.log(`  ${nom.padEnd(28)} erreur : ${e.message}`);
  }
}

if (lents.length) {
  console.log('\n  ── PAGES AU-DESSUS D UNE SECONDE ──\n');
  for (const [nom, ms] of lents.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(ms + ' ms').padStart(8)}   ${nom}`);
  }
}
console.log('');
