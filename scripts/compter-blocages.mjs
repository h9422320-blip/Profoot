/**
 * Combien de visites sur cent sont bloquees, et de quel cote ?
 * Un blocage rare ne se prouve pas sur cinq essais : il se compte.
 */
const cibles = [['Cloudflare','https://profootai.com'],['Vercel direct','https://profoot-2lqq.vercel.app']];
const N = 40;
const resultats = new Map();
for (const [nom, base] of cibles) {
  const temps = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    try {
      const r = await fetch(base + '/login?n=' + Math.random(), { redirect: 'manual' });
      await r.arrayBuffer();
      temps.push(Date.now() - t0);
    } catch { temps.push(-1); }
    await new Promise((r) => setTimeout(r, 400));
  }
  resultats.set(nom, temps);
}
console.log('\n  ══ ' + N + ' VISITES DE CHAQUE COTE ══\n');
console.log('  cible           median   pire    >2s   >5s   echecs');
console.log('  ' + '─'.repeat(56));
for (const [nom, t] of resultats) {
  const ok = t.filter((x) => x > 0).sort((a, b) => a - b);
  const med = ok[Math.floor(ok.length / 2)] ?? 0;
  console.log(
    '  ' + nom.padEnd(15) + String(med + ' ms').padStart(7) + String(Math.max(...ok) + ' ms').padStart(8) +
    String(t.filter((x) => x > 2000).length).padStart(7) + String(t.filter((x) => x > 5000).length).padStart(6) +
    String(t.filter((x) => x < 0).length).padStart(8)
  );
}
console.log('');
