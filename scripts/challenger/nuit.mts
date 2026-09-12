/**
 * LE CHALLENGER DE NUIT DU MOTEUR PROFOOT.
 *
 * ── CE QU'IL FAIT, CHAQUE NUIT, SUR L'ORDINATEUR DU PROPRIÉTAIRE ─────────
 *
 *   1. il vérifie que l'apprentissage quotidien de la production tourne ;
 *   2. il remet ses données à jour — rencontres, tirs des derniers matchs ;
 *   3. il lit dans le CODE les réglages actuels du moteur : c'est le champion ;
 *   4. il essaie des COUCHES nouvelles posées par-dessus le moteur — jamais
 *      une variante d'un réglage existant (décision du 11 septembre 2026) ;
 *   5. il rejoue champion et variantes par le VRAI moteur sur les matchs des
 *      sept grands championnats, de la Ligue des champions et de l'Europa
 *      League, chacun avec seulement ce qui était connu la veille ;
 *   6. il juge chaque variante à la porte de `porte.ts` ;
 *   7. il garde tout, nuit après nuit, et PROPOSE une variante qui a gagné
 *      plusieurs nuits ;
 *   8. il écrit son rapport sur l'ordinateur, et dans la réserve de la base,
 *      où la session de travail suivante le retrouve.
 *
 * ── CE QU'IL NE FAIT JAMAIS ──────────────────────────────────────────────
 *
 * Il ne touche pas au code du moteur, ne pousse rien sur GitHub, ne met rien
 * en ligne. Une proposition devient une amélioration après validation et
 * passage par les garanties ★ ACQUIS : c'est ce qui garantit, selon la règle
 * du propriétaire, que rien ne régresse.
 *
 * Priorité fixée par le propriétaire le 11 septembre 2026 : les grands
 * championnats d'Europe, puis la Ligue des champions, puis l'Europa League.
 *
 * Lancé par `lancer-la-nuit.cmd`, lui-même lancé par le Planificateur de
 * tâches de Windows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RACINE,
  DOSSIER_TRAVAIL,
  DOSSIER_RAPPORTS,
  FICHIER_HISTORIQUE,
  FICHIER_PROPOSITION,
  GRANDS,
  COUPES_SUIVIES,
  assurerDossiers,
  chargerEnv,
  journal,
} from './commun.mjs';
import { mesurer, moities, verdict, aProposer, type Mesure, type Pronostic } from './porte.js';

chargerEnv();
assurerDossiers();

// ── UNE SEULE NUIT À LA FOIS ───────────────────────────────────────────────
//
// Deux nuits simultanées écriraient les mêmes fichiers de travail, et l'une
// pourrait lire le résultat de l'autre. Le verrou porte le numéro du
// processus qui l'a posé : s'il tourne encore, cette nuit s'efface ; s'il est
// mort — ordinateur éteint en pleine nuit —, le verrou est repris.
const VERROU = path.join(DOSSIER_TRAVAIL, 'verrou.json');
function autreNuitEnCours(): boolean {
  if (!fs.existsSync(VERROU)) return false;
  try {
    const pid = Number(JSON.parse(fs.readFileSync(VERROU, 'utf8')).pid);
    if (!pid || pid === process.pid) return false;
    process.kill(pid, 0); // lève si ce processus n'existe plus
    return true;
  } catch {
    return false;
  }
}
if (autreNuitEnCours()) {
  journal('une autre nuit tourne déjà : celle-ci s’efface');
  process.exit(0);
}
fs.writeFileSync(VERROU, JSON.stringify({ pid: process.pid, depuis: new Date().toISOString() }));
process.on('exit', () => {
  try {
    fs.rmSync(VERROU);
  } catch {
    // déjà retiré
  }
});

const NUIT = new Date().toISOString().slice(0, 10);
/** Avant cette date, la réserve de tirs est trop maigre pour reconstruire un relevé. */
const DEBUT_EVALUATION = '2026-02-15';
const TSX = path.join(RACINE, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rapport: string[] = [];
const ligne = (t = '') => {
  rapport.push(t);
};
const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const lireSource = (f: string) => fs.readFileSync(path.join(RACINE, f), 'utf8');

// ── 1. L'APPRENTISSAGE QUOTIDIEN DE LA PRODUCTION ──────────────────────────
async function sante(): Promise<void> {
  const { createAdminClient } = await import('../../src/lib/supabase-admin.js');
  const sb = createAdminClient();
  const heuresDepuis = (iso?: string | null) => (iso ? (Date.now() - Date.parse(iso)) / 3_600_000 : Infinity);
  const age = (h: number) => (!Number.isFinite(h) ? 'absent' : h < 48 ? `il y a ${h.toFixed(1)} h` : `il y a ${Math.round(h / 24)} jours`);

  ligne('## 1. L’apprentissage quotidien de la production');
  ligne('');
  const { data: dj } = await sb.from('jugements_moteur').select('juge_le').order('juge_le', { ascending: false }).limit(1);
  const hj = heuresDepuis(dj?.[0]?.juge_le);
  ligne(`- ${hj <= 36 ? '✅' : '⚠️'} Matchs confrontés à leur résultat : dernier jugement ${age(hj)}`);

  const releves: [string, string, number][] = [
    ['Fiabilité par championnat', 'src/lib/fiabilite-apprise.ts', 30],
    ['Forces aux tirs des clubs', 'src/lib/forme-occasions.ts', 30],
    ['Hiérarchie des championnats', 'src/lib/forces-championnats.ts', 8 * 24],
  ];
  for (const [nom, fichier, seuil] of releves) {
    const cle = lireSource(fichier).match(/const CLE = '([^']+)'/)?.[1];
    if (!cle) {
      ligne(`- ⚠️ ${nom} : clé introuvable dans ${fichier}`);
      continue;
    }
    const { data } = await sb.from('cache_api').select('ecrit_le').eq('cle', cle).maybeSingle();
    const h = heuresDepuis(data?.ecrit_le);
    ligne(`- ${h <= seuil ? '✅' : '⚠️'} ${nom} : refait ${age(h)}`);
  }
  ligne('');
}

