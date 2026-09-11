/* Les fiches de tirs en reserve portent-elles les buts attendus (xG) du fournisseur ? Lecture seule. */
import fs from 'node:fs';
for (const brut of fs.readFileSync('.env.local', 'utf8').split(String.fromCharCode(10))) {
  const l = brut.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const F = 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const meta = new Map<number, any>();
for (const x of JSON.parse(fs.readFileSync(F, 'utf8'))) meta.set(Number(x.id), x);
const NOMS: Record<number, string> = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1', 94: 'Primeira Liga', 88: 'Eredivisie', 2: 'Ligue des champions', 3: 'Europa League', 848: 'Conference League' };
const compte = new Map<number, { n: number; xg: number }>();
let exemple: any = null;
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('cache_api').select('cle, contenu').ilike('cle', 'apifb:/fixtures/statistics?fixture=%').range(de, de + 999);
  if (error) { console.log('erreur ' + error.message); break; }
  for (const d of data ?? []) {
    const m = meta.get(Number(String(d.cle).split('=').pop()));
    if (!m || !NOMS[m.ligue]) continue;
    const c: any = d.contenu;
    const rep = Array.isArray(c) ? c : c?.response ?? [];
    if (rep.length < 2) continue;
    const xg = rep.every((eq: any) => (eq.statistics ?? []).some((s: any) => s.type === 'expected_goals' && s.value !== null && s.value !== undefined && s.value !== ''));
    const k = compte.get(m.ligue) ?? { n: 0, xg: 0 };
    k.n++; if (xg) k.xg++;
    compte.set(m.ligue, k);
    if (!exemple && m.ligue === 39) exemple = { match: m.nomDom + ' - ' + m.nomExt + ' ' + m.date.slice(0, 10), types: (rep[0].statistics ?? []).map((s: any) => s.type + '=' + s.value) };
  }
  if (!data || data.length < 1000) break;
}
console.log('competition            fiches   avec xG des deux equipes');
for (const [id, nom] of Object.entries(NOMS)) {
  const k = compte.get(Number(id)) ?? { n: 0, xg: 0 };
  console.log('  ' + nom.padEnd(22) + String(k.n).padStart(5) + '   ' + String(k.xg).padStart(5) + (k.n ? '  (' + Math.round(100 * k.xg / k.n) + ' %)' : ''));
}
if (exemple) { console.log('\nexemple Premier League : ' + exemple.match); console.log('  ' + exemple.types.join(' | ')); }
