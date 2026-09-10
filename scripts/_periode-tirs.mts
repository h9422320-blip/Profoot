import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const ids = new Set<number>();
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('cache_api').select('cle').ilike('cle', 'apifb:/fixtures/statistics?fixture=%').range(de, de + 999);
  for (const d of data ?? []) ids.add(Number(String(d.cle).split('=').pop()));
  if (!data || data.length < 1000) break;
}
const F = 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(F, 'utf8'));
const connus = tout.filter((x) => ids.has(x.id));
connus.sort((a, b) => a.date.localeCompare(b.date));
console.log(`${ids.size} fiches de tirs en cache, ${connus.length} retrouvees dans les rencontres collectees`);
console.log(`periode : ${connus[0]?.date.slice(0, 10)} -> ${connus[connus.length - 1]?.date.slice(0, 10)}`);
const parMois = new Map<string, number>();
for (const x of connus) parMois.set(x.date.slice(0, 7), (parMois.get(x.date.slice(0, 7)) ?? 0) + 1);
console.log('par mois : ' + [...parMois].map(([m, n]) => `${m}:${n}`).join('  '));
const coupes = connus.filter((x) => [2, 3, 848].includes(x.ligue));
console.log(`dont ${coupes.length} matchs de coupe d Europe avec leurs tirs`);
// matchs de coupe dont les DEUX equipes ont au moins 8 matchs avec tirs AVANT le coup d envoi
const parEquipe = new Map<number, string[]>();
for (const x of connus) for (const e of [x.dom, x.ext]) { if (!parEquipe.has(e)) parEquipe.set(e, []); parEquipe.get(e)!.push(x.date); }
const toutesCoupes = tout.filter((x) => [2, 3, 848].includes(x.ligue) && x.date >= '2026-01-15');
const evaluables = toutesCoupes.filter((m) => [m.dom, m.ext].every((e) => (parEquipe.get(e) ?? []).filter((d) => d < m.date).length >= 8));
console.log(`matchs de coupe depuis le 15 janvier 2026 : ${toutesCoupes.length}, dont ${evaluables.length} ou les deux clubs ont >= 8 matchs avec tirs avant`);