// ── 3. LE CHAMPION : LES RÉGLAGES TELS QU'ILS SONT DANS LE CODE ────────────
type Parametre = {
  nom: string;
  env: string;
  valeur: number;
  pas: number;
  min: number;
  max: number;
  niveau: 'score' | 'releve';
};
function lireReglage(source: string, motif: RegExp, nom: string): number {
  const v = Number(source.match(motif)?.[1]);
  if (!Number.isFinite(v)) throw new Error(`réglage « ${nom} » introuvable dans le code : le challenger refuse de tester à l’aveugle`);
  return v;
}
function champion(): Parametre[] {
  const sp = lireSource('src/lib/score-probable.ts');
  const fo = lireSource('src/lib/forme-occasions.ts');
  return [
    { nom: 'Part des tirs dans le calcul', env: 'BANC_POIDS_OCCASIONS', valeur: lireReglage(sp, /BANC_POIDS_OCCASIONS \?\? ([\d.]+)/, 'part des tirs'), pas: 0.1, min: 0.1, max: 0.9, niveau: 'score' },
    { nom: 'Resserrage des pourcentages', env: 'BANC_AIGUISAGE', valeur: lireReglage(sp, /BANC_AIGUISAGE \?\? ([\d.]+)/, 'resserrage'), pas: 0.15, min: 1, max: 2, niveau: 'score' },
    { nom: 'Marge avant d’annoncer un nul', env: 'BANC_MARGE_NUL', valeur: lireReglage(sp, /BANC_MARGE_NUL\) \|\| ([\d.]+)/, 'marge du nul'), pas: 1, min: 1, max: 8, niveau: 'score' },
    { nom: 'Écart jugé non départagé', env: 'BANC_ECART_NUL', valeur: lireReglage(sp, /BANC_ECART_NUL\) \|\| ([\d.]+)/, 'écart non départagé'), pas: 1, min: 1, max: 6, niveau: 'score' },
    { nom: 'Plafond des scores', env: 'BANC_MARGE_PLAFOND', valeur: lireReglage(sp, /BANC_MARGE_PLAFOND\) \|\| ([\d.]+)/, 'plafond'), pas: 0.25, min: 0.25, max: 3, niveau: 'score' },
    { nom: 'Vitesse d’oubli des vieux matchs', env: 'BANC_DEMI_VIE', valeur: lireReglage(fo, /BANC_DEMI_VIE\) \|\| (\d+)/, 'demi-vie'), pas: 2, min: 2, max: 20, niveau: 'releve' },
    { nom: 'Lissage vers la moyenne', env: 'BANC_RETRAIT', valeur: lireReglage(fo, /BANC_RETRAIT\) \|\| (\d+)/, 'lissage'), pas: 1, min: 1, max: 10, niveau: 'releve' },
    { nom: 'Minimum de matchs pour juger un club', env: 'BANC_MINIMUM_RENCONTRES', valeur: lireReglage(fo, /BANC_MINIMUM_RENCONTRES\) \|\| (\d+)/, 'minimum de matchs'), pas: 2, min: 4, max: 16, niveau: 'releve' },
  ];
}

