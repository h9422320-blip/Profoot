import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { bilanDuSoir, messageBilanDuSoir } = await import('../src/lib/bilan-du-soir.js');
for (const jour of [new Date().toISOString().slice(0,10), '2026-09-09']) {
  const b = await bilanDuSoir(jour);
  const m = messageBilanDuSoir(b);
  console.log('\n══════════════════════════════════════════');
  console.log('SUJET : ' + m.sujet);
  console.log('──────────────────────────────────────────');
  console.log(m.texte);
}
