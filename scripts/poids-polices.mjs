const CSS = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap';
const ua = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' };
const css = await (await fetch(CSS, { headers: ua })).text();
console.log(`\n  Feuille de style des polices : ${Math.round(css.length / 1024)} Ko`);
const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
console.log(`  ${urls.length} fichier(s) de police référencé(s).`);
let total = 0;
const parFamille = new Map();
for (const u of urls) {
  try {
    const t = (await (await fetch(u)).arrayBuffer()).byteLength;
    total += t;
    const fam = u.includes('inter') ? 'Inter' : u.includes('spacegrotesk') ? 'Space Grotesk' : u.includes('outfit') ? 'Outfit' : 'autre';
    parFamille.set(fam, (parFamille.get(fam) ?? 0) + t);
  } catch {}
}
for (const [f, o] of [...parFamille].sort((a, b) => b[1] - a[1]))
  console.log(`     ${f.padEnd(16)} ${Math.round(o / 1024)} Ko`);
console.log(`  ─────────────────────────────`);
console.log(`     TOTAL POLICES  ${Math.round(total / 1024)} Ko`);
console.log(`\n  Sur 3G lente (400 kbps) : ${((total / 1024) * 8 / 400).toFixed(1)} s rien que pour les polices,`);
console.log(`  et depuis un DEUXIÈME domaine (DNS + TLS à refaire).\n`);