// ── 4. LES COUCHES À ESSAYER ─────────────────────────────────────────────
//
// Décision du propriétaire, le 11 septembre 2026 : le moteur ne s'améliore
// qu'en AJOUTANT des couches ; aucun réglage existant n'est jamais modifié.
// Le challenger ne fabrique donc plus de variantes des réglages : il essaie
// des couches posées par-dessus le calcul, chaque jour sur plus de matchs.
// Une couche refusée aujourd'hui peut passer dans un mois, quand la matière
// aura grossi — c'est tout l'intérêt de la rejouer chaque jour.
type Couche =
  | { type: 'erreurs-clubs'; retrecissement: number; poids: number }
  | { type: 'marche'; poids: number }
  | { type: 'elo'; k: number; poids: number }
  | { type: 'terrain'; retrecissement: number; poids: number }
  | { type: 'duel'; retrecissement: number; poids: number }
  | { type: 'elan'; court: number; long: number; poids: number }
  | { type: 'terrain-ligue'; retrecissement: number; poids: number }
  | {
      type: 'melange';
      elo?: { k: number; poids: number };
      elan?: { court: number; long: number; poids: number };
      terrainLigue?: { retrecissement: number; poids: number };
    }
  | { type: 'memoire'; k: number; poids: number }
  | { type: 'demi-vue' };
type Variante = { nom: string; couche: Couche; libelle: string };
function couchesAEssayer(): Variante[] {
  const out: Variante[] = [];
  for (const retrecissement of [10, 20, 40])
    for (const poids of [0.5, 1])
      out.push({
        nom: `ERREURS_CLUBS k=${retrecissement} poids=${poids}`,
        couche: { type: 'erreurs-clubs', retrecissement, poids },
        libelle: `Couche des erreurs apprises par club (k=${retrecissement}, poids ${poids})`,
      });
  // La couche du marché : jugée sur les seuls matchs cotés. Le propriétaire a
  // fixé 1 000 matchs cotés et jugés avant toute décision ; d'ici là, la porte
  // la refuse d'elle-même faute de matchs, et le rapport dit où on en est.
  for (const poids of [0.5, 0.75, 1])
    out.push({
      nom: `MARCHE part=${poids}`,
      couche: { type: 'marche', poids },
      libelle: `Couche du marché (part ${poids})`,
    });
  // La couche Elo : une note par club, bâtie sur tous ses matchs de deux
  // saisons, coupes d'Europe comprises — ce qui fait circuler le niveau d'un
  // championnat à l'autre.
  for (const k of [20, 30])
    for (const poids of [0.3, 0.5])
      out.push({
        nom: `ELO k=${k} part=${poids}`,
        couche: { type: 'elo', k, poids },
        libelle: `Couche Elo (k=${k}, part ${poids})`,
      });
  // La couche du terrain : l'avantage de recevoir, propre à chaque club.
  for (const retrecissement of [5, 10])
    for (const poids of [0.5, 1])
      out.push({
        nom: `TERRAIN k=${retrecissement} part=${poids}`,
        couche: { type: 'terrain', retrecissement, poids },
        libelle: `Couche du terrain propre au club (k=${retrecissement}, part ${poids})`,
      });
  // Les confrontations directes, au meilleur dosage mesuré le 12 septembre.
  out.push({
    nom: 'DUEL k=4 part=0.5',
    couche: { type: 'duel', retrecissement: 4, poids: 0.5 },
    libelle: 'Couche des confrontations directes (k=4, part 0.5)',
  });
  // L'élan : l'écart entre ce qu'un club produit en ce moment et sa moyenne
  // longue. Les trois meilleurs dosages des 48 mesurés le 12 septembre —
  // égalité puis +5 ou +6 justes, le plus près qu'une couche soit venue.
  for (const [court, long, poids] of [
    [5, 10, 0.2],
    [5, 10, 0.25],
    [5, 12, 0.15],
  ] as [number, number, number][])
    out.push({
      nom: `ELAN ${court}/${long} part=${poids}`,
      couche: { type: 'elan', court, long, poids },
      libelle: `Couche de l'élan (${court} derniers contre ${long}, part ${poids})`,
    });
  // Le terrain PAR CHAMPIONNAT : le moteur applique le même avantage de
  // recevoir partout (1,15 / 0,92), or il ne vaut pas la même chose en
  // Premier League et en Serie A. Sur la période récente, cette couche gagne
  // des deux côtés avec un meilleur Brier (mesuré le 12 septembre).
  for (const poids of [0.25, 0.5])
    out.push({
      nom: `TERRAIN-LIGUE k=20 part=${poids}`,
      couche: { type: 'terrain-ligue', retrecissement: 20, poids },
      libelle: `Couche du terrain par championnat (k=20, part ${poids})`,
    });
  // ── LES MÉLANGES ──────────────────────────────────────────────────────
  //
  // Mesuré le 12 septembre 2026 : posées ENSEMBLE, les couches font bien
  // mieux que seules. Elles ne regardent pas la même chose — Elo le niveau de
  // fond, l'élan la forme du moment, le terrain le poids de recevoir dans ce
  // championnat — et le moteur a deux points d'entrée libres.
  //
  // Sur 1 189 matchs : élan 0,2 + terrain 0,2 gagne +2 et +7 vainqueurs, des
  // DEUX côtés — refusé sur cinq dix-millièmes de Brier. Elo + élan monte la
  // précision « sûr de lui » à 68 % contre 65,3. Sur les trois derniers mois,
  // les trois appuyés donnent 75 % quand le moteur est sûr.
  out.push({
    nom: 'MELANGE elan=0.2 terrain=0.2',
    couche: { type: 'melange', elan: { court: 5, long: 10, poids: 0.2 }, terrainLigue: { retrecissement: 20, poids: 0.2 } },
    libelle: 'Mélange élan (5/10, part 0.2) + terrain par championnat (part 0.2)',
  });
  out.push({
    nom: 'MELANGE elo=0.3 elan=0.2',
    couche: { type: 'melange', elo: { k: 30, poids: 0.3 }, elan: { court: 5, long: 10, poids: 0.2 } },
    libelle: 'Mélange Elo (k=30, part 0.3) + élan (5/10, part 0.2)',
  });
  out.push({
    nom: 'MELANGE les trois',
    couche: {
      type: 'melange',
      elo: { k: 30, poids: 0.5 },
      elan: { court: 5, long: 10, poids: 0.25 },
      terrainLigue: { retrecissement: 20, poids: 0.25 },
    },
    libelle: 'Mélange des trois (Elo 0.5, élan 0.25, terrain 0.25)',
  });
  // ── CE QUI SOIGNE LES MATCHS QUE LE MOTEUR NE VOIT PAS ────────────────
  //
  // La mémoire des clubs est EN PRODUCTION depuis le 12 septembre 2026 à
  // k=30 part 0,6. On continue d'essayer d'AUTRES dosages : si l'un se
  // montre meilleur deux jours sur trois, il sera proposé.
  for (const poids of [0.5, 0.75])
    out.push({
      nom: `MEMOIRE k=30 part=${poids}`,
      couche: { type: 'memoire', k: 30, poids },
      libelle: `Mémoire des clubs à un autre dosage (k=30, part ${poids})`,
    });
  // La demi-vue : quand UN SEUL club manque au relevé des tirs, se servir de
  // ce qu'on sait de l'autre au lieu de tout jeter. Mesurée le 12 septembre
  // sur toutes compétitions : -2/+14 justes, Brier bien meilleur — refusée
  // sur la 1re moitié, à deux matchs près.
  out.push({
    nom: 'DEMI-VUE',
    couche: { type: 'demi-vue' },
    libelle: 'Demi-vue (un seul club connu du relevé des tirs)',
  });
  return out;
}

