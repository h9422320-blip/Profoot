import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { precalculerGrandsMatchs } = await import('../src/lib/precalcul-selection.js');
const r = await precalculerGrandsMatchs();
console.log(`${r.calculees} calculee(s), ${r.dejaConnues} deja connue(s) sur ${r.examinees} examinee(s)` + (r.echecs ? ` — ${r.echecs} echec(s)` : ''));
