/**
 * Ce qui passe RÉELLEMENT sur le réseau, octet par octet.
 *
 * `fetch` décompresse tout seul : mesurer sa sortie revient à compter le poids
 * décompressé, soit trois à quatre fois la réalité sur du texte. On compte donc
 * les octets bruts reçus sur la socket.
 */
import https from 'https';

const HOTE = 'profootai.com';
const UA = 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

const brut = (chemin) =>
  new Promise((resolve) => {
    const t0 = Date.now();
    let octets = 0, ttfb = null;
    const req = https.get(
      { host: HOTE, path: chemin, headers: { 'User-Agent': UA, 'Accept-Encoding': 'br, gzip, deflate' } },
      (res) => {
        res.on('data', (c) => { if (ttfb === null) ttfb = Date.now() - t0; octets += c.length; });
        res.on('end', () => resolve({ octets, ttfb: ttfb ?? Date.now() - t0, encodage: res.headers['content-encoding'] ?? 'aucun', statut: res.statusCode }));
      }
    );
    req.on('error', () => resolve({ octets: 0, ttfb: 0, encodage: 'erreur', statut: 0 }));
  });

const texte = (chemin) =>
  new Promise((resolve) => {
    https.get({ host: HOTE, path: chemin, headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity' } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });

const ko = (o) => Math.round(o / 1024);

console.log(`\n  ══ CE QUI PASSE VRAIMENT SUR LE RÉSEAU ══\n`);
console.log(`  page       TTFB    HTML     JS    CSS  polices    TOTAL   3G lente   4G`);
console.log(`  ${'-'.repeat(78)}`);

for (const chemin of ['/login', '/signup', '/']) {
  const html = await texte(chemin);
  const page = await brut(chemin);
  const liens = [...new Set([
    ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+href="([^"]+\.woff2)"/g)].map((m) => m[1]),
  ])].filter((u) => u.startsWith('/'));

  let js = 0, css = 0, pol = 0;
  for (const u of liens) {
    const r = await brut(u);
    if (/\.woff2?$/.test(u)) pol += r.octets;
    else if (/\.css/.test(u)) css += r.octets;
    else js += r.octets;
  }
  const total = page.octets + js + css + pol;
  console.log(
    `  ${chemin.padEnd(9)} ${String(page.ttfb + 'ms').padStart(6)} ${String(ko(page.octets) + 'Ko').padStart(6)} ` +
    `${String(ko(js) + 'Ko').padStart(6)} ${String(ko(css) + 'Ko').padStart(6)} ${String(ko(pol) + 'Ko').padStart(7)} ` +
    `${String(ko(total) + 'Ko').padStart(8)}   ${((ko(total) * 8) / 400).toFixed(1)}s  ${((ko(total) * 8) / 1500).toFixed(1)}s`
  );
}
console.log(`\n  (compression ${(await brut('/login')).encodage} — 3G lente = 400 kbit/s, 4G modeste = 1500 kbit/s)\n`);