// ── 5. UNE ÉVALUATION, DANS UN PROCESSUS À PART ────────────────────────────
// Le processus de la nuit ne transmet aucun réglage BANC_* hérité : seul celui
// de la variante évaluée doit compter.
const envSansBanc = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('BANC_')));
function evaluer(
  etiquette: string,
  envReleve: Record<string, string>,
  variantes: { nom: string; env: Record<string, string>; couche?: Couche }[],
  univers?: 'cotes'
) {
  const nomFichier = etiquette.replace(/[^A-Za-z0-9_.=-]/g, '_');
  const tache = path.join(DOSSIER_TRAVAIL, `tache-${nomFichier}.json`);
  const sortie = path.join(DOSSIER_TRAVAIL, `resultat-${nomFichier}.json`);
  if (fs.existsSync(sortie)) fs.rmSync(sortie);
  fs.writeFileSync(tache, JSON.stringify({ debut: DEBUT_EVALUATION, fin: NUIT, variantes, univers, sortie }));
  journal(`évaluation « ${etiquette} » : ${variantes.length} variante(s)`);
  const r = spawnSync(process.execPath, [TSX, path.join('scripts', 'challenger', 'evaluer.mts'), tache], {
    cwd: RACINE,
    // Next.js déclare NODE_ENV obligatoire dans ProcessEnv ; l'environnement
    // réel du processus le porte, le type construit ci-dessus ne le sait pas.
    env: { ...envSansBanc, ...envReleve } as NodeJS.ProcessEnv,
    stdio: 'inherit',
    timeout: 90 * 60_000,
  });
  if (r.status !== 0 || !fs.existsSync(sortie))
    throw new Error(`évaluation « ${etiquette} » en échec (code ${r.status ?? r.signal})`);
  return JSON.parse(fs.readFileSync(sortie, 'utf8')) as { matchs: number; variantes: Record<string, Pronostic[]>; actifs?: Record<string, number[]> };
}

