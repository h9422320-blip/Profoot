const BASE = 'https://profootai.com';
for (const nom of ['133qsnbwgup38.js', '0c0hxoamwjsbw.js']) {
  const txt = await (await fetch(`${BASE}/_next/static/immutable/chunks/${nom}`, { cache: 'no-store' })).text();
  console.log(`\n  ══ ${nom} — ${Math.round(txt.length / 1024)} Ko ══`);
  // Les noms de modules laissés par le compilateur.
  const modules = [...txt.matchAll(/node_modules\/([@a-z0-9._-]+(?:\/[a-z0-9._-]+)?)/gi)].map((m) => m[1]);
  const compte = new Map();
  for (const m of modules) compte.set(m, (compte.get(m) ?? 0) + 1);
  const top = [...compte].sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) for (const [m, n] of top) console.log(`     ${String(n).padStart(4)} × ${m}`);
  else {
    // Pas de chemins : on cherche des mots-clés propres aux grosses libs.
    for (const [nom2, re] of [['framer-motion', /animate|spring|keyframes|transformTemplate/], ['zod', /ZodError|invalid_type/], ['supabase', /gotrue|refreshSession|PostgrestBuilder/i], ['chart', /Recharts|CartesianGrid|scaleLinear/], ['react', /useSyncExternalStore|Fragment/]])
      if (re.test(txt)) console.log(`     contient : ${nom2}`);
  }
}
console.log('');
