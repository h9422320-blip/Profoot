/**
 * ★ ACQUIS — LE VOCABULAIRE DU PARI NE DOIT PLUS REVENIR.
 *
 * ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────────
 *
 * Le 25 août 2026, la plateforme de paiement a signalé le site pour « vente de
 * produits interdits (paris sportifs, jeux de hasard) ». La cause n'était pas
 * le produit — c'est un moteur d'analyse statistique — mais son vocabulaire :
 * les écrans parlaient de « pronostics » et de « parieurs », et surtout
 * l'Agent VIP recevait l'instruction écrite de « terminer par un pari nommé »
 * et de dire à l'abonné « sur quoi mettre son argent ».
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Un remplacement de texte se défait tout seul. Il suffit qu'une phrase soit
 * réécrite six mois plus tard par quelqu'un qui ignore l'incident, et le
 * compte de paiement retombe. Ces tests transforment une correction ponctuelle
 * en contrainte permanente : le jour où le mot revient, la suite casse.
 *
 * ── CE QUI EST VÉRIFIÉ, ET CE QUI NE L'EST PAS ────────────────────────────
 *
 * On vérifie les INSTRUCTIONS données aux modèles et les TEXTES d'écran. On ne
 * vérifie pas les noms de fonctions internes (`verifierPronostics`), les
 * journaux serveur ni les écrans d'administration : rien de tout cela n'est vu
 * par un visiteur ni par un contrôleur de la plateforme de paiement, et les
 * renommer casserait du code sans rien protéger.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const racine = process.cwd();
const lire = (p: string) => fs.readFileSync(path.join(racine, p), 'utf8');

/**
 * Les mots interdits, tels qu'ils apparaîtraient dans une phrase française.
 *
 * « cote » n'est jamais cherché seul : « Côte d'Ivoire » est un pays. La
 * graphie accentuée « côte » et le mot « côté » ne sont pas visés du tout —
 * ils s'écrivent avec d'autres lettres.
 *
 * « mise » nu n'y figure pas : « mise en page », « mise à jour », « mise en
 * réserve » sont du français courant et truffent l'application. Seules les
 * formes verbales du jeu — miser, misez, misons — sont retenues.
 *
 * « gain », « garanti », « revenus » : voir GAINS_ET_GARANTIES plus bas, qui
 * a ses propres exceptions.
 */