// ── 7. L'HISTORIQUE, NUIT APRÈS NUIT ───────────────────────────────────────
type EntreeHistorique = {
  nuit: string;
  variante: string;
  libelle: string;
  env: Record<string, string>;
  couche?: Couche;
  gagne: boolean;
  champion: [Mesure, Mesure];
  challenger: [Mesure, Mesure];
};
function lireHistorique(): EntreeHistorique[] {
  if (!fs.existsSync(FICHIER_HISTORIQUE)) return [];
  return fs
    .readFileSync(FICHIER_HISTORIQUE, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as EntreeHistorique[];
}
function ecrireHistorique(liste: EntreeHistorique[]): void {
  fs.writeFileSync(FICHIER_HISTORIQUE, liste.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

// ── LA NUIT ────────────────────────────────────────────────────────────────
async function principal(): Promise<any> {
  ligne(`# Challenger de nuit — ${NUIT}`);
  ligne('');
  ligne('_Il mesure, il compare, il propose. Il ne met jamais rien en ligne tout seul._');
  ligne('');

  await sante();

  ligne('## 2. Les données');
  ligne('');
  const { rafraichirDonnees } = await import('./donnees.mjs');
  const d = await rafraichirDonnees();
  ligne(`- ${d.rencontres} rencontres terminées, dont ${d.tirs} avec leurs tirs ; ${d.fichesLues} fiche(s) de tirs lue(s) cette nuit.`);
  ligne('');

  // ── LA HIÉRARCHIE DES CHAMPIONNATS, QUE LA PRODUCTION N'ATTEINT JAMAIS ──
  //
  // Elle dit ce que vaut un championnat face à un autre, et sert aux matchs
  // de coupe d'Europe. Son calcul lit près de deux cents pages et dure deux
  // minutes : il ne tient pas dans les soixante secondes que l'hébergeur
  // accorde à une fonction, et il est la QUATRIÈME étape de la tâche de
  // minuit — jamais atteinte. Constaté le 12 septembre 2026 : dix-neuf jours
  // sans recalcul.
  //
  // Cet ordinateur n'a pas de limite de temps : le calcul se fait ici. La
  // fraîcheur est décidée par `recalculerForcesChampionnats` lui-même — une
  // semaine —, aucun réglage n'est touché. Les demandes partent une par une,
  // la clé du fournisseur étant partagée avec les abonnés. Un échec ici ne
  // doit jamais faire tomber la journée.
  ligne('## 2 bis. La hiérarchie des championnats');
  ligne('');
  try {
    const { lireForcesChampionnats, recalculerForcesChampionnats } = await import('../../src/lib/forces-championnats.js');
    const avant = await lireForcesChampionnats();
    const debutHierarchie = Date.now();
    const neuve = await recalculerForcesChampionnats();
    const jours = (quand: string) => Math.round((Date.now() - Date.parse(quand)) / 86_400_000);
    if (!neuve) {
      ligne('- Aucune hiérarchie disponible : le calcul n’a rien rendu.');
    } else if (avant && avant.calculeLe === neuve.calculeLe) {
      ligne(`- Calculée il y a ${jours(neuve.calculeLe)} jour(s), sur ${neuve.matchsUtilises} matchs : conservée (elle ne bouge pas en une semaine).`);
    } else {
      ligne(
        `- **Recalculée** en ${Math.round((Date.now() - debutHierarchie) / 1000)} s : ` +
          `${Object.keys(neuve.coefficients ?? {}).length} championnats, ${neuve.matchsUtilises} matchs, ` +
          `${neuve.confrontations} confrontation(s) entre championnats.` +
          (avant ? ` La précédente datait du ${String(avant.calculeLe).slice(0, 10)}.` : '')
      );
    }
  } catch (e: any) {
    ligne(`- Recalcul impossible aujourd’hui : ${e?.message ?? String(e)}`);
  }
  ligne('');

  const params = champion();
  const variantes = couchesAEssayer();
  ligne('## 3. Le moteur actuel (le champion)');
  ligne('');
  for (const p of params) ligne(`- ${p.nom} : **${p.valeur}**`);
  ligne('');

  // Le moteur actuel et chaque couche candidate, dans un même processus :
  // une couche se pose par-dessus le calcul, elle ne change aucun réglage.
  const resultats: Record<string, Pronostic[]> = {};
  const evaluation = evaluer('champion', {}, [
    { nom: 'champion', env: {} },
    ...variantes.map((v) => ({ nom: v.nom, env: {}, couche: v.couche })),
  ]);
  Object.assign(resultats, evaluation.variantes);
  // Une couche qui n'agit que sur une partie des matchs — le marché n'est
  // coté que sur certains — est jugée sur CES matchs-là seulement.
  const actifs: Record<string, number[]> = evaluation.actifs ?? {};

  const champ = resultats.champion;
  if (!champ?.length) throw new Error('aucun match évaluable');
  const [m1, m2] = moities(champ);
  const decoupe: [Set<number>, Set<number>] = [new Set(m1.map((p) => p.id)), new Set(m2.map((p) => p.id))];
  const parMoities = (l: Pronostic[]): [Mesure, Mesure] => [
    mesurer(l.filter((p) => decoupe[0].has(p.id))),
    mesurer(l.filter((p) => decoupe[1].has(p.id))),
  ];
  const mc = parMoities(champ);

  ligne(
    `Rejoué sur **${champ.length} matchs**, du ${m1[0]?.date.slice(0, 10)} au ${m2[m2.length - 1]?.date.slice(0, 10)}, ` +
      'chacun avec seulement ce qui était connu la veille :'
  );
  ligne('');
  ligne('| Compétition | Matchs | Vainqueur juste | Quand il est sûr de lui (≥ 60 %) |');
  ligne('|---|---|---|---|');
  for (const [id, nom] of Object.entries({ ...GRANDS, ...COUPES_SUIVIES })) {
    const m = mesurer(champ.filter((p) => p.ligue === Number(id)));
    if (m.n) ligne(`| ${nom} | ${m.n} | ${pc(m.justes, m.n)} | ${pc(m.sursJustes, m.surs)} sur ${m.surs} |`);
  }
  const ensemble = mesurer(champ);
  ligne(
    `| **Ensemble** | **${ensemble.n}** | **${pc(ensemble.justes, ensemble.n)}** | ` +
      `**${pc(ensemble.sursJustes, ensemble.surs)} sur ${ensemble.surs}** |`
  );
  ligne('');

  ligne('## 4. Les couches essayées cette nuit');
  ligne('');
  ligne('| Couche | 1re moitié | 2e moitié | Verdict |');
  ligne('|---|---|---|---|');
  const historique = lireHistorique().filter((h) => h.nuit !== NUIT);
  const cetteNuit: EntreeHistorique[] = [];
  for (const v of variantes) {
    const l = resultats[v.nom];
    if (!l) {
      ligne(`| ${v.libelle} | — | — | évaluation absente |`);
      continue;
    }
    let mcV = mc;
    let mv = parMoities(l);
    let libelle = v.libelle;
    const ids = actifs[v.nom];
    if (ids) {
      const ensemble = new Set(ids);
      const sousChamp = champ.filter((p) => ensemble.has(p.id));
      const [a1, a2] = moities(sousChamp);
      const coupe: [Set<number>, Set<number>] = [new Set(a1.map((p) => p.id)), new Set(a2.map((p) => p.id))];
      const sousMoities = (x: Pronostic[]): [Mesure, Mesure] => [
        mesurer(x.filter((p) => coupe[0].has(p.id))),
        mesurer(x.filter((p) => coupe[1].has(p.id))),
      ];
      mcV = sousMoities(sousChamp);
      mv = sousMoities(l.filter((p) => ensemble.has(p.id)));
      libelle = `${v.libelle} — sur ${ids.length} matchs cotés`;
    }
    const ve = verdict(mcV, mv);
    const cellule = (k: 0 | 1) => {
      const e = mv[k].justes - mcV[k].justes;
      return `${e >= 0 ? '+' : ''}${e} juste(s), Brier ${mv[k].brier.toFixed(4)}`;
    };
    ligne(`| ${libelle} | ${cellule(0)} | ${cellule(1)} | ${ve.gagne ? '✅ gagne' : '— ' + ve.raisons[0]} |`);
    cetteNuit.push({ nuit: NUIT, variante: v.nom, libelle, env: {}, couche: v.couche, gagne: ve.gagne, champion: mcV, challenger: mv });
  }
  ligne('');
  const toutes = [...historique, ...cetteNuit];
  ecrireHistorique(toutes);

  // ── LE BANC ÉLARGI ─────────────────────────────────────────────────────
  //
  // La couche du marché n'agit que sur les matchs COTÉS, et le périmètre du
  // produit n'en compte que 188 sur les 1 035 rangés : la porte refusait
  // faute de matchs, pas faute de résultats. Ici les MÊMES couches sont
  // rejouées sur toutes les rencontres cotées, quelle que soit la
  // compétition.
  //
  // Section d'INFORMATION : aucune proposition n'en sort, et l'épreuve
  // officielle ci-dessus n'est pas touchée. Un échec ici ne doit jamais
  // faire tomber la journée.
  ligne('## 4 bis. Le banc élargi — toutes les compétitions cotées');
  ligne('');
  try {
    const large = evaluer(
      'elargi',
      {},
      [{ nom: 'champion', env: {} }, ...variantes.map((v) => ({ nom: v.nom, env: {}, couche: v.couche }))],
      'cotes'
    );
    const base = large.variantes.champion ?? [];
    if (base.length < 2) throw new Error('aucune rencontre cotée évaluable');
    const [l1, l2] = moities(base);
    const coupe: [Set<number>, Set<number>] = [new Set(l1.map((p) => p.id)), new Set(l2.map((p) => p.id))];
    const parMoitiesLarge = (x: Pronostic[]): [Mesure, Mesure] => [
      mesurer(x.filter((p) => coupe[0].has(p.id))),
      mesurer(x.filter((p) => coupe[1].has(p.id))),
    ];
    const mcLarge = parMoitiesLarge(base);
    const tout = mesurer(base);
    ligne(
      `Rejoué sur **${base.length} rencontres cotées** de toutes compétitions, du ${l1[0]?.date.slice(0, 10)} au ${l2[l2.length - 1]?.date.slice(0, 10)} : ` +
        `le moteur actuel trouve **${pc(tout.justes, tout.n)}** de bons vainqueurs, **${pc(tout.sursJustes, tout.surs)}** quand il est sûr de lui (${tout.surs} matchs).`
    );
    ligne('');
    ligne('| Couche | 1re moitié | 2e moitié | Verdict (information) |');
    ligne('|---|---|---|---|');
    for (const v of variantes) {
      const l = large.variantes[v.nom];
      if (!l) {
        ligne(`| ${v.libelle} | — | — | évaluation absente |`);
        continue;
      }
      const mv = parMoitiesLarge(l);
      const ve = verdict(mcLarge, mv);
      const cellule = (k: 0 | 1) => {
        const e = mv[k].justes - mcLarge[k].justes;
        return `${e >= 0 ? '+' : ''}${e} juste(s), Brier ${mv[k].brier.toFixed(4)}`;
      };
      ligne(`| ${v.libelle} | ${cellule(0)} | ${cellule(1)} | ${ve.gagne ? '✅ gagne' : '— ' + ve.raisons[0]} |`);
    }
    ligne('');
    ligne('_Cette section informe, elle ne propose rien : brancher une couche reste soumis à l’épreuve officielle et à la décision du propriétaire._');
  } catch (e: any) {
    ligne(`Banc élargi indisponible aujourd’hui : ${e?.message ?? String(e)}`);
  }
  ligne('');

  // ── LA PÉRIODE RÉCENTE, QUI N'A JAMAIS SERVI À RÉGLER LE MOTEUR ─────────
  //
  // Constat du 12 septembre 2026 : les SEPT familles de couches essayées
  // perdent sur la première moitié (févr.-juin) et gagnent sur la seconde.
  // Ce n'est pas un hasard : les réglages actuels ont été choisis sur des
  // données qui couvrent cette première période, elle leur est favorable.
  //
  // Cette section rejuge donc les MÊMES essais sur les quatre-vingt-dix
  // derniers jours seulement, coupés en deux moitiés comme ailleurs. Elle
  // INFORME : la porte officielle, au-dessus, ne bouge pas, et aucune
  // proposition ne sort d'ici. Tant que chaque moitié n'atteint pas cent
  // cinquante matchs, le verdict dira « il en faut 150 » — c'est normal, la
  // matière arrive.
  const SEUIL_RECENT = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  ligne(`## 4 ter. Sur la période récente (depuis le ${SEUIL_RECENT})`);
  ligne('');
  try {
    const recents = (l: Pronostic[]) => l.filter((p) => p.date.slice(0, 10) >= SEUIL_RECENT);
    const baseRecente = recents(champ);
    if (baseRecente.length < 4) throw new Error('trop peu de matchs récents');
    const [r1, r2] = moities(baseRecente);
    const coupeR: [Set<number>, Set<number>] = [new Set(r1.map((p) => p.id)), new Set(r2.map((p) => p.id))];
    const parMoitiesRecentes = (x: Pronostic[]): [Mesure, Mesure] => [
      mesurer(x.filter((p) => coupeR[0].has(p.id))),
      mesurer(x.filter((p) => coupeR[1].has(p.id))),
    ];
    const mcR = parMoitiesRecentes(baseRecente);
    const toutR = mesurer(baseRecente);
    ligne(
      `Sur **${baseRecente.length} matchs** : le moteur actuel trouve **${pc(toutR.justes, toutR.n)}** de bons vainqueurs, ` +
        `**${pc(toutR.sursJustes, toutR.surs)}** quand il est sûr de lui (${toutR.surs} matchs). ` +
        `Il faut ${150 * 2} matchs pour que cette section puisse conclure ; il y en a ${baseRecente.length}.`
    );
    ligne('');
    ligne('| Couche | 1re moitié | 2e moitié | Verdict (information) |');
    ligne('|---|---|---|---|');
    for (const v of variantes) {
      const l = resultats[v.nom];
      if (!l) continue;
      const mvR = parMoitiesRecentes(recents(l));
      const veR = verdict(mcR, mvR);
      const cellule = (k: 0 | 1) => {
        const e = mvR[k].justes - mcR[k].justes;
        return `${e >= 0 ? '+' : ''}${e} juste(s), Brier ${mvR[k].brier.toFixed(4)}`;
      };
      ligne(`| ${v.libelle} | ${cellule(0)} | ${cellule(1)} | ${veR.gagne ? '✅ gagne' : '— ' + veR.raisons[0]} |`);
    }
    ligne('');
    ligne('_Section d’information : la porte officielle reste celle de la partie 4._');
  } catch (e: any) {
    ligne(`Période récente indisponible aujourd’hui : ${e?.message ?? String(e)}`);
  }
  ligne('');

  ligne('## 5. Proposition');
  ligne('');
  const gain = (e: EntreeHistorique) =>
    e.challenger[0].justes - e.champion[0].justes + e.challenger[1].justes - e.champion[1].justes;
  const candidates = cetteNuit.filter((e) => e.gagne && aProposer(toutes, e.variante)).sort((a, b) => gain(b) - gain(a));
  if (!candidates.length) {
    const gagnantes = cetteNuit.filter((e) => e.gagne);
    if (fs.existsSync(FICHIER_PROPOSITION)) fs.rmSync(FICHIER_PROPOSITION);
    ligne(
      gagnantes.length
        ? `Pas encore de proposition : ${gagnantes.map((g) => g.libelle).join(' ; ')} a gagné cette nuit, il faut le confirmer une nuit de plus.`
        : 'Aucune couche ne bat le moteur actuel aujourd’hui. Le moteur reste tel quel — c’est le résultat attendu la plupart des nuits.'
    );
    ligne('');
    return null;
  }
  const meilleure = candidates[0];
  const proposition = {
    nuit: NUIT,
    variante: meilleure.variante,
    libelle: meilleure.libelle,
    env: meilleure.env,
    couche: meilleure.couche,
    gain: gain(meilleure),
    preuves: { champion: meilleure.champion, challenger: meilleure.challenger },
  };
  fs.writeFileSync(FICHIER_PROPOSITION, JSON.stringify(proposition, null, 2));
  ligne(
    `**${meilleure.libelle}** — bat le moteur actuel dans les deux moitiés, sur plusieurs nuits ` +
      `(${proposition.gain >= 0 ? '+' : ''}${proposition.gain} vainqueurs justes cette nuit).`
  );
  ligne('');
  ligne('À valider en session de travail : la couche est branchée en production avec ce réglage, les garanties ★ ACQUIS repassent, puis mise en ligne. Aucun réglage existant ne change.');
  ligne('');
  return proposition;
}

const debut = Date.now();
let proposition: any = null;
let erreur: string | null = null;
try {
  proposition = await principal();
} catch (e: any) {
  erreur = e?.message ?? String(e);
  ligne('');
  ligne('## ⚠️ La nuit s’est arrêtée');
  ligne('');
  ligne('```');
  ligne(String(erreur));
  ligne('```');
}
ligne(`_Durée : ${Math.round((Date.now() - debut) / 60_000)} min._`);

const texte = rapport.join('\n');
fs.writeFileSync(path.join(DOSSIER_RAPPORTS, `${NUIT}.md`), texte);
try {
  const { ecrireReserve } = await import('../../src/lib/api-football.js');
  await ecrireReserve('challenger:dernier-rapport', { nuit: NUIT, texte, proposition, erreur }, 30 * 86_400_000);
} catch (e: any) {
  journal('rapport non publié dans la réserve : ' + e?.message);
}
journal(erreur ? `nuit terminée en échec : ${erreur}` : 'nuit terminée');
process.exit(erreur ? 1 : 0);
