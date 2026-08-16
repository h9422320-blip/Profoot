/**
 * Noms français des clubs européens.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Un utilisateur francophone tape « Bâle ». Le club s'appelle « FC Basel 1893 »
 * chez le fournisseur de données, et sa recherche ne renvoie RIEN sur « bale » —
 * vérifié : zéro résultat pertinent. Le club existe, l'analyse fonctionne, mais
 * la personne ne peut pas l'atteindre. Elle en conclut que l'application ne
 * connaît pas son match.
 *
 * Ce n'est pas un problème d'orthographe approximative : « Bâle » et « Basel »
 * sont deux mots différents. Aucune tolérance aux fautes de frappe ne les
 * rapproche. Il faut la traduction.
 *
 * COMMENT LIRE CE TABLEAU
 *
 * À gauche, ce que l'utilisateur tape (sans accent, en minuscules — la
 * comparaison est normalisée). À droite, ce qu'il faut chercher chez le
 * fournisseur. Une entrée peut viser plusieurs clubs : « milan » doit proposer
 * l'AC Milan ET l'Inter, à l'utilisateur de choisir.
 */

/** Ce que l'utilisateur tape → ce qu'il faut chercher réellement. */
export const NOMS_FR: Record<string, string[]> = {
  // ── Villes dont le nom français diffère de l'officiel ────────────────────
  bale: ['Basel'],
  // Chaque cible ci-dessous a été vérifiée contre le nom réel du fournisseur.
  // Écrites de mémoire, « Bayern Munich » et « Red Star Belgrade » ne
  // renvoyaient RIEN : les vrais noms sont « Bayern München » et « Crvena
  // Zvezda ». Une traduction fausse est aussi inutile qu'une traduction absente.
  munich: ['Bayern München', '1860 München'],
  cologne: ['Koln'],
  brême: ['Werder Bremen'],
  breme: ['Werder Bremen'],
  hambourg: ['Hamburger SV'],
  francfort: ['Eintracht Frankfurt'],
  leverkusen: ['Bayer Leverkusen'],
  mönchengladbach: ['Borussia Monchengladbach'],
  monchengladbach: ['Borussia Monchengladbach'],
  seville: ['Sevilla', 'Real Betis'],
  saragosse: ['Zaragoza'],
  'la corogne': ['Deportivo La Coruna'],
  corogne: ['Deportivo La Coruna'],
  'saint sebastien': ['Real Sociedad'],
  bilbao: ['Athletic Club'],
  'athletic bilbao': ['Athletic Club'],
  genes: ['Genoa'],
  gênes: ['Genoa'],
  turin: ['Juventus', 'Torino'],
  naples: ['Napoli'],
  rome: ['AS Roma', 'Lazio'],
  florence: ['Fiorentina'],
  venise: ['Venezia'],
  milan: ['AC Milan', 'Inter'],
  'milan ac': ['AC Milan'],
  inter: ['Inter'],
  lisbonne: ['Sporting CP', 'Benfica'],
  porto: ['FC Porto'],
  anvers: ['Antwerp'],
  bruges: ['Club Brugge', 'Cercle Brugge'],
  gand: ['Gent'],
  louvain: ['OH Leuven'],
  copenhague: ['FC Copenhagen'],
  vienne: ['Rapid Vienna', 'Austria Vienna'],
  prague: ['Slavia Praha', 'Sparta Praha'],
  varsovie: ['Legia Warszawa'],
  moscou: ['Spartak Moscow', 'CSKA Moscow'],
  kiev: ['Dynamo Kyiv'],
  belgrade: ['Crvena Zvezda', 'Partizan'],
  zagreb: ['Dinamo Zagreb'],
  athenes: ['Olympiakos', 'Panathinaikos', 'AEK Athens'],
  athènes: ['Olympiakos', 'Panathinaikos', 'AEK Athens'],
  salonique: ['PAOK'],
  istanbul: ['Galatasaray', 'Fenerbahce', 'Besiktas'],
  eindhoven: ['PSV'],
  'la haye': ['ADO Den Haag'],
  amsterdam: ['Ajax'],
  rotterdam: ['Feyenoord', 'Sparta Rotterdam'],
  berne: ['Young Boys'],
  zurich: ['FC Zurich', 'Grasshopper'],
  geneve: ['Servette'],
  genève: ['Servette'],

  // ── Clubs désignés par leur ville ou leur surnom en français ─────────────
  barcelone: ['Barcelona'],
  barca: ['Barcelona'],
  'etoile rouge': ['Crvena Zvezda'],
  'atletico madrid': ['Atletico Madrid'],
  barça: ['Barcelona'],
  'le barça': ['Barcelona'],
  real: ['Real Madrid'],
  'la maison blanche': ['Real Madrid'],
  atletico: ['Atletico Madrid'],
  psg: ['Paris Saint Germain'],
  paris: ['Paris Saint Germain', 'Paris FC'],
  om: ['Marseille'],
  ol: ['Lyon'],
  asse: ['Saint Etienne'],
  'saint etienne': ['Saint Etienne'],
  losc: ['Lille'],
  ogc: ['Nice'],
  'man city': ['Manchester City'],
  'man utd': ['Manchester United'],
  'man united': ['Manchester United'],
  mu: ['Manchester United'],
  spurs: ['Tottenham'],
  gunners: ['Arsenal'],
  reds: ['Liverpool'],
  juve: ['Juventus'],
  'la vieille dame': ['Juventus'],
};

/**
 * Termes à chercher réellement pour ce que l'utilisateur a tapé.
 *
 * Renvoie toujours la saisie d'origine en premier : si elle donne déjà des
 * résultats, la traduction ne fait qu'en ajouter. On ne remplace jamais ce que
 * la personne a écrit, on complète.
 */
const sansAccent = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Préfixes de club sans valeur pour la recherche.
 *
 * « FC Bâle » doit trouver Bâle. Comparer la saisie entière à la clé « bale »
 * échouait, et l'utilisateur qui écrit le nom complet — le plus naturel —
 * repartait bredouille.
 */
const PREFIXES = /^(fc|ac|as|sc|rc|cf|sv|vf[lb]|ss|us|afc|ogc|losc|bsc|fk|nk|hnk)\s+/;

export function termesDeRecherche(saisie: string): string[] {
  const q = sansAccent(saisie);
  const sansPrefixe = q.replace(PREFIXES, '').trim();
  const mots = q.split(/\s+/).filter((m) => m.length >= 3);

  const termes = new Set<string>([saisie.trim()]);

  for (const [fr, officiels] of Object.entries(NOMS_FR)) {
    const cle = sansAccent(fr);
    // La clé correspond à la saisie entière, à la saisie sans son préfixe de
    // club, ou à l'un de ses mots. « bal » ne doit toujours pas déclencher
    // Bâle : on exige au moins trois lettres et un début de mot.
    const correspond =
      cle === q ||
      cle === sansPrefixe ||
      (q.length >= 3 && cle.startsWith(q)) ||
      (sansPrefixe.length >= 3 && cle.startsWith(sansPrefixe)) ||
      mots.some((m) => cle === m);

    if (correspond) officiels.forEach((o) => termes.add(o));
  }

  return [...termes];
}