const INTERDITS =
  /\b(?:pari|paris\s+sportifs?|pari(?:er|ez|ons|[eé]e?s?)|parieur(?:s|se|ses)?|pronostics?|pronostiqu\w*|pronos?\b|tipsters?|tips\b|mis(?:er|ez|ons|é\w*)|bookmakers?|coupons?|banco|value\s*bets?|jeux?\s+de\s+hasard|casinos?|loteries?|roulettes?|machines?\s+à\s+sous)\b|\bcotes?\b(?!\s*d['’\s]?\s*ivoire)|\bodds\b|\bprédi(?:ction|ctions|ctif|ctifs|ctive|ctives|re|t|ts|te|tes)\b/i;

/**
 * L'ARGENT ET LA CERTITUDE — LES DEUX PROMESSES D'UN SITE DE JEU.
 *
 * Séparés d'INTERDITS parce qu'ils demandent des exceptions que les autres
 * n'ont pas :
 *
 *   — « revenus » est le mot juste du tableau de bord financier. Il y désigne
 *     le chiffre d'affaires de l'entreprise, pas des gains de joueur. Le
 *     bannir rendrait l'administration illisible sans rien protéger : elle est
 *     derrière authentification, aucun visiteur ne la voit ;
 *
 *   — « garantir » a le droit d'exister dans une phrase qui NIE la garantie.
 *     « aucun outil ne peut garantir un résultat » nous protège ; l'interdire
 *     nous désarmerait. On ne retient donc que la promesse affirmative.
 *
 * Ces exceptions sont volontairement étroites : tout le reste est refusé.
 */
const GAINS_ET_GARANTIES =
  /\b(?:jackpots?|gagner\s+de\s+l['’]argent|mettre\s+son\s+argent|gains?\s+(?:assur|garanti|facile))\w*|\b(?:100\s*%\s*s[ûu]rs?|victoires?\s+garanties?|matchs?\s+s[ûu]rs?|sans\s+risque|coup\s+s[ûu]r)\b/i;

/**
 * Les noms de marchés de pari, cherchés en RESPECTANT LA CASSE.
 *
 * `btts` en minuscules est une clé de données que le moteur renvoie
 * (`result.predictions.btts.yes`) : la renommer casserait le contrat entre le
 * serveur et l'écran sans rien protéger, puisqu'elle n'est jamais affichée.
 * Ce qui était affiché, c'était « BTTS » en capitales, dans une phrase de
 * vente. C'est cette forme-là qu'on interdit.
 *
 * « Over » et « Under » ne sont PAS cherchés seuls : ce sont des mots anglais
 * courants, et le code en est plein (`overflow`, `hover`, `underline`). Seule
 * la paire « Over/Under », qui ne désigne qu'un marché de pari, est retenue.
 */
const MARCHES_DE_PARI =
  /\bBTTS\b|Over\s*\/\s*Under|\b1X2\b|both\s+teams\s+to\s+score/i;

// ── LES INSTRUCTIONS DONNÉES AUX MODÈLES ───────────────────────────────────

test('★ ACQUIS — l Agent VIP a l interdiction écrite du vocabulaire de pari', () => {
  const src = lire('src/lib/agent-vip.ts');

  // La liste des mots interdits doit être NOMMÉE dans le prompt. Une consigne
  // vague (« reste professionnel ») ne tient pas : c'est ce qui a échoué.
  for (const mot of ['pari', 'parier', 'bookmaker', 'cote', 'coupon']) {
    assert.ok(
      new RegExp(`ne doivent JAMAIS[\\s\\S]{0,400}\\b${mot}\\b`, 'i').test(src),
      `« ${mot} » n'est plus listé comme interdit dans le prompt de l'Agent VIP.`
    );
  }

  // Et l'interdiction doit résister à la demande de l'abonné : un modèle
  // reprend spontanément le vocabulaire de son interlocuteur.
  assert.match(
    src,
    /même si l'utilisateur emploie ces mots lui-même/i,
    "Le prompt n'interdit plus de reprendre le vocabulaire de l'abonné."
  );
});

test('★ ACQUIS — l Agent VIP ne reçoit plus l ordre de nommer un pari', () => {
  const src = lire('src/lib/agent-vip.ts');

  // L'instruction d'origine, mot pour mot. Elle ne doit jamais revenir.
  assert.ok(
    !/se termine par un pari nommé/i.test(src),
    "L'Agent VIP a de nouveau l'ordre de terminer par un pari nommé."
  );
  assert.ok(
    !/sur quoi mettre son argent/i.test(src),
    "L'Agent VIP a de nouveau l'ordre de dire où mettre son argent."
  );
  assert.ok(
    !/le marché que tu jouerais/i.test(src),
    "L'Agent VIP a de nouveau l'ordre d'annoncer un marché."
  );

  // Ce qui l'a remplacée doit rester : sans elle, l'agent redevient évasif et
  // l'abonné qui paie n'obtient plus de conclusion.
  assert.match(
    src,
    /se termine par une conclusion nommée/i,
    "L'Agent VIP n'a plus l'obligation de conclure — le produit perd sa valeur."
  );
});

test('★ ACQUIS — le teaser gratuit a l interdiction écrite du vocabulaire de pari', () => {
  const src = lire('src/lib/apercu-ia.ts');
  assert.match(
    src,
    /ne doivent JAMAIS apparaître[\s\S]{0,300}bookmaker/i,
    "La consigne du teaser ne nomme plus les mots interdits."
  );
});

// ── LE FILTRE QUI REJETTE, PLUTÔT QUE DE FAIRE CONFIANCE ───────────────────

test('★ ACQUIS — le teaser REJETTE un texte contenant du vocabulaire de pari', async () => {
  // Une consigne se néglige ; un filtre ne se néglige pas. C'est la seule
  // garantie qui ne dépende pas de l'obéissance du modèle.
  const { createJiti } = await import('jiti');
  const jiti = createJiti(racine, { alias: { '@': path.resolve(racine, 'src') } });
  const { trahitLeVerdict }: any = await jiti.import('./src/lib/apercu-ia.ts');

  const aRejeter = [
    'Un pari intéressant se dessine sur cette affiche.',
    'Les parieurs suivront ce match de près.',
    'Notre pronostic penche vers une rencontre fermée.',
    'La cote de Lyon reflète cette incertitude.',
    'Le bookmaker voit un match serré.',
  ];
  for (const texte of aRejeter) {
    assert.equal(
      trahitLeVerdict(texte),
      'vocabulaire de pari',
      `Le filtre laisse passer du vocabulaire de pari : « ${texte} »`
    );
  }

  // Et il ne doit pas rejeter du français normal : un garde-fou qui jette du
  // texte honnête fait retomber sur le gabarit sans raison.
  //
  // On compare au MOTIF, pas à `null` : `trahitLeVerdict` applique d'autres
  // contrôles (longueur, score annoncé, verdict déguisé) qui peuvent
  // légitimement se déclencher. Seul le contrôle du vocabulaire est jugé ici.
  const aGarder = [
    "Le Paris Saint-Germain reçoit Lyon dans un stade plein.",
    "La Côte d'Ivoire aborde la rencontre après deux succès.",
    "La mise en page du tableau a été revue, comme les mises à jour du classement.",
    "Le match se jouera sur la côte gauche, là où les deux équipes appuient.",
  ];
  for (const texte of aGarder) {
    assert.notEqual(
      trahitLeVerdict(texte),
      'vocabulaire de pari',
      `Le filtre voit du pari dans du texte légitime : « ${texte} »`
    );
  }
});

// ── LES ÉCRANS VUS PAR UN VISITEUR ─────────────────────────────────────────

/**
 * ── CE QUE CE TEST NE SURVEILLE PAS, ET POURQUOI ──────────────────────────
 *
 * Deux zones de l'application contiennent les mots interdits en toute
 * légitimité. Les ajouter ici ferait échouer le test sur ce qui nous protège.
 *
 *   1. LES CONSIGNES ENVOYÉES AUX MODÈLES — `agent-vip.ts`, `apercu-ia.ts`.
 *      Elles contiennent la LISTE des mots interdits (« pari, parier,
 *      bookmaker, cote… ne doivent JAMAIS apparaître ») et le filtre qui
 *      rejette les textes du modèle. Ces mots y sont l'interdiction
 *      elle-même : les retirer désarmerait la protection. Ils ne sortent
 *      jamais à l'écran — ce sont des instructions, pas des réponses. Des
 *      tests dédiés vérifient plus haut que ces listes sont bien présentes.
 *
 *   2. LES JOURNAUX SERVEUR ET LES IDENTIFIANTS INTERNES — `cotes-marche.ts`,
 *      `controle-marche.ts`, les tâches planifiées, `verifierPronostics()`,
 *      la clé `cotes:${jour}` en base, l'URL `/odds?league=`. Rien n'est
 *      affiché. Les renommer toucherait la logique et les données déjà
 *      écrites — et l'a déjà prouvé : un renommage de `cote` avait cassé
 *      l'affichage des buteurs en direct, parce que le serveur envoie un
 *      champ `cote` pour dire de quel camp est un buteur.
 *
 * La règle est donc constante : on surveille ce qu'un être humain peut LIRE,
 * jamais ce qu'une machine manipule.
 */
test('★ ACQUIS — aucune page publique n emploie le vocabulaire de pari', () => {
  const PAGES = [
    'src/app/LandingClient.tsx',
    'src/app/login/page.tsx',
    'src/app/signup/page.tsx',
    'src/app/support/page.tsx',
    'src/app/cgv/page.tsx',
    'src/app/not-found.tsx',
    'src/app/layout.tsx',
    'src/app/(dashboard)/preuves/page.tsx',
    'src/app/(dashboard)/expert/page.tsx',
    'src/app/(dashboard)/analyze/AnalyzeClient.tsx',
    'src/app/(dashboard)/history/page.tsx',
    'src/app/(dashboard)/history/list/page.tsx',
    'src/app/(dashboard)/pricing/PricingClient.tsx',
    'src/app/mentions-legales/page.tsx',
    'src/components/preuves/SectionPreuves.tsx',
    'src/dictionaries/fr.ts',
    // L'administration est derrière authentification, mais son vocabulaire
    // finit par déteindre : c'est là qu'on écrit les libellés qu'on recopie
    // ensuite côté visiteur. « Revenus » y reste autorisé (voir plus haut).
    'src/app/admin/system/page.tsx',
    'src/app/admin/users/[id]/page.tsx',
    'src/app/admin/preuves/page.tsx',
    'src/app/admin/preuves/PreuvesClient.tsx',
    'src/app/admin/diagnostic/page.tsx',
    'src/app/admin/_components/ControleMarche.tsx',
    'src/app/admin/_components/SuiviPrecision.tsx',
    // Textes générés côté serveur puis affichés tels quels.
    'src/lib/preuves.ts',
    'src/lib/diagnostic-ia.ts',
    'src/lib/courriel.ts',
  ];

  for (const page of PAGES) {
    // Les commentaires documentent l'incident : ils ont le droit de nommer ce
    // qu'ils expliquent, et le commentaire de la mention protectrice emploie
    // forcément le mot « pari ». Seul le texte livré au navigateur compte.
    //
    // Il faut donc suivre les blocs `/* … */` et `{/* … */}` LIGNE À LIGNE :
    // un test qui ne reconnaissait que la première ligne d'un commentaire
    // signalait ses propres explications comme des infractions.
    let dansUnBloc = false;

    // Découpage sur `\r?\n` : le dépôt est en fins de ligne Windows, et un
    // `\r` traînant en fin de ligne empêchait `/\/\/.*$/` de reconnaître un
    // commentaire — `.` ne franchit pas un retour chariot. Des lignes de
    // commentaire étaient donc jugées comme du code affiché.
    lire(page).split(/\r?\n/).forEach((ligne, i) => {
      const nue = ligne.trim();
      const etaitDansUnBloc = dansUnBloc;

      if (dansUnBloc) {
        if (ligne.includes('*/')) dansUnBloc = false;
        return;
      }
      void etaitDansUnBloc;

      // On neutralise d'abord les blocs ouverts ET refermés sur cette ligne,
      // puis les commentaires de fin de ligne. Ce qui reste est du code.
      let utile = ligne.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/\/\/.*$/, '');

      // S'il subsiste une ouverture, le bloc court sur les lignes suivantes :
      // tout ce qui suit l'ouverture est du commentaire, y compris ici. Sans
      // cette coupe, la PREMIÈRE ligne d'un commentaire était jugée comme du
      // code — c'est exactement ce qui faisait échouer ce test sur ses
      // propres explications.
      const ouverture = utile.search(/\{?\/\*/);
      if (ouverture >= 0) {
        dansUnBloc = true;
        utile = utile.slice(0, ouverture);
      }

      // ── ON NE JUGE QUE CE QUI PEUT S'AFFICHER ────────────────────────────
      //
      // Juger la ligne entière revenait à juger du code. `cote` est un nom de
      // variable dans `matchsRecents(result, cote)` et un champ envoyé par le
      // serveur dans `b.cote` : le test les signalait comme des infractions,
      // et « corriger » ces lignes cassait l'affichage des buteurs en direct.
      //
      // Un mot ne devient visible que par deux chemins : une chaîne de
      // caractères, ou du texte JSX entre deux balises. On extrait donc
      // exactement ces deux choses, et rien d'autre. Aucun nom de variable,
      // aucune clé d'objet, aucune annotation de type n'y figure — ils ne
      // s'affichent jamais.
      const chaines = [...utile.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
        (m) => m[1] ?? m[2] ?? m[3] ?? ''
      );

      // Le texte JSX est ce qui reste une fois retirées les balises et les
      // expressions `{…}` — ces dernières sont du code, et leurs éventuelles
      // chaînes ont déjà été relevées ci-dessus.
      //
      // Encore faut-il que la ligne SOIT du JSX. Appliqué à n'importe quelle
      // ligne, ce nettoyage rendait le code tel quel : la signature
      // `matchsRecents(result, cote: "team1")` passait pour du texte affiché.
      // Deux cas seulement comptent : une ligne qui porte une balise, et une
      // ligne de prose pure — celle d'un paragraphe dont les balises sont sur
      // les lignes voisines, qui ne contient donc aucune ponctuation de code.
      const porteUneBalise = /<[A-Za-z/]/.test(utile);
      const estDeLaProse = utile.trim().length > 0 && !/[<>{}=();]/.test(utile);
      const texteJsx =
        porteUneBalise || estDeLaProse
          ? utile.replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]*>/g, ' ')
          : '';

      for (const affichable of [...chaines, texteJsx]) {
        assert.ok(
          !INTERDITS.test(affichable),
          `${page}:${i + 1} emploie le vocabulaire de pari :\n    ${nue.slice(0, 120)}`
        );
        assert.ok(
          !MARCHES_DE_PARI.test(affichable),
          `${page}:${i + 1} nomme un marché de pari :\n    ${nue.slice(0, 120)}`
        );
        assert.ok(
          !GAINS_ET_GARANTIES.test(affichable),
          `${page}:${i + 1} promet un gain ou une certitude :\n    ${nue.slice(0, 120)}`
        );
      }
    });
  }
});

test('★ ACQUIS — les CGV gardent leur clause de non-responsabilité', () => {
  // Le vocabulaire est parti ; la protection juridique, elle, doit rester.
  // Retirer la clause en même temps que les mots serait une régression grave.
  const src = lire('src/app/cgv/page.tsx');
  assert.match(
    src,
    /n'est pas un conseiller financier et ne saurait être tenu responsable/i,
    'La clause de non-responsabilité des CGV a disparu.'
  );
  assert.match(
    src,
    /toute perte financière ou dommage subi par l'utilisateur/i,
    "La portée de la clause de non-responsabilité a été réduite."
  );
});
