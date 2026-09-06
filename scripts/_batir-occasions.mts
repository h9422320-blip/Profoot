import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { construireForces } = await import('../src/lib/forme-occasions.js');
const t0 = Date.now();
const r = await construireForces();
if (!r) {
  console.log('ECHEC : matiere insuffisante');
  process.exit(1);
}
console.log(
  `=> ${Object.keys(r.clubs).length} clubs, ${Object.keys(r.moyennesParLigue).length} competitions etalonnees, en ${Math.round((Date.now() - t0) / 1000)} s`
);
for (const [nom, m] of Object.entries(r.moyennesParLigue).sort((a, b) => b[1] - a[1]))
  console.log(`     ${nom.padEnd(28)} ${m}`);
