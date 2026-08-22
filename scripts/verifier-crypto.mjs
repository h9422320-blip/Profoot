const base = 'https://checkout.orqex.com/cs_ua1g9zt39vju';
const r = await fetch(`${base}?country=CI`);
const h = await r.text();
const i = h.indexOf('Crypto');
console.log(i >= 0 ? '\n--- contexte Crypto ---\n' + h.slice(Math.max(0, i - 500), i + 120) : 'Crypto absent');
