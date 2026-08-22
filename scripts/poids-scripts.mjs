const BASE = 'https://profootai.com';
const html = await (await fetch(BASE + '/login', { cache: 'no-store' })).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const lignes = [];
for (const s of scripts) {
  const url = s.startsWith('http') ? s : BASE + s;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    lignes.push({ nom: s.split('/').pop().slice(0, 46), ko: Math.round((await r.arrayBuffer()).byteLength / 1024) });
  } catch { lignes.push({ nom: s, ko: 0 }); }
}
lignes.sort((a, b) => b.ko - a.ko);
console.log(`\n  ══ LES SCRIPTS DE /login, DU PLUS LOURD AU PLUS LÉGER ══\n`);
for (const l of lignes) console.log(`  ${String(l.ko).padStart(5)} Ko   ${l.nom}`);
console.log(`  ${'-'.repeat(60)}\n  ${String(lignes.reduce((s, l) => s + l.ko, 0)).padStart(5)} Ko   TOTAL`);
// Ce que ça donne sur une vraie connexion mobile ouest-africaine.
const total = lignes.reduce((s, l) => s + l.ko, 0);
for (const [nom, kbps] of [['3G lente', 400], ['3G', 750], ['4G modeste', 1500]])
  console.log(`\n  ${nom.padEnd(12)} ~${(total * 8 / kbps).toFixed(1)} s rien que pour le JavaScript`);
console.log('');
