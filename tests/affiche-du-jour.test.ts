/**
 * ★ ACQUIS — L'AFFICHE DU JOUR NE PARLE QUE D'ACTIVITÉ, ET RESTE PRIVÉE.
 *
 * ── CE QUE CETTE AFFICHE EST ─────────────────────────────────────────────
 *
 * Une image que l'abonné partage sur son statut WhatsApp : elle raconte son
 * activité d'analyse du jour et promène la marque ProFoot AI. C'est du
 * marketing gratuit, à une condition absolue : elle ne doit JAMAIS ressembler à
 * une publicité de pari.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Aucun mot de pari, de pronostic, de résultat, de gain ou de taux ne peut
 *    figurer sur l'affiche : `verifierConformite` refuse de la composer.
 * 2. La lecture en base ne demande QUE les deux équipes et l'heure. Le score,
 *    la confiance, les probabilités, le résumé et l'analyse complète ne sortent
 *    pas de la base — on ne peut pas divulguer ce qu'on n'a pas reçu.
 * 3. Pendant l'essai privé, seule l'adresse autorisée y a accès ; l'ouverture à
 *    tous les abonnés payants tient à un seul interrupteur.
 * 4. Le nom d'un club ne fait pas échouer l'affiche : « Paris Saint-Germain »
 *    n'est pas une infraction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AFFICHE_PUBLIQUE,
  ESSAI_PRIVE,
  LECTURE_AUTORISEE,
  MOTS_INTERDITS,
  afficheAutorisee,
  motsInterditsTrouves,
  prenomDe,
  rencontresMieuxCernees,
  serieDepuis,
  verifierConformite,
} from '../src/lib/affiche-du-jour';
import {
  DEVISE,
  MERCI,
  QUESTION,
  SURTITRE_CERNES,
  TITRE_CERNES,
  libelleCernes,
  preuveDe,
  rangDe,
  textesDeLAffiche,
  titreDe,
} from '../src/components/affiche/AfficheVisuel';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — un mot de pari, de gain ou de résultat fait REFUSER l’affiche', () => {
  for (const interdit of [
    'Analyse réussie !',
    '3 pronostics corrects',
    'Score prédit 2-1',
    'Taux de réussite 80 %',
    'Mes gains du jour',
    'Pari du jour',
    'Vainqueur annoncé : Arsenal',
  ]) {
    assert.throws(
      () => verifierConformite([interdit]),
      /Affiche refusée/,
      `« ${interdit} » doit être refusé : l'affiche ne parle que d'activité d'analyse.`
    );
  }
});

test('★ ACQUIS — les textes réellement composés sont conformes, tous les cas', () => {
  const base = {
    mieuxCernes: [
      { domicile: 'PSV Eindhoven', logoDomicile: null, exterieur: 'Sparta Rotterdam', logoExterieur: null, heure: '18:00' },
    ],
    prenom: 'Ousmane',
    jour: '2026-09-12',
    analysesDuMois: 37,
    serie: 7,
    equipePreferee: { nom: 'Real Madrid', logo: null },
    matchs: [
      { domicile: 'Arsenal', logoDomicile: null, exterieur: 'Chelsea', logoExterieur: null },
      { domicile: 'Paris Saint-Germain', logoDomicile: null, exterieur: 'Lens', logoExterieur: null },
    ],
  };
  // Zéro, un, plusieurs : les trois tournures du titre doivent passer.
  for (const analysesDuJour of [0, 1, 5]) {
    const d = { ...base, analysesDuJour } as any;
    const clubs = [
      ...d.matchs.flatMap((m: any) => [m.domicile, m.exterieur]),
      ...d.mieuxCernes.flatMap((m: any) => [m.domicile, m.exterieur]),
      d.equipePreferee.nom,
    ];
    verifierConformite([...textesDeLAffiche(d), ...clubs], clubs);
  }
  assert.match(titreDe(5), /analysé 5 matchs/);
  assert.doesNotMatch(titreDe(5), /gagn|réussi|score|pronostic/i);
});

test('★ ACQUIS — le nom d’un club ne fait pas échouer l’affiche', () => {
  // « Paris » est un mot interdit ; le Paris Saint-Germain, non.
  assert.ok(MOTS_INTERDITS.includes('paris'));
  assert.deepEqual(motsInterditsTrouves(['Paris Saint-Germain']), ['paris']);
  verifierConformite(['Paris Saint-Germain'], ['Paris Saint-Germain']);
});

test('★ ACQUIS — la lecture en base ne demande aucune colonne de résultat', () => {
  for (const colonne of [
    'score',
    'confidence',
    'win_prob',
    'draw_prob',
    'lose_prob',
    'predicted_winner',
    'summary',
    'analysis_data',
  ])
    assert.ok(
      !LECTURE_AUTORISEE.includes(colonne),
      `L'affiche ne doit jamais demander « ${colonne} » : ce qui ne sort pas de la base ne peut pas se retrouver sur un réseau social.`
    );
  for (const colonne of ['created_at', 'team1_name', 'team1_logo', 'team2_name', 'team2_logo'])
    assert.ok(LECTURE_AUTORISEE.includes(colonne), `L'affiche a besoin de « ${colonne} ».`);

  // Et la route ne doit pas aller chercher ces colonnes par un autre chemin.
  const source = sansCommentaires(fs.readFileSync('src/lib/affiche-du-jour.ts', 'utf8'));
  assert.match(source, /select\(LECTURE_AUTORISEE\)/, 'La lecture doit passer par la liste autorisée.');
  assert.doesNotMatch(source, /select\('\*'\)/, "L'affiche ne doit jamais lire toute la ligne.");
});

test('★ ACQUIS — essai privé : une seule adresse, et un seul interrupteur pour ouvrir', () => {
  assert.equal(AFFICHE_PUBLIQUE, false, 'L’affiche doit rester en essai privé tant que le propriétaire ne l’a pas ouverte.');
  assert.deepEqual([...ESSAI_PRIVE], ['h9422320@gmail.com']);

  // L'adresse autorisée entre, même sans abonnement payant.
  assert.equal(afficheAutorisee('h9422320@gmail.com', false), true);
  assert.equal(afficheAutorisee('H9422320@Gmail.com ', false), true, 'La casse et les espaces ne doivent pas fermer la porte.');

  // Tous les autres restent dehors, payants ou non.
  assert.equal(afficheAutorisee('abonne@exemple.com', true), false);
  assert.equal(afficheAutorisee('abonne@exemple.com', false), false);
  assert.equal(afficheAutorisee(null, true), false);
  assert.equal(afficheAutorisee('', true), false);
});

test('★ ACQUIS — la route et le bouton n’existent pas pour les autres comptes', () => {
  const route = sansCommentaires(fs.readFileSync('src/app/api/affiche/route.tsx', 'utf8'));
  assert.match(route, /afficheAutorisee\(guard\.user\.email, guard\.entitlements\.premium\)/, 'La route doit contrôler l’accès.');
  assert.match(route, /status: 404/, 'Hors essai privé, la route doit répondre 404 : une fonctionnalité en essai ne se laisse pas deviner.');

  const etat = sansCommentaires(fs.readFileSync('src/app/api/affiche/etat/route.ts', 'utf8'));
  assert.match(etat, /disponible: false/, 'La route d’état doit pouvoir répondre « indisponible » sans rien révéler.');

  // Le bloc vit dans la page « Mon Profil » — celle où mène la petite tête de
  // la barre du bas. Il a d'abord été posé sur la page d'analyse puis dans les
  // réglages : dans les deux cas le propriétaire ne l'a pas trouvé.
  const bouton = sansCommentaires(fs.readFileSync('src/components/affiche/BlocAfficheDuJour.tsx', 'utf8'));
  assert.match(bouton, /if \(!etat\?\.disponible\) return null;/, 'Le bouton doit ne RIEN rendre hors essai privé.');
});

test('la série compte les jours d’affilée, et s’arrête au premier trou', () => {
  assert.equal(serieDepuis(['2026-09-12', '2026-09-11', '2026-09-10'], '2026-09-12'), 3);
  assert.equal(serieDepuis(['2026-09-12', '2026-09-10'], '2026-09-12'), 1, 'Un jour manquant coupe la série.');
  assert.equal(serieDepuis(['2026-09-11', '2026-09-10'], '2026-09-12'), 0, 'Sans analyse aujourd’hui, il n’y a pas de série.');
  assert.equal(serieDepuis([], '2026-09-12'), 0);
});

test('le prénom vient du nom, sinon de l’adresse', () => {
  assert.equal(prenomDe('Ousmane Traoré', 'x@y.com'), 'Ousmane');
  assert.equal(prenomDe(null, 'ousmane.traore@gmail.com'), 'ousmane');
  assert.equal(prenomDe('', ''), 'Analyste');
});

test('★ ACQUIS — les rencontres les mieux cernées paraissent SANS leur pourcentage', () => {
  // La section de la page d'analyse porte la part de pronostics justes — 90 %,
  // 81 %. Sur une image qui part sur WhatsApp et TikTok, un pourcentage à côté
  // d'un match se lit comme une publicité de pari, et ce projet a déjà perdu
  // une boutique sur un contrôle « produits interdits : paris sportifs ».
  const selection = [
    {
      dom: { name: 'PSV Eindhoven', logo: 'https://x/psv.png' },
      ext: { name: 'Sparta Rotterdam', logo: 'https://x/spa.png' },
      kickoffISO: '2026-09-13T18:00:00.000Z',
      fiabilite: 90,
      mesureeSur: 48,
      famille: 'Favori écrasant',
      championnat: 'Eredivisie',
    },
  ];
  const [r] = rencontresMieuxCernees(selection);
  assert.deepEqual(r, {
    domicile: 'PSV Eindhoven',
    logoDomicile: 'https://x/psv.png',
    exterieur: 'Sparta Rotterdam',
    logoExterieur: 'https://x/spa.png',
    heure: '18:00',
  });
  // Rien d'autre ne passe : ce qui n'est pas recopié ne peut pas se retrouver
  // sur un réseau social. Même principe que LECTURE_AUTORISEE.
  for (const interdit of ['fiabilite', 'mesureeSur', 'famille', 'championnat'])
    assert.ok(!(interdit in (r as any)), `« ${interdit} » ne doit pas sortir sur l'affiche.`);

  // Une sélection absente ne casse rien : l'affiche retombe sur les matchs
  // analysés par l'abonné.
  assert.deepEqual(rencontresMieuxCernees(null), []);
  assert.deepEqual(rencontresMieuxCernees([]), []);
});

test('★ ACQUIS — l’affiche préfère les mieux cernés, et retombe sur les matchs analysés', () => {
  const source = sansCommentaires(fs.readFileSync('src/components/affiche/AfficheVisuel.tsx', 'utf8'));
  assert.ok(
    source.includes('const matchs = surLesCernes ? cernes : d.matchs'),
    'Les rencontres du jour passent devant : un relevé d’activité ne fait rien demander à personne.'
  );
  assert.ok(source.includes('const titreDeLaListe = surLesCernes ? TITRE_CERNES : TITRE_LISTE'));
  // Et le titre reste dans le vocabulaire de l'analyse.
  assert.doesNotMatch(TITRE_CERNES, /sûr|sur[e]?s\b|gagn|pronostic/i);
});

test('★ ACQUIS — la version carrée a disparu de l’écran, les quatre réseaux l’ont remplacée', () => {
  const bloc = sansCommentaires(fs.readFileSync('src/components/affiche/BlocAfficheDuJour.tsx', 'utf8'));
  assert.doesNotMatch(bloc, /Version carrée/, 'Le choix du format carré a été retiré par le propriétaire.');
  assert.match(bloc, /Partager mon affiche/);
  for (const reseau of ['whatsapp', 'tiktok', 'instagram', 'facebook'])
    assert.ok(
      fs.readFileSync('src/components/affiche/ReseauxAffiche.tsx', 'utf8').includes(`'${reseau}'`),
      `Le réseau ${reseau} doit être proposé.`
    );
  // Le partage passe par la feuille du système : c'est le SEUL chemin qui
  // attache réellement l'image. Aucun de ces réseaux n'accepte qu'une page web
  // lui envoie un fichier.
  assert.match(bloc, /canShare\?\.\(\{ files: \[fichier\] \}\)/);
  assert.match(bloc, /lienDeSecours\(reseau\)/, 'Sans partage de fichier, le réseau doit quand même s’ouvrir.');
});

test('★ ACQUIS — le sujet de l’affiche, c’est la PERSONNE', () => {
  // Quatre versions informaient sans émouvoir. « Ça ne me fait absolument rien
  // ressentir », le 13 septembre 2026. On ne partage pas une information sur
  // soi : on partage ce qui nous flatte — être nommé, être reconnu, avoir
  // mérité quelque chose.
  const source = sansCommentaires(fs.readFileSync('src/components/affiche/AfficheVisuel.tsx', 'utf8'));

  // Le prénom en géant, et une taille qui s'adapte à sa longueur : Satori
  // n'ajuste rien tout seul, un prénom de douze lettres déborderait sans un mot.
  assert.ok(source.includes('const taillePrenom = Math.min('), 'Le prénom doit s’adapter à la largeur.');
  assert.ok(source.includes('{CAPITALES(prenom)}'), 'Le prénom doit être composé en géant.');
  assert.ok(source.includes('{CAPITALES(MERCI)}'), 'La reconnaissance doit être nommée.');
  assert.ok(source.includes('{CAPITALES(rang)}'), 'Le rang doit paraître.');
  assert.ok(source.includes('{DEVISE}'), 'La devise doit paraître.');
});

test('★ ACQUIS — le rang se mérite sur l’activité, JAMAIS sur la justesse', () => {
  // Un taux de réussite sur une image partagée, c'est une publicité de pari aux
  // yeux d'un contrôle — et ce projet a déjà perdu une boutique là-dessus. Le
  // rang se calcule donc sur le VOLUME, la seule donnée que l'affiche possède.
  assert.equal(rangDe(0), 'nouvelle recrue');
  assert.equal(rangDe(3), 'nouvelle recrue');
  assert.equal(rangDe(5), 'analyste régulier');
  assert.equal(rangDe(20), 'analyste confirmé');
  assert.equal(rangDe(50), 'analyste chevronné');
  assert.equal(rangDe(102), 'analyste d’élite');
  // Un rang que personne n'obtient ne flatte personne : le premier palier doit
  // tomber dès la première semaine.
  assert.notEqual(rangDe(5), rangDe(4));

  for (const n of [0, 1, 5, 20, 50, 100, 9999]) verifierConformite([rangDe(n)]);
  verifierConformite([DEVISE, MERCI]);
  // La devise dit le contraire du jeu : c'est sa raison d'être.
  assert.match(DEVISE, /analyses/i);
  assert.doesNotMatch(DEVISE, /hasard|pari|gagn|chance/i);
});

test('la ligne de preuve prend le fait le plus fort disponible', () => {
  assert.equal(
    preuveDe({ serie: 7, analysesDuMois: 102 } as any),
    '7 jours de suite · 102 analyses ce mois-ci',
    'L’assiduité est la chose la plus difficile à tenir : elle passe devant.'
  );
  assert.equal(preuveDe({ serie: 1, analysesDuMois: 12 } as any), '12 analyses ce mois-ci');
  assert.equal(preuveDe({ serie: 0, analysesDuMois: 0 } as any), 'première analyse');
});

test('★ ACQUIS — l’affiche pose une question : c’est elle qui fait poster', () => {
  // Un statut qui affirme se regarde ; un statut qui demande reçoit des
  // réponses, et chaque réponse est une conversation qui finit sur le site.
  assert.ok(QUESTION.trim().endsWith('?'), 'La question doit en être une.');
  verifierConformite([QUESTION, SURTITRE_CERNES]);
  // Elle ne peut pas glisser vers le vocabulaire du pari.
  for (const interdit of [/gagn/i, /pronostic/i, /vainqueur/i, /taux/i, /score/i])
    assert.doesNotMatch(QUESTION + ' ' + SURTITRE_CERNES, interdit);

  const source = sansCommentaires(fs.readFileSync('src/components/affiche/AfficheVisuel.tsx', 'utf8'));
  assert.ok(source.includes('{QUESTION}'), 'La question doit être composée sur l’affiche.');
});

test('★ ACQUIS — l’affiche se voit sans cliquer, et en grand', () => {
  const bloc = sansCommentaires(fs.readFileSync('src/components/affiche/BlocAfficheDuJour.tsx', 'utf8'));
  // Fabriquée à l'arrivée, pas au clic : on partage ce qu'on a vu.
  assert.ok(
    bloc.includes('if (!etat?.disponible) return;'),
    'L’affiche doit se fabriquer dès que l’accès est confirmé, sans attendre un clic.'
  );
  assert.ok(bloc.includes("fetch('/api/affiche?format=story')"));
  // Pleine largeur, et le neuf-seizièmes garanti : c'est le format du statut,
  // validé par le propriétaire, et il ne doit jamais se déformer.
  assert.ok(bloc.includes("aspectRatio: '9 / 16'"), 'Le format du statut ne doit jamais se déformer.');
  assert.ok(!bloc.includes('max-w-[220px]'), 'L’affiche ne doit plus tenir dans 220 pixels.');
});
