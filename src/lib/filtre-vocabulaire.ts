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
const REMPLACEMENTS: [RegExp, string][] = [
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
  [/\bbookmaker(s)?\b/gi, 'marché'],
  [/\bodds\b/gi, 'probabilités'],
  [/\bcotes\b(?!\s*d['’\s]?\s*ivoire)/gi, 'probabilités'],
  [/\bcote\b(?!\s*d['’\s]?\s*ivoire)/gi, 'probabilité'],
];

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
    sortie = sortie.replace(new RegExp(motif.source, motif.flags), par);
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
