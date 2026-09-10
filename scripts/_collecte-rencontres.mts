/**
 * Collecte toutes les rencontres terminees des competitions suivies, sur les
 * saisons 2024, 2025 et 2026, dans un fichier de travail. Memes appels que la
 * hierarchie des championnats (meme cache), donc rien de nouveau a payer.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { apiFootball, CACHE_TTL, LEAGUE_IDS } = await import('../src/lib/api-football.js');
const SORTIE = 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const ligues = [...new Set(Object.values(LEAGUE_IDS as Record<string, number>))];
const out: any[] = [];
let vides = 0, n = 0;
for (const ligue of ligues) {
  for (const saison of [2024, 2025, 2026]) {
    n++;
    try {
      const r: any = await apiFootball(`/fixtures?league=${ligue}&season=${saison}&status=FT`, CACHE_TTL.TEAM_INFO);
      const lot = r?.response ?? [];
      if (!lot.length) vides++;
      for (const f of lot) {
        if (f?.goals?.home == null || f?.goals?.away == null) continue;
        out.push({
          id: f.fixture.id, date: f.fixture.date, ligue: f.league.id, nomLigue: f.league.name,
          saison: f.league.season, tour: f.league.round,
          dom: f.teams.home.id, ext: f.teams.away.id, nomDom: f.teams.home.name, nomExt: f.teams.away.name,
          bd: f.goals.home, be: f.goals.away,
        });
      }
    } catch (e: any) { console.log(`  ligue ${ligue} saison ${saison} : ${e?.message}`); }
  }
}
fs.writeFileSync(SORTIE, JSON.stringify(out));
const coupes = out.filter((x) => [2, 3, 848].includes(x.ligue));
console.log(`${n} pages lues (${vides} vides), ${out.length} rencontres, dont ${coupes.length} en coupe d Europe`);
for (const s of [2024, 2025, 2026]) console.log(`  saison ${s} : ${out.filter((x) => x.saison === s).length} rencontres, ${coupes.filter((x) => x.saison === s).length} en coupe`);
