/**
 * CE QUE LE TÉLÉPHONE DOIT VRAIMENT TÉLÉCHARGER.
 *
 * Le serveur répond en 200 ms : ce n'est pas lui qui rame. Ce qui rame, c'est
 * ce qui arrive ensuite — le JavaScript, les polices, les images. On liste
 * donc tout ce que la page réclame, et on pèse chaque fichier SUR LE FIL.
 *
 * `content-length` et non la longueur du texte : `fetch` décompresse tout
 * seul, et compter le décompressé donne trois fois trop.
 */
const BASE = process.argv[2] ?? 'https://profootai.com';
const PAGES = process.argv[3] ? [process.argv[3]] : ['/', '/pricing', '/preuves', '/login'];

const poids = async (url) => {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const buf = await r.arrayBuffer();
    return Number(r.headers.get('content-length')) || buf.byteLength;
  } catch {
    return 0;
  }
};

for (const chemin of PAGES) {
  const url = BASE + chemin;
  const r = await fetch(url, { cache: 'no-store' });
  const html = await r.text();

  // Tout ce que la page réclame : scripts, styles, polices, images.
  const liens = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/[^"]+|\/[^"]+\.(?:js|css|woff2?|png|jpg|svg|webp))"/g)) {
    liens.add(m[1]);
  }

  const mesures = [];
  for (const l of liens) {
    mesures.push({ url: l, octets: await poids(BASE + l) });
  }

  const parType = new Map();
  for (const m of mesures) {
    const ext = (m.url.match(/\.(\w+)(?:\?|$)/) ?? [, 'autre'])[1];
    const cle = /^(js|mjs)$/.test(ext) ? 'JavaScript' : ext === 'css' ? 'CSS' : /^woff/.test(ext) ? 'polices' : /^(png|jpg|jpeg|svg|webp|avif)$/.test(ext) ? 'images' : 'autre';
    parType.set(cle, (parType.get(cle) ?? 0) + m.octets);
  }

  const htmlKo = Math.round((Number(r.headers.get('content-length')) || html.length) / 1024);
  const total = [...parType.values()].reduce((s, n) => s + n, 0);

  console.log(`\n  ══ ${chemin} ══\n`);
  console.log(`  HTML .................. ${String(htmlKo).padStart(5)} Ko`);
  for (const [t, o] of [...parType].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(21)} ${String(Math.round(o / 1024)).padStart(5)} Ko`);
  }
  console.log(`  ${'─'.repeat(30)}`);
  console.log(`  TOTAL ................. ${String(htmlKo + Math.round(total / 1024)).padStart(5)} Ko   (${liens.size} fichiers)`);

  const lourds = mesures.sort((a, b) => b.octets - a.octets).slice(0, 6).filter((m) => m.octets > 20000);
  if (lourds.length) {
    console.log('\n  Les plus lourds :');
    for (const m of lourds) {
      console.log(`    ${String(Math.round(m.octets / 1024)).padStart(5)} Ko   ${m.url.slice(0, 62)}`);
    }
  }
}
console.log('');
