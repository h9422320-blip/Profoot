const CSS = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap';
const ua = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' };
const css = await (await fetch(CSS, { headers: ua })).text();
// Un navigateur ne télécharge que les blocs dont l'unicode-range le concerne.
const blocs = css.split('@font-face').slice(1);
let total = 0, n = 0;
for (const b of blocs) {
  const sousEnsemble = /\/\* (latin|latin-ext) \*\//.test(css.slice(0, css.indexOf(b))) ;
  const url = b.match(/url\((https:[^)]+)\)/)?.[1];
  const range = b.match(/unicode-range:([^;]+);/)?.[1] ?? '';
  // Le latin de base : U+0000-00FF. C'est ce que charge un visiteur francophone.
  if (!url || !/U\+0000-00FF/.test(range)) continue;
  try { total += (await (await fetch(url)).arrayBuffer()).byteLength; n++; } catch {}
}
console.log(`\n  Ce qu'un visiteur francophone télécharge vraiment : ${n} fichier(s), ${Math.round(total / 1024)} Ko`);
console.log(`  + la feuille de style : ${Math.round(css.length / 1024)} Ko (bloquante, sur un autre domaine)`);
const t = total / 1024 + css.length / 1024;
console.log(`\n  Sur 3G lente : ${(t * 8 / 400).toFixed(1)} s pour les polices seules.\n`);
