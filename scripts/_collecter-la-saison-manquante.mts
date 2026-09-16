/**
 * RÉCUPÈRE LA SAISON QUI MANQUAIT AU BANC, ET RIEN D'AUTRE.
 *
 * ── POURQUOI ────────────────────────────────────────────────────────────
 *
 * `calculerForces` — que la production consulte à chaque analyse — bâtit ses
 * forces sur la SAISON PRÉCÉDENTE du championnat, et refuse de se prononcer en
 * dessous de cinquante rencontres. La production les demande au fournisseur et
 * les obtient toujours.
 *
 * Le banc n'en collectait que deux. Pour la plus ancienne des deux, il n'avait
 * donc aucune saison antérieure : sur ses premières journées, les forces
 * étaient déclarées non fiables, et le banc décrivait un moteur plus faible que
 * le vrai. Mesuré le 15 septembre 2026 : 796 rencontres à 46,6 % de justesse,
 * dont un tiers mises en avant pour 49,6 % — un creux qui n'existait pas en
 * production, et pour lequel j'ai failli écrire une couche.
 *
 * ── CE QUE CE SCRIPT FAIT, ET CE QU'IL NE FAIT PAS ──────────────────────
 *
 * Il demande les rencontres terminées de la saison manquante, championnat par
 * championnat, et les FUSIONNE dans le fichier existant. Il ne touche ni aux
 * tirs, ni aux cotes, ni à la mémoire : le rafraîchissement complet balaie une
 * demi-heure de cotes, inutile ici.
 *
 * Il refuse d'écrire si le fichier rétrécit — la leçon de la nuit du
 * 13 septembre 2026, où une collecte vide avait écrasé les rencontres.
 *
 *   npx tsx scripts/_collecter-la-saison-manquante.mts [combien de saisons en arrière]
 */
import fs from 'node:fs';
import { chargerEnv, assurerDossiers, FICHIER_RENCONTRES, journal } from './challenger/commun.mjs';

chargerEnv();
assurerDossiers();

const { apiFootball, LEAGUE_IDS } = await import('../src/lib/api-football.js');

const maintenant = new Date();
const saison =
  maintenant.getUTCMonth() >= 6 ? maintenant.getUTCFullYear() : maintenant.getUTCFullYear() - 1;
const enArriere = Number(process.argv[2] ?? 2);
const cible = saison - enArriere;

const ligues = [
  ...new Set<number>([...Object.values(LEAGUE_IDS as Record<string, number>).map(Number), 2, 3, 848]),
];

const existantes: any[] = fs.existsSync(FICHIER_RENCONTRES)
  ? JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'))
  : [];
const avant = existantes.length;
const parId = new Map<number, any>(existantes.map((m) => [Number(m.id), m]));

journal(`${avant} rencontres déjà en place. Saison demandée : ${cible}, ${ligues.length} championnats.`);

let ajoutees = 0;
let championnatsServis = 0;
for (const ligue of ligues) {
  try {
    // Une saison close ne bouge plus jamais : trois mois en réserve.
    const r: any = await apiFootball(
      `/fixtures?league=${ligue}&season=${cible}&status=FT`,
      90 * 86_400_000
    );
    let n = 0;
    for (const f of r?.response ?? []) {
      if (f?.goals?.home == null || f?.goals?.away == null) continue;
      const id = Number(f.fixture.id);
      if (parId.has(id)) continue;
      parId.set(id, {
        id,
        date: String(f.fixture.date),
        ligue: Number(f.league.id),
        saison: Number(f.league.season),
        dom: Number(f.teams.home.id),
        ext: Number(f.teams.away.id),
        nomDom: String(f.teams.home.name),
        nomExt: String(f.teams.away.name),
        bd: Number(f.goals.home),
        be: Number(f.goals.away),
      });
      n++;
    }
    if (n) {
      ajoutees += n;
      championnatsServis++;
    }
  } catch (e: any) {
    journal(`  ligue ${ligue} saison ${cible} illisible : ${e?.message}`);
  }
}

const toutes = [...parId.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

// Le fichier ne doit JAMAIS rétrécir : leçon de la nuit du 13 septembre 2026,
// où une collecte vide avait écrasé les rencontres.
if (toutes.length < avant) {
  journal(`ÉCRITURE REFUSÉE : ${toutes.length} rencontres contre ${avant} déjà en place.`);
  process.exit(1);
}

fs.writeFileSync(FICHIER_RENCONTRES, JSON.stringify(toutes));
journal(
  `${ajoutees} rencontres ajoutées depuis ${championnatsServis} championnat(s) — ` +
    `${avant} → ${toutes.length}. Première date : ${String(toutes[0]?.date).slice(0, 10)}.`
);
