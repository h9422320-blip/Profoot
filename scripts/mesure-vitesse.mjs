/** Ce que le serveur met réellement à répondre, et ce qu'il envoie. */
const PAGES = ['/', '/login', '/signup', '/analyze'];
const BASE = 'https://profootai.com';

const mesurer = async (chemin) => {
  const t0 = Date.now();
  let premierOctet = null;
  const r = await fetch(BASE + chemin, { cache: 'no-store', redirect: 'manual' });
  premierOctet = Date.now() - t0;
  const html = r.status >= 300 && r.status < 400 ? '' : await r.text();
  const total = Date.now() - t0;
  return { statut: r.status, premierOctet, total, taille: html.length, html };
};

console.log(`\n  ══ TEMPS DE RÉPONSE RÉELS (production) ══\n`);
console.log(`  page          statut   1er octet   complet   HTML`);
console.log(`  ${'-'.repeat(62)}`);
const pages = {};
for (const p of PAGES) {
  // Deux passages : le premier peut réveiller la fonction (démarrage à froid).
  await mesurer(p);
  const m = await mesurer(p);
  pages[p] = m;
  console.log(
    `  ${p.padEnd(12)}  ${String(m.statut).padStart(4)}   ${String(m.premierOctet + ' ms').padStart(9)}  ${String(m.total + ' ms').padStart(8)}   ${Math.round(m.taille / 1024)} Ko`
  );
}

// ── Ce que la page demande ensuite : scripts, styles, polices ─────────────
const html = pages['/login']?.html || pages['/']?.html || '';
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
console.log(`\n  ══ CE QUE LA PAGE /login DEMANDE ENSUITE ══\n`);
console.log(`  ${scripts.length} script(s), ${styles.length} feuille(s) de style.`);

let poids = 0;
const externes = [];
for (const s of scripts) {
  const url = s.startsWith('http') ? s : BASE + s;
  if (!s.startsWith('/') && !s.includes('profootai')) externes.push(url);
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const t = (await r.arrayBuffer()).byteLength;
    poids += t;
  } catch {}
}
console.log(`  Poids total du JavaScript : ${Math.round(poids / 1024)} Ko`);
for (const s of styles) console.log(`  Style : ${s.slice(0, 100)}`);
if (externes.length) console.log(`  Scripts hors domaine : ${externes.join(', ')}`);
console.log('');
