/**
 * LE DERNIER FILET AVANT L'ABONNÉ.
 *
 * ── POURQUOI UNE CONSIGNE NE SUFFIT PAS ───────────────────────────────────
 *
 * Le prompt de l'Agent VIP interdit nommément une liste de mots, « même dans
 * une citation, même pour dire que tu ne peux pas en parler ». Le 25 août
 * 2026, interrogé sur les paris, l'agent a répondu :
 *
 *     « chez ProFoot, on parle analyse, pas paris »
 *
 * L'intention était bonne — il refusait. Il a quand même écrit le mot. Une
 * consigne oriente un modèle ; elle ne le contraint pas. Or la plateforme de
 * paiement nous vérifie pour « vente de produits interdits (paris sportifs) » :
 * il ne s'agit pas de réduire la fréquence du mot, il s'agit qu'il n'en sorte
 * aucun.
 *
 * C'est exactement le raisonnement qui a produit le filtre de l'aperçu
 * gratuit. Celui-ci en est le pendant pour l'agent.
 *
 * ── TROIS ÉTAGES, DU PLUS FIN AU PLUS BRUTAL ──────────────────────────────
 *
 * L'appelant les emprunte dans l'ordre :
 *
 *   1. RÉÉCRITURE PAR LE MODÈLE — il connaît le sens de sa phrase, lui seul
 *      peut la reformuler sans l'abîmer. Un seul aller-retour, et seulement
 *      si le temps restant le permet : Vercel coupe à 60 s.
 *
 *   2. RETRAIT DE LA PHRASE FAUTIVE — en pratique, une phrase sur dix est en
 *      cause. La retirer laisse une réponse entière et lisible.
 *
 *   3. REMPLACEMENT MOT À MOT — le filet de sécurité. Le français y perd
 *      parfois en élégance, mais la garantie est absolue : la fonction ne rend
 *      JAMAIS un texte contenant un mot de la liste.
 *
 * ── CE QUI N'EST PAS FILTRÉ ───────────────────────────────────────────────
 *
 * « Paris Saint-Germain » est un club, « Paris » une ville, « la mise en
 * page » du français courant, « la côte » un littoral. Les motifs ci-dessous
 * les épargnent explicitement — un filtre qui mutile les noms de clubs serait
 * pire que le mal.
 */

/**
 * Les mots qui ne doivent jamais atteindre un abonné.
 *
 * Chaque entrée porte son remplacement de dernier recours. L'ordre compte :
 * les formes longues d'abord, sinon « pari » consommerait « parier ».
 */
