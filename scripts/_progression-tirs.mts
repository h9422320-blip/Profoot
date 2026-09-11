/* Combien des fiches de tirs des quatre championnats sont deja en reserve. Lecture seule. */
import fs from 'node:fs';
for (const brut of fs.readFileSync('.env.local', 'utf8').split(String.fromCharCode(10))) {
  const l = brut.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const F = 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(F, 'utf8'));
const LIGUES = [244, 283, 286, 357];
const ids: number[] = tout.filter((x: any) => LIGUES.includes(x.ligue) && x.date >= '2025-07-01').map((x: any) => Number(x.id));
let presentes = 0, pleines = 0;
const parLigue = new Map<number, { p: number; n: number }>();
for (let k = 0; k < ids.length; k += 150) {
  const lot = ids.slice(k, k + 150);
  const { data } = await sb.from('cache_api').select('cle, contenu').in('cle', lot.map((id) => 'apifb:/fixtures/statistics?fixture=' + id));
  for (const d of data ?? []) {
    presentes++;
    const c: any = d.contenu;
    const rep = Array.isArray(c) ? c : c?.response ?? [];
    if (rep.length >= 2) pleines++;
  }
}
for (const id of LIGUES) parLigue.set(id, { p: 0, n: tout.filter((x: any) => x.ligue === id && x.date >= '2025-07-01').length });
console.log(ids.length + ' fiches a lire ; ' + presentes + ' deja en reserve (' + Math.round(100 * presentes / ids.length) + ' %), dont ' + pleines + ' avec des tirs');
