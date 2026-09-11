/* Combien de matchs ont a la fois une cote et un jugement ? Lecture seule. */
import fs from 'node:fs';
for (const brut of fs.readFileSync('.env.local', 'utf8').split(String.fromCharCode(10))) {
  const l = brut.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data: cles } = await sb.from('cache_api').select('cle, ecrit_le').ilike('cle', '%cote%').order('cle').limit(400);
console.log((cles ?? []).length + ' cles de reserve contenant « cote » ; premieres et dernieres :');
for (const c of (cles ?? []).slice(0, 3)) console.log('  ' + c.cle + '   ecrit ' + String(c.ecrit_le).slice(0, 16));
for (const c of (cles ?? []).slice(-3)) console.log('  ' + c.cle + '   ecrit ' + String(c.ecrit_le).slice(0, 16));
const cotes = new Map<number, any>();
for (const c of cles ?? []) {
  const { data } = await sb.from('cache_api').select('contenu').eq('cle', c.cle).maybeSingle();
  const ct: any = data?.contenu;
  const liste = Array.isArray(ct) ? ct : Array.isArray(ct?.matchs) ? ct.matchs : Array.isArray(ct?.cotes) ? ct.cotes : ct && typeof ct === 'object' ? Object.values(ct).filter((v: any) => v && typeof v === 'object' && ('fixtureId' in v || 'fixture_id' in v || 'id' in v)) : [];
  for (const x of liste as any[]) {
    const id = Number(x.fixtureId ?? x.fixture_id ?? x.id);
    if (Number.isFinite(id)) cotes.set(id, x);
  }
}
console.log('\n' + cotes.size + ' matchs avec une cote');
const exemple = [...cotes.values()][0];
console.log('exemple : ' + JSON.stringify(exemple).slice(0, 400));
const jug: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('fixture_id, date_match').range(de, de + 999);
  jug.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const F = 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const ligueDe = new Map<number, number>();
for (const x of JSON.parse(fs.readFileSync(F, 'utf8'))) ligueDe.set(Number(x.id), Number(x.ligue));
const GRANDS = new Set([39, 140, 135, 78, 61, 94, 88]);
const croises = jug.filter((j) => cotes.has(Number(j.fixture_id)));
console.log(croises.length + ' matchs a la fois cotes et juges, dont ' + croises.filter((j) => GRANDS.has(ligueDe.get(Number(j.fixture_id)) ?? -1)).length + ' dans les sept grands championnats, et ' + croises.filter((j) => [2, 3].includes(ligueDe.get(Number(j.fixture_id)) ?? -1)).length + ' en Ligue des champions ou Europa League');
