/** Poids RÉEL d'une page : HTML + scripts + styles + polices. */
const BASE = 'https://profootai.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' };

async function peser(chemin) {
  const t0 = Date.now();
  const r = await fetch(BASE + chemin, { cache: 'no-store', headers: UA });
  const ttfb = Date.now() - t0;
  const html = await r.text();

  const urls = [
    ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+rel="preload"[^>]+href="([^"]+\.woff2)"/g)].map((m) => m[1]),
  ];

  let js = 0, css = 0, polices = 0, externe = 0;
  for (const u of [...new Set(urls)]) {
    const url = u.startsWith('http') ? u : BASE + u;
    try {
      const o = (await fetch(url, { cache: 'no-store', headers: UA })).arrayBuffer
        ? (await (await fetch(url, { cache: 'no-store', headers: UA })).arrayBuffer()).byteLength : 0;
      if (!u.startsWith('/')) externe += o;
      if (/\.woff2?$/.test(u)) polices += o;
      else if (/\.css/.test(u)) css += o;
      else js += o;
    } catch {}
  }
  const total = html.length + js + css + polices;
  return { ttfb, html: html.length, js, css, polices, externe, total };
}

const ko = (o) => Math.round(o / 1024);
console.log(`\n  ══ POIDS RÉEL PAR PAGE ══\n`);
console.log(`  page       TTFB     HTML     JS     CSS  polices   TOTAL   3G lente`);
console.log(`  ${'-'.repeat(72)}`);
for (const p of ['/login', '/signup', '/']) {
  await peser(p);
  const m = await peser(p);
  console.log(
    `  ${p.padEnd(9)} ${String(m.ttfb + 'ms').padStart(6)}  ${String(ko(m.html) + 'Ko').padStart(6)} ` +
    `${String(ko(m.js) + 'Ko').padStart(6)} ${String(ko(m.css) + 'Ko').padStart(6)} ` +
    `${String(ko(m.polices) + 'Ko').padStart(7)}  ${String(ko(m.total) + 'Ko').padStart(6)}   ${(ko(m.total) * 8 / 400).toFixed(1)}s`
  );
}
console.log('');
