const r = await fetch('https://checkout.orqex.com/cs_ua1g9zt39vju?country=BF');
const h = await r.text();
const codes = [...new Set([...h.matchAll(/"code":"([A-Z]{2})"/g)].map((m) => m[1]))];
console.log('codes trouvés :', codes.length);
const i = h.indexOf('Burkina Faso');
console.log('\n--- contexte autour du nom du pays ---\n');
console.log(h.slice(Math.max(0, i - 600), i + 250));