type Remplacement = string | ((...args: any[]) => string);
const REMPLACEMENTS: [RegExp, Remplacement][] = [
  // ── Pronostic ────────────────────────────────────────────────────────────
  [/\bpronostiqueur(s)?\b/gi, 'analyste$1'],
  [/\bpronostiquer\b/gi, 'analyser'],
  [/\bpronostiqu(é|ée|és|ées)\b/gi, 'analys$1'],
  [/\bpronostics\b/gi, 'analyses'],
  [/\bpronostic\b/gi, 'analyse'],
  [/\bpronos\b/gi, 'analyses'],
  [/\bprono\b/gi, 'analyse'],

  // ── Pari ─────────────────────────────────────────────────────────────────
  //
  // « Paris Saint-Germain » et la ville sont protégés par la négative :
  // `paris` n'est remplacé que suivi de « sportif », ou précédé d'un
  // déterminant qui en fait un nom commun (« les paris », « de paris »).
  // Le remplacement ne doit pas réintroduire ce qu'il est censé chasser :
  // « jeux d'argent » appartient à la même famille interdite. On reste dans le
  // vocabulaire de l'analyse, quitte à ce que la phrase perde son sens — ce
  // filet ne se déclenche que si les deux étages précédents ont échoué.
  [/\bparis\s+sportifs?\b/gi, 'analyses sportives'],
  [/\bparieur(s|se|ses)?\b/gi, 'passionné$1'],
  [/\bpari(er|ez|ons|erai|erais|era|eront)\b/gi, 'se positionner'],
  [/\bpari(é|ée|és|ées)\b/gi, 'analysé$1'],

  // ── LA FORMULATION RÉELLEMENT OBSERVÉE ─────────────────────────────────
  //
  // « chez ProFoot, on parle analyse, pas paris » — la réponse du 25 août
  // 2026. L'intention était juste, le mot était là quand même. Traitée avant
  // les règles générales, parce qu'elle demande une tournure, pas un mot :
  // « pas analyses » ne voudrait rien dire.
  [/\bpas\s+(?:de\s+)?paris\b/gi, 'rien de tout cela'],

  // ── LE NOM COMMUN, DISTINGUÉ DU CLUB ET DE LA VILLE ────────────────────
  //
  // C'est la CASSE qui les sépare, et elle seule. « Paris Saint-Germain » et
  // « le match se joue à Paris » portent une majuscule ; « les paris », « pas
  // paris » n'en portent pas. Ce motif est donc le seul de tout le fichier à
  // être sensible à la casse — sans quoi il faudrait choisir entre laisser
  // passer le mot et mutiler le nom d'un club.
  [/(\b(?:les|des|aux|de|du|nos|vos|leurs|ces|sur)\s+)paris\b/g, '$1analyses'],
  [/\bparis\b/g, 'analyses'],
  // « un pari » deviendrait « un analyse ». On garde le genre en passant par
  // « choix », qui est neutre et se substitue sans accroc.
  [/\b(un|le|ce|mon|ton|son)\s+pari\b/gi, '$1 choix'],
  [/\bpari\b/gi, 'analyse'],

  // ── Mise et argent ───────────────────────────────────────────────────────
  //
  // `mise` seul n'est PAS visé : « mise en page », « mise à jour », « mise en
  // avant » sont du français courant et abondent dans l'application.
  [/\bmis(er|ez|ons|erai|erais|era|eront)\b/gi, 'compter'],
  [/\bcoupon(s)?\b/gi, 'sélection$1'],
  [/\bticket(s)?\s+de\s+jeu\b/gi, 'sélection$1'],
  [/\bbanco\b/gi, 'certitude'],
  [/\bvalue\s*bets?\b/gi, 'occasion'],
  [/\bjackpot(s)?\b/gi, 'gros lot$1'],

  // ── Cotes et bookmakers ──────────────────────────────────────────────────
  //
  // « la côte » accentuée et « côté » ne s'écrivent pas ainsi : ils ne sont
  // pas atteints. « Cote d'Ivoire » est protégé par la négative.
  // ── LES MARCHÉS ÉCRITS EN FRANÇAIS COURANT ─────────────────────────────
  //
  // Le 25 août 2026, l'agent a produit une réponse SANS aucun mot interdit —
  // et qui contenait trois marchés de paris en clair :
  //
  //     « Betis ne perd pas, et moins de 2,5 buts au total »
  //     « Bodo se qualifie sans trembler, quasi certain »
  //
  // Un contrôleur reconnaît « moins de 2,5 buts » plus vite que le mot
  // « pari » : aucun match ne finit sur un demi-but. Ce demi-point n'existe
  // que sur une grille de paris. Traquer des mots ne suffisait pas — il faut
  // traquer les FORMES.
  //
  // ── CE QUI EST ÉPARGNÉ, ET C'EST ESSENTIEL ─────────────────────────────
  //
  // « 2,54 buts attendus » est une espérance calculée (xG), le cœur du
  // moteur. « Probabilités sur le nombre de buts » est un intitulé d'écran.
  // Ni l'un ni l'autre n'est un seuil. Le motif exige donc les DEUX marques
  // du pari réunies : « plus de » ou « moins de », ET un seuil en X,5 non
  // suivi d'un autre chiffre. « 2,54 » ne peut pas correspondre.
  // Le SENS vient de « plus » ou « moins », jamais du seuil : « plus de 3,5 »
  // annonce beaucoup de buts, pas peu. Une première version lisait le nombre
  // et inversait la phrase.
  [/\b(plus|moins)\s+d[eu]\s+\d+[.,]5(?!\d)\s*buts?\b/gi, (_m: string, sens: string) =>
    sens.toLowerCase() === 'moins' ? 'peu de buts' : 'beaucoup de buts'],
  [/\b(?:over|under)\s*\d+[.,]5(?!\d)\b/gi, 'nombre de buts'],

  // Double chance dite en clair. « ne perd pas souvent », « ne perd jamais »
  // sont des constats statistiques : la négative les épargne.
  [/\bne\s+perd\s+pas\b(?!\s+(?:souvent|jamais|beaucoup|toujours|en|de|depuis))/gi, "conserve l'avantage"],
  [/\bne\s+perdra\s+pas\b/gi, "conservera l'avantage"],

  // Promesses de certitude. On retire la GARANTIE, jamais la conclusion :
  // « très probable » et « largement favori » restent permis et encouragés.
  [/\bquasi\s+certain(e|s|es)?\b/gi, 'très probable'],
  [/\bsans\s+trembler\b/gi, 'avec autorité'],
  [/\bsans\s+risque\b/gi, 'avec une marge confortable'],
  // Pas de `\b` devant « à » : en JavaScript, `\w` ne connaît que l'ASCII, et
  // il n'y a donc aucune frontière de mot entre une espace et un « à ». Le
  // motif ne se déclenchait jamais.
  [/(?:à\s+)?\bcoup\s+s[ûu]r\b/gi, 'selon toute probabilité'],
  // « garanti » n'est visé QUE dans une promesse de résultat. Une phrase qui
  // NIE la garantie — « aucun résultat n'est garanti » — nous protège : la
  // remplacer inverserait son sens.
  [/\b(victoire|succès|résultat|qualification|gain)s?\s+garantie?s?\b/gi, '$1 très probable'],
  [/\bc'est\s+garanti\b/gi, "c'est très probable"],

  [/\bbookmaker(s)?\b/gi, 'marché'],
  [/\bodds\b/gi, 'probabilités'],
  [/\bcotes\b(?!\s*d['’\s]?\s*ivoire)/gi, 'probabilités'],
  [/\bcote\b(?!\s*d['’\s]?\s*ivoire)/gi, 'probabilité'],
];

/**
 * LA PROPOSITION DE SERVICE EN FIN DE RÉPONSE.
 *
 * ── POURQUOI ELLE EST TRAITÉE À PART ──────────────────────────────────────
 *
 * Ce n'est pas un problème de conformité — aucun mot de pari n'y figure — mais
 * de produit. L'agent est vendu comme un analyste qui tranche ; terminer par
 * « Si tu veux que je creuse, dis-moi laquelle » le ramène au niveau d'un
 * formulaire, et laisse l'abonné sans la conclusion qu'il a payée.
 *
 * Le prompt l'interdit nommément depuis le 25 août 2026. Le même jour, l'agent
 * a fini DEUX réponses de suite par « Tu veux que je décortique l'une de ces
 * affiches ? » et « Si tu veux que je creuse une de ces trois-là ». Deux
 * consignes enfreintes coup sur coup : on ne s'en remet plus à la consigne.
 *
 * ── POURQUOI SEULEMENT LA FIN ─────────────────────────────────────────────
 *
 * « Si tu veux » en milieu de texte peut être légitime : « si tu veux mon
 * avis, City passe ». C'est la CLÔTURE par une offre qui pose problème. On ne
 * regarde donc que les dernières phrases, et on les retire — le reste de la
 * réponse, lui, n'est jamais touché.
 */
const OFFRES_DE_SERVICE =
  /^(?:si tu veux|tu veux que|veux-tu que|dis-moi (?:laquelle|lequel|si|quel)|n'hésite pas|je peux (?:te )?(?:creuser|décortiquer|détailler|sortir)|je te (?:sors|fais|donne) (?:les chiffres|une analyse)|on (?:commence|attaque) quand)/i;

/**
 * Retire la ou les phrases finales qui proposent un service.
 *
 * Ne touche jamais au corps de la réponse, et renonce si l'opération laissait
 * moins de la moitié du texte : mieux vaut une offre de trop qu'une réponse
 * vidée.
 */
export function retirerOffreFinale(texte: string): string {
  const source = String(texte ?? '');
  const phrases = source.split(/(?<=[.!?…])\s+|\n+/).filter((p) => p.trim());
  if (phrases.length < 2) return source;

  let fin = phrases.length;
  // On remonte depuis la fin tant que la phrase est une offre : l'agent en
  // enchaîne parfois deux (« Tu veux que je décortique ? Je te sors les
  // chiffres. »).
  while (fin > 1 && OFFRES_DE_SERVICE.test(phrases[fin - 1].trim())) fin--;
  if (fin === phrases.length) return source;

  const garde = phrases.slice(0, fin).join(' ').replace(/[ \t]+/g, ' ').trim();
  return garde.length >= source.length * 0.5 ? garde : source;
}

/**
 * Détection seule — sans rien modifier.
 *
 * Sert à décider s'il faut agir, et à écrire dans le journal ce qui a été
 * attrapé. Le même jeu de motifs que les remplacements : ce qui est remplacé
 * est exactement ce qui est détecté, jamais plus, jamais moins.
 */
export function motsInterdits(texte: string): string[] {
  const trouves = new Set<string>();
  for (const [motif] of REMPLACEMENTS) {
    const m = String(texte ?? '').match(new RegExp(motif.source, motif.flags));
    if (m) for (const mot of m) trouves.add(mot.toLowerCase());
  }
  return [...trouves];
}

/** Le texte contient-il un mot de la liste ? */
export function contientVocabulaireInterdit(texte: string): boolean {
  return motsInterdits(texte).length > 0;
}

/**
 * ÉTAGE 2 — retirer les phrases fautives.
 *
 * Renvoie `null` quand l'opération viderait la réponse : mieux vaut passer à
 * l'étage suivant que rendre trois mots à quelqu'un qui a payé.
 */
export function retirerPhrasesFautives(texte: string): string | null {
  const source = String(texte ?? '');
  // Découpe sur la ponctuation forte ET sur les retours à la ligne : l'agent
  // écrit en paragraphes, et une puce entière peut être en cause.
  const morceaux = source.split(/(?<=[.!?…])\s+|\n+/);
  const propres = morceaux.filter((p) => p.trim() && !contientVocabulaireInterdit(p));

  if (!propres.length) return null;

  const recompose = propres.join(' ').replace(/\s+/g, ' ').trim();

  // Une réponse amputée de plus de la moitié n'est plus la réponse promise.
  if (recompose.length < 120 || recompose.length < source.length * 0.5) return null;

  return recompose;
}

/**
 * ÉTAGE 3 — le filet qui ne cède jamais.
 *
 * Remplace mot à mot. Le résultat est parfois moins élégant, mais il est
 * TOUJOURS propre : c'est la seule garantie qui ne dépende ni du modèle, ni du
 * temps restant, ni du hasard.
 */
export function remplacerVocabulaire(texte: string): string {
  let sortie = String(texte ?? '');
  for (const [motif, par] of REMPLACEMENTS) {
    sortie = sortie.replace(new RegExp(motif.source, motif.flags), par as any);
  }
  return sortie;
}

/**
 * La sortie garantie, sans passer par le modèle.
 *
 * Essaie le retrait de phrase, retombe sur le remplacement, et vérifie le
 * résultat avant de le rendre. Si un mot survivait aux deux étages — un cas
 * qui ne devrait pas exister — on applique le remplacement une seconde fois
 * plutôt que de laisser sortir quoi que ce soit.
 */
export function assainir(texte: string): { texte: string; methode: 'intact' | 'phrase' | 'mot' } {
  if (!contientVocabulaireInterdit(texte)) return { texte: String(texte ?? ''), methode: 'intact' };

  const parPhrase = retirerPhrasesFautives(texte);
  if (parPhrase && !contientVocabulaireInterdit(parPhrase)) {
    return { texte: parPhrase, methode: 'phrase' };
  }

  let parMot = remplacerVocabulaire(texte);
  if (contientVocabulaireInterdit(parMot)) parMot = remplacerVocabulaire(parMot);
  return { texte: parMot, methode: 'mot' };
}

/**
 * La consigne de réécriture envoyée au modèle — ÉTAGE 1.
 *
 * Volontairement étroite : on lui demande la MÊME réponse, pas une nouvelle.
 * Un modèle à qui l'on dit « recommence » produit autre chose, et l'abonné
 * perdrait l'analyse qu'il attendait.
 */
export function consigneDeReecriture(fautifs: string[]): string {
  return [
    `Ta réponse contient des mots interdits : ${fautifs.join(', ')}.`,
    '',
    "Réécris-la À L'IDENTIQUE en les remplaçant par le vocabulaire de l'analyse :",
    "« analyse », « issue la plus probable », « probabilité », « tendance », « passionné ».",
    '',
    "Ne change RIEN d'autre : ni le fond, ni les chiffres, ni la conclusion, ni la longueur.",
    "Ne mentionne pas cette correction. Ne t'excuse pas. Rends uniquement le texte corrigé.",
  ].join('\n');
}
