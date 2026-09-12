/**
 * LES DONNÉES DU CHALLENGER, REMISES À JOUR CHAQUE NUIT.
 *
 *   1. les rencontres terminées de toutes les compétitions suivies, saison en
 *      cours et précédente — mêmes appels que la production, même réserve ;
 *   2. les fiches de tirs des matchs des 45 derniers jours qui manquent
 *      encore en réserve — la production les réutilisera, elles restent un an ;
 *   3. l'export, sur l'ordinateur, des rencontres avec leurs tirs, pour que
 *      chaque évaluation n'ait pas à relire vingt mégaoctets en base.
 *
 * Lecture chez le fournisseur et dans la réserve ; aucune écriture ailleurs
 * que dans la réserve des pages du fournisseur et dans `.challenger/`.
 */
import fs from 'node:fs';
import { chargerEnv, assurerDossiers, FICHIER_RENCONTRES, FICHIER_TIRS, FICHIER_COTES, journal } from './commun.mjs';

const nombre = (stats: any[] | undefined, type: string): number => {
  const s = (stats ?? []).find((x) => x?.type === type);
  const v = s?.value;
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? Number(String(v).replace('%', '')) || 0 : Number(v) || 0;
};

export async function rafraichirDonnees(): Promise<{ rencontres: number; tirs: number; fichesLues: number }> {
  chargerEnv();
  assurerDossiers();
  const { apiFootball, LEAGUE_IDS } = await import('../../src/lib/api-football.js');
  const { CHAMPIONNATS } = await import('../../src/lib/forme-occasions.js');
  const { createAdminClient } = await import('../../src/lib/supabase-admin.js');
  const sb = createAdminClient();

  // ── 1. LES RENCONTRES ────────────────────────────────────────────────────
  const maintenant = new Date();
  const saison = maintenant.getUTCMonth() >= 6 ? maintenant.getUTCFullYear() : maintenant.getUTCFullYear() - 1;
  const ligues = [...new Set<number>([...Object.values(LEAGUE_IDS as Record<string, number>).map(Number), 2, 3, 848])];
  const parId = new Map<number, any>();
  for (const ligue of ligues) {
    for (const s of [saison - 1, saison]) {
      // La saison en cours se relit chaque nuit ; la précédente ne bouge plus.
      const duree = s === saison ? 12 * 3_600_000 : 30 * 86_400_000;
      try {
        const r: any = await apiFootball(`/fixtures?league=${ligue}&season=${s}&status=FT`, duree);
        for (const f of r?.response ?? []) {
          if (f?.goals?.home == null || f?.goals?.away == null) continue;
          parId.set(Number(f.fixture.id), {
            id: Number(f.fixture.id),
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
        }
      } catch (e: any) {
        journal(`  ligue ${ligue} saison ${s} illisible : ${e?.message}`);
      }
    }
  }
  const rencontres = [...parId.values()].sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(FICHIER_RENCONTRES, JSON.stringify(rencontres));
  journal(`${rencontres.length} rencontres terminées rangées`);

  // ── LA MÉMOIRE DE TOUS LES CLUBS, RANGÉE POUR LA PRODUCTION ──────────────
  //
  // Une note par club, bâtie sur TOUTES les rencontres ci-dessus — 62
  // compétitions, coupes comprises. La production ne sait pas la calculer :
  // l'hébergeur coupe ses fonctions à soixante secondes. Ici, les rencontres
  // sont déjà en local, le calcul ne coûte donc AUCUNE demande au
  // fournisseur.
  //
  // Le moteur ne s'en sert que là où il est aveugle : un club hors des sept
  // grands championnats, donc sans tirs. Voir `src/lib/memoire-clubs.ts`.
  try {
    const { calculerMemoireClubs, rangerMemoireClubs } = await import('../../src/lib/memoire-clubs.js');
    const memoire = calculerMemoireClubs(rencontres as any);
    await rangerMemoireClubs(memoire);
    journal(`mémoire des clubs rangée : ${memoire.clubs} clubs sur ${memoire.rencontres} rencontres`);
  } catch (e: any) {
    journal(`mémoire des clubs non rangée : ${e?.message ?? String(e)}`);
  }

  // ── UNE LECTURE QUI NE LÂCHE PAS À LA PREMIÈRE COUPURE ───────────────────
  //
  // Le 12 septembre 2026 à 11 h 06, la base a coupé une lecture volumineuse
  // en route (« TypeError: terminated » après cinq minutes de pagination) et
  // TOUTE la journée du challenger est tombée : aucun rapport, aucune couche
  // essayée. Une page refusée est désormais redemandée trois fois, en
  // patientant de plus en plus, avant d'abandonner.
  const lirePage = async (colonnes: string, de: number, etiquette: string) => {
    let dernier = '';
    for (let essai = 1; essai <= 3; essai++) {
      const { data, error } = await sb
        .from('cache_api')
        .select(colonnes)
        .ilike('cle', 'apifb:/fixtures/statistics?fixture=%')
        .range(de, de + 999);
      if (!error) return (data ?? []) as any[];
      dernier = error.message;
      journal(`${etiquette} : page ${de} refusée (${dernier}) — nouvel essai dans ${3 * essai} s`);
      await new Promise((r) => setTimeout(r, 3000 * essai));
    }
    throw new Error(`${etiquette} : ${dernier}`);
  };

  // ── 2. LES FICHES DE TIRS QUI MANQUENT ───────────────────────────────────
  const nomDe = new Map<number, string>(CHAMPIONNATS.map((c: any) => [Number(c.id), String(c.nom)]));
  const cles = new Set<string>();
  for (let de = 0; de < 200_000; de += 1000) {
    const data = await lirePage('cle', de, 'lecture des clés de la réserve');
    for (const d of data) cles.add(String(d.cle));
    if (data.length < 1000) break;
  }
  const depuis = Date.now() - 45 * 86_400_000;
  const manquants = rencontres.filter(
    (m) => nomDe.has(m.ligue) && Date.parse(m.date) >= depuis && !cles.has('apifb:/fixtures/statistics?fixture=' + m.id)
  );
  let fichesLues = 0;
  for (const m of manquants) {
    try {
      await apiFootball('/fixtures/statistics?fixture=' + m.id, 365 * 86_400_000);
      fichesLues++;
    } catch {
      // Une fiche illisible cette nuit sera retentée la nuit prochaine.
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  journal(`${fichesLues} fiche(s) de tirs nouvellement mises en réserve (${manquants.length} manquaient)`);

  // ── 3. L'EXPORT DES TIRS, LUS COMME LES LIT LA CONSTRUCTION ──────────────
  const tirs: any[] = [];
  for (let de = 0; de < 200_000; de += 1000) {
    const data = await lirePage('cle, contenu', de, 'lecture des tirs');
    for (const d of data) {
      const m = parId.get(Number(String(d.cle).split('=').pop()));
      if (!m) continue;
      const ligue = nomDe.get(m.ligue);
      if (!ligue) continue;
      const c: any = d.contenu;
      const rep = Array.isArray(c) ? c : c?.response ?? [];
      if (rep.length < 2) continue;
      const bloc = (nom: string) => rep.find((x: any) => x?.team?.name === nom);
      const dd = bloc(m.nomDom);
      const ee = bloc(m.nomExt);
      if (!dd || !ee) continue;
      tirs.push({
        ligue,
        date: Date.parse(m.date),
        dom: m.nomDom,
        ext: m.nomExt,
        cadresD: nombre(dd.statistics, 'Shots on Goal'),
        surfaceD: nombre(dd.statistics, 'Shots insidebox'),
        cadresE: nombre(ee.statistics, 'Shots on Goal'),
        surfaceE: nombre(ee.statistics, 'Shots insidebox'),
        butsD: m.bd,
        butsE: m.be,
      });
    }
    if (!data || data.length < 1000) break;
  }
  fs.writeFileSync(FICHIER_TIRS, JSON.stringify(tirs));
  journal(`${tirs.length} rencontres avec leurs tirs exportées`);

  // ── 3 BIS. TOUTES LES COTES DU JOUR, SANS LA LIMITE DE L'HÉBERGEUR ────────
  //
  // La production relève les cotes à minuit, dans une tâche plafonnée à trois
  // cents secondes, avec son propre budget de quatre-vingt-dix : elle ne passe
  // qu'une partie des championnats chaque jour, à tour de rôle. Mesuré le
  // 11 septembre 2026 : une cinquantaine de matchs cotés et joués par semaine
  // dans les grands championnats et les coupes d'Europe — trois à quatre
  // semaines avant que la couche du marché ait de quoi être jugée.
  //
  // Ici, rien ne presse : on les passe TOUS, avec la même fonction, dans la
  // même réserve. La production en profite aussi.
  try {
    const { releverCotes } = await import('../../src/lib/cotes-marche.js');
    // DOUCEMENT : la clé du fournisseur est la même que celle des abonnés qui
    // lancent une analyse en pleine journée. Trois demandes à la fois et une
    // seconde et demie entre deux paquets — une centaine par minute au plus —,
    // là où un relevé à douze de front a dépassé la limite de l'abonnement le
    // 11 septembre 2026. Trente minutes suffisent largement.
    const r = await releverCotes(new Date(), 30 * 60_000, 3, 1_500);
    journal(`${r.matchs} rencontres cotées relevées sur ${r.jours} journées (${r.ligues} championnats)`);
  } catch (e: any) {
    journal(`relevé complet des cotes impossible : ${e?.message}`);
  }

  // ── 4. LES COTES, POUR LA COUCHE DU MARCHÉ ───────────────────────────────
  //
  // Relevées chaque jour par la production (`cotes-marche.ts`) et rangées
  // par jour dans la réserve. On n'en garde que les probabilités, par
  // rencontre.
  // ── ET SEULEMENT CELLES RELEVÉES AVANT LES MATCHS ──────────────────────
  //
  // Constaté le 12 septembre 2026 : TOUTES les journées du 17 août au 10
  // septembre avaient été rangées APRÈS coup, jusqu'à huit jours plus tard.
  // Ce sont donc des cotes de CLÔTURE : elles contiennent déjà les
  // compositions, les blessures de dernière minute et l'argent engagé.
  // Mesurée là-dessus, la couche du marché gagnait +32 et +33 vainqueurs —
  // un mirage, qui aurait pu être mis en ligne. Une journée écrite après
  // son propre jour est désormais ÉCARTÉE, et sans date d'écriture aussi.
  const cotes: Record<string, { dom: number; nul: number; ext: number }> = {};
  let journeesGardees = 0;
  let journeesEcartees = 0;
  for (let de = 0; de < 20_000; de += 200) {
    const { data, error } = await sb
      .from('cache_api')
      .select('cle, contenu, ecrit_le')
      .ilike('cle', 'cotes:%')
      .range(de, de + 199);
    if (error) throw new Error('lecture des cotes : ' + error.message);
    for (const r of data ?? []) {
      const jour = String(r.cle).slice('cotes:'.length);
      const ecrit = String(r.ecrit_le ?? '').slice(0, 10);
      if (!ecrit || Date.parse(ecrit) > Date.parse(jour)) {
        journeesEcartees++;
        continue;
      }
      journeesGardees++;
      const c: any = r.contenu;
      const liste: any[] = Array.isArray(c)
        ? c
        : Array.isArray(c?.matchs)
          ? c.matchs
          : Array.isArray(c?.cotes)
            ? c.cotes
            : Object.values(c ?? {}).flatMap((v: any) => (Array.isArray(v) ? v : []));
      for (const m of liste)
        if (m?.id && m?.proba)
          cotes[String(m.id)] = { dom: Number(m.proba.dom), nul: Number(m.proba.nul), ext: Number(m.proba.ext) };
    }
    if (!data || data.length < 200) break;
  }
  fs.writeFileSync(FICHIER_COTES, JSON.stringify(cotes));
  journal(
    `${Object.keys(cotes).length} rencontres cotées exportées — ${journeesGardees} journée(s) relevée(s) avant les matchs, ` +
      `${journeesEcartees} écartée(s) parce que relevée(s) après (cote de clôture)`
  );

  return { rencontres: rencontres.length, tirs: tirs.length, fichesLues };
}

// Lancé seul : `npx tsx scripts/challenger/donnees.mts`
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/challenger/donnees.mts')) {
  const r = await rafraichirDonnees();
  journal(`données prêtes : ${JSON.stringify(r)}`);
}
