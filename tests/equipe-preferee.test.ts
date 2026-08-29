/**
 * ★ ACQUIS — L'ÉQUIPE PRÉFÉRÉE EST UNE JOIE, PAS UN RÉGLAGE.
 *
 * ── CE QUI EST EN JEU ─────────────────────────────────────────────────────
 *
 * Cette fonctionnalité est purement émotionnelle : on demande son club de cœur
 * à quelqu'un qui arrive, on le fête, et on n'en reparle plus. Elle a deux
 * façons de mal tourner, et les deux sont silencieuses :
 *
 *   1. elle se met à DÉCIDER quelque chose — une analyse filtrée, une équipe
 *      présélectionnée — et l'application cesse d'être neutre sans que
 *      personne l'ait voulu ;
 *   2. elle se remontre. Une question posée une fois est un accueil ; la même
 *      question à chaque visite est une porte qu'on ne passe plus.
 *
 * ── LES NOMS DE CLUBS ONT ÉTÉ RELEVÉS EN BASE ─────────────────────────────
 *
 * Le 28 août 2026, dans la table `equipes`. C'est la leçon de `noms-clubs-fr` :
 * « Bayern Munich » ne renvoie rien chez le fournisseur, qui écrit « Bayern
 * München ». Ces tests figent ce qui a été VU, pas ce dont on se souvient.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CHAMPIONNATS_VEDETTES,
  ecussonDe,
  normaliserNom,
  tousLesClubsVedettes,
  clubsVedettes,
} from '../src/lib/equipes-vedettes';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/** Le code sans ses commentaires — ce que l'écran montre vraiment. */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ECRAN = 'src/app/(dashboard)/_accueil/AccueilEquipePreferee.tsx';
const ACTIONS = 'src/app/(dashboard)/_accueil/actions.ts';

// ── LA GRILLE PROPOSE BIEN LES GRANDS CLASSIQUES ───────────────────────────

test('★ ACQUIS — les cinq grands championnats sont proposés d’emblée', () => {
  const ids = CHAMPIONNATS_VEDETTES.map((c) => c.id);
  assert.deepEqual(ids, ['laliga', 'epl', 'ligue1', 'seriea', 'bundesliga']);
  for (const champ of CHAMPIONNATS_VEDETTES) {
    assert.ok(champ.clubs.length >= 2, `${champ.id} propose moins de deux clubs.`);
    assert.ok(champ.drapeau.length > 0, `${champ.id} n’a pas de drapeau.`);
  }
});

test('★ ACQUIS — les quatorze clubs demandés sont là', () => {
  const noms = tousLesClubsVedettes().map((c) => c.nom);
  for (const attendu of [
    'Real Madrid',
    'FC Barcelone',
    'Manchester City',
    'Liverpool',
    'Manchester United',
    'Chelsea',
    'Arsenal',
    'Paris Saint-Germain',
    'Marseille',
    'Juventus',
    'AC Milan',
    'Inter Milan',
    'Bayern Munich',
    'Borussia Dortmund',
  ]) {
    assert.ok(noms.includes(attendu), `${attendu} a disparu de la grille.`);
  }
});

test('★ ACQUIS — chaque club garde un monogramme lisible sans écusson', () => {
  // Le référentiel peut mettre plusieurs secondes à répondre au premier
  // chargement de la journée. La grille doit rester belle en attendant.
  for (const club of tousLesClubsVedettes()) {
    assert.match(club.monogramme, /^[A-Z]{2,3}$/, `${club.nom} : monogramme illisible.`);
    assert.ok(club.alias.length > 0, `${club.nom} : aucun alias.`);
  }
});

// ── LES ÉCUSSONS SE RETROUVENT SANS SE TROMPER DE CLUB ─────────────────────

test('★ ACQUIS — l’écusson est retrouvé par identifiant, jamais inventé', () => {
  const referentiel = [
    { id: 'realmadrid', name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png' },
  ];
  const real = tousLesClubsVedettes().find((c) => c.id === 'realmadrid')!;
  assert.equal(ecussonDe(real, referentiel), referentiel[0].logo);

  // Absent du référentiel : on ne fabrique pas d'adresse. Un écusson cassé est
  // pire que pas d'écusson.
  const barca = tousLesClubsVedettes().find((c) => c.id === 'barcelona')!;
  assert.equal(ecussonDe(barca, referentiel), null);
});

test('★ ACQUIS — le PSG ne prend pas l’écusson du Paris FC', () => {
  // Les deux jouent en Ligue 1 et commencent par « Paris ». Une correspondance
  // approximative afficherait l'un pour l'autre.
  const referentiel = [
    { id: 'parisfc', name: 'Paris FC', logo: 'https://media.api-sports.io/football/teams/1.png' },
    { id: 'parissaintgermain', name: 'Paris Saint Germain', logo: 'https://media.api-sports.io/football/teams/85.png' },
  ];
  const psg = tousLesClubsVedettes().find((c) => c.id === 'parissaintgermain')!;
  assert.equal(ecussonDe(psg, referentiel), 'https://media.api-sports.io/football/teams/85.png');
});

test('★ ACQUIS — les alias collent aux noms RÉELS du fournisseur', () => {
  // Relevés en base le 28 août 2026. Écrits de mémoire, « Bayern Munich » et
  // « FC Barcelone » ne retrouvent aucun écusson.
  const reels: Record<string, string> = {
    barcelona: 'Barcelona',
    bayernmunchen: 'Bayern München',
    acmilan: 'AC Milan',
    inter: 'Inter',
    marseille: 'Marseille',
    borussiadortmund: 'Borussia Dortmund',
  };

  for (const [id, nomReel] of Object.entries(reels)) {
    const club = tousLesClubsVedettes().find((c) => c.id === id)!;
    assert.ok(club, `${id} a disparu de la grille.`);
    // Retrouvé même si l'identifiant change de forme un jour : c'est le nom
    // qui sert alors de filet.
    const parNom = [{ name: nomReel, logo: 'https://media.api-sports.io/x.png' }];
    assert.equal(ecussonDe(club, parNom), 'https://media.api-sports.io/x.png', `${club.nom} : alias faux.`);
  }
});

test('★ ACQUIS — la comparaison ignore accents et casse', () => {
  assert.equal(normaliserNom('Bayern München'), 'bayern munchen');
  assert.equal(normaliserNom('  MARSEILLE '), 'marseille');
});

// ── L'ÉTAPE NE SE MONTRE QU'UNE FOIS, ET JAMAIS AU MAUVAIS MOMENT ──────────

test('★ ACQUIS — choisir ET passer referment définitivement l’étape', () => {
  // Sans l'indicateur sur le chemin « Passer », la personne qui décline se
  // verrait reposer la question à chaque visite — punie d'avoir dit non.
  const actions = lire(ACTIONS);
  assert.match(actions, /equipe_preferee_faite: true/, 'L’indicateur n’est plus posé.');
  assert.equal(
    (actions.match(/equipe_preferee_faite: true/g) ?? []).length,
    1,
    'L’indicateur devrait être posé au même endroit pour les deux chemins.'
  );

  const ecran = lire(ECRAN);
  assert.match(ecran, /user_metadata\?\.equipe_preferee_faite/, 'L’écran ne lit plus l’indicateur.');
  assert.match(ecran, /clore\(null\)/, 'Le bouton « Passer » n’enregistre plus rien.');
});

test('★ ACQUIS — l’étape ne s’ouvre jamais par-dessus un paiement', () => {
  // Quelqu'un qui est en train d'acheter ne doit pas recevoir une question sur
  // son club de cœur au milieu de sa transaction.
  const ecran = lire(ECRAN);
  const routes = ecran.match(/const ROUTES_ACCUEIL = \[([^\]]*)\]/);
  assert.ok(routes, 'La liste des chemins d’accueil a disparu.');
  assert.match(routes![1], /"\/analyze"/);
  assert.doesNotMatch(routes![1], /pricing|payment/, 'L’accueil peut s’ouvrir sur un paiement.');
});

test('★ ACQUIS — le bouton « Passer » existe et reste atteignable', () => {
  const ecran = lire(ECRAN);
  assert.match(ecran, />\s*Passer\s*</, 'Le bouton « Passer » a disparu de l’écran.');
  assert.match(ecran, /e\.key === "Escape"/, 'Échap ne referme plus l’étape.');
});

// ── LE MOMENT « WAOUH » ────────────────────────────────────────────────────

test('★ ACQUIS — les confettis et le message personnel sont là', () => {
  // ── LE TEST LIT LE RENDU, PAS LES COMMENTAIRES ───────────────────────────
  //
  // Une version précédente cherchait « Waouh » et « GRAND fan de » dans le
  // fichier entier. Le jour où ces phrases ont été remplacées, le test est
  // resté vert : les mots survivaient dans les commentaires qui expliquaient
  // pourquoi on les avait retirés. Un verrou qui se satisfait de ses propres
  // notes ne verrouille plus rien.
  const brut = lire(ECRAN);
  const ecran = sansCommentaires(brut);

  assert.match(brut, /canvas-confetti/, 'Les confettis ont disparu.');
  assert.match(ecran, /vrai fan de/, 'Le message de fête a disparu.');
  assert.match(ecran, /\{prenom \? `\$\{prenom\}, ` : ""\}/, 'Le message ne nomme plus la personne.');
  assert.match(ecran, /equipe\?\.nom \?\? "ton club"/, 'Le message ne nomme plus le club.');
  assert.match(
    brut,
    /prefers-reduced-motion/,
    'Les confettis ignorent les réglages d’accessibilité du téléphone.'
  );
});

test('★ ACQUIS — la fête se referme seule en cinq secondes au plus', () => {
  // Un écran de joie dont on ne sort qu'en cliquant cesse d'être une joie ;
  // un écran de joie qui s'attarde devient une porte qu'on attend.
  const ecran = lire(ECRAN);
  const duree = ecran.match(/const DUREE_FETE_MS = (\d+);/);
  assert.ok(duree, 'La durée de la fête a disparu.');
  assert.ok(
    Number(duree![1]) <= 5000,
    `La fête dure ${duree![1]} ms : au-delà de cinq secondes, on l’attend.`
  );
  assert.ok(Number(duree![1]) >= 2000, 'Trop court pour lire son nom à côté de son club.');
  assert.match(ecran, /setEtape\("sommeil"\)/);
});

test('★ ACQUIS — une simple tape referme la fête', () => {
  // Un moment de joie ne doit pas se terminer par la recherche d'un bouton.
  const ecran = sansCommentaires(lire(ECRAN));
  assert.match(ecran, /role="button"[\s\S]{0,200}onClick=\{onContinuer\}/, 'La carte de fête n’est plus tapable.');
  assert.match(ecran, /e\.key === "Enter" \|\| e\.key === " "/, 'La fête ne se referme plus au clavier.');
});

test('★ ACQUIS — la fête reste compacte', () => {
  // Elle remplissait la moitié de l'écran d'un téléphone. Une célébration qui
  // occupe tout finit par se faire attendre.
  const ecran = sansCommentaires(lire(ECRAN));
  const ecusson = ecran.match(/grid h-(\d+) w-\d+ place-items-center overflow-hidden rounded-\[24px\]/);
  assert.ok(ecusson, 'L’écusson de la fête a changé de forme.');
  assert.ok(Number(ecusson![1]) <= 20, `Écusson de fête trop grand : h-${ecusson![1]}.`);
  assert.match(ecran, /px-6 py-8 text-center/, 'La marge intérieure de la fête a regrossi.');
});

// ── ET SURTOUT : ELLE NE DÉCIDE DE RIEN ────────────────────────────────────

test('★ ACQUIS — aucune autre partie de l’application ne lit l’équipe préférée', () => {
  // C'est LA règle de cette fonctionnalité. Le jour où un autre écran la lit,
  // l'application cesse d'être neutre : elle propose, elle oriente, elle
  // filtre. Ce test échouera à la première lecture de trop.
  const attendus = new Set([
    path.normalize(ECRAN),
    path.normalize(ACTIONS),
  ]);

  const trouves: string[] = [];
  const parcourir = (dossier: string) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const p = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('equipe_preferee')) {
        trouves.push(path.relative(process.cwd(), p));
      }
    }
  };
  parcourir(path.join(process.cwd(), 'src'));

  for (const f of trouves) {
    assert.ok(
      attendus.has(path.normalize(f)),
      `${f} lit l’équipe préférée : cette donnée ne doit décider de rien.`
    );
  }
  assert.equal(trouves.length, 2, 'Les deux fichiers de la fonctionnalité devraient être les seuls.');
});

test('★ ACQUIS — rien n’est présélectionné pour l’analyse', () => {
  // L'équipe qu'on aime et l'équipe qu'on veut analyser sont deux choses
  // différentes. La page d'analyse ne connaît pas la première.
  const analyse = lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx');
  assert.doesNotMatch(analyse, /equipe_preferee/, 'L’analyse lit l’équipe préférée.');
});

test('★ ACQUIS — aucun vocabulaire de paris nulle part', () => {
  // L'application analyse des matchs. Elle ne parie pas, et rien de ce qui est
  // écrit ne doit laisser croire le contraire.
  const interdits = [/pronostic/i, /\bparier\b/i, /paris?\s+sportifs?/i, /bookmaker/i, /\bmiser\b/i];
  for (const fichier of [ECRAN, ACTIONS, 'src/lib/equipes-vedettes.ts']) {
    const contenu = lire(fichier);
    for (const motif of interdits) {
      assert.doesNotMatch(contenu, motif, `${fichier} emploie un vocabulaire de paris.`);
    }
  }
});

test('★ ACQUIS — l’adresse d’écusson conservée vient bien de l’hébergeur attendu', () => {
  // Le club arrive du navigateur : c'est une saisie, pas une donnée de
  // confiance. Un champ libre qui accepte n'importe quelle URL finit toujours
  // par en afficher une qu'on n'avait pas prévue.
  const actions = lire(ACTIONS);
  assert.match(actions, /https:\/\/media\.api-sports\.io\//);
  assert.match(actions, /startsWith\(ORIGINE_ECUSSONS\)/);
});

// ── LE TÉLÉPHONE D'ABORD ───────────────────────────────────────────────────
//
// La grande majorité des utilisateurs arrivent sur téléphone. Ces verrous
// portent sur ce qui casse VRAIMENT une première expérience mobile : une cible
// trop petite pour un pouce, un clavier qui recouvre le champ qu'on vient
// d'ouvrir, une page qui glisse de côté.

test('★ ACQUIS — toutes les cibles tactiles font au moins 44 px', () => {
  // Mesuré dans un navigateur à 360 px : bouton « Passer » 44 px, champ de
  // recherche 54 px, carte de club 66 px, « Continuer » 52 px.
  //
  // Le test lit les VALEURS et vérifie le seuil, au lieu de recopier les
  // hauteurs exactes. Une première version les figeait une à une : agrandir
  // une carte de 64 à 68 px — une amélioration — faisait échouer le verrou.
  // Un test qui punit les progrès finit par être contourné.
  const ecran = lire(ECRAN);
  const hauteurs = [...ecran.matchAll(/min-h-\[(\d+)px\]/g)].map((m) => Number(m[1]));

  assert.ok(hauteurs.length >= 4, `Seulement ${hauteurs.length} hauteurs minimales trouvées.`);
  for (const h of hauteurs) {
    assert.ok(h >= 44, `Une cible tactile est tombée à ${h} px, sous le minimum de 44.`);
  }
});

test('★ ACQUIS — le champ de recherche ne fait pas zoomer iOS', () => {
  // Sous 16 px de corps, iOS zoome tout seul à la mise au point : l'écran part
  // de travers et rien ne le remet droit. C'est un détail d'une ligne qui rend
  // le formulaire inutilisable sur iPhone.
  const ecran = lire(ECRAN);
  assert.match(ecran, /text-\[16px\] sm:text-\[14px\]/, 'Le champ est repassé sous 16 px sur téléphone.');
});

test('★ ACQUIS — la carte remonte au-dessus du clavier', () => {
  // Sur Android le clavier se pose PAR-DESSUS la page sans la réduire. Une
  // carte qui l'ignore passe dessous avec ses résultats — on demande, la
  // réponse arrive, et elle est cachée par le clavier qui a servi à demander.
  const ecran = lire(ECRAN);
  assert.match(ecran, /window\.visualViewport/, 'La carte ne suit plus le clavier.');
  assert.match(ecran, /height: `calc\(100% - \$\{clavier\}px\)`/);
  // Hauteur en pourcentage du conteneur, pas en `vh` : `vh` ignore le clavier.
  //
  // Le plafond exact peut évoluer — on l'a descendu de 85 à 76 % pour que la
  // notice pèse moins sur l'écran. Ce que ce test protège, c'est qu'il EXISTE
  // et qu'il reste dans des bornes tenables : au-dessus de 85 % la notice
  // remplit tout, en dessous de 60 % la grille de clubs ne se voit plus.
  const plafond = ecran.match(/max-h-\[(\d+)%\]/);
  assert.ok(plafond, 'La carte a perdu son plafond de hauteur.');
  assert.ok(Number(plafond![1]) <= 85, `Carte trop haute : ${plafond![1]} %.`);
  assert.ok(Number(plafond![1]) >= 60, `Carte trop basse : ${plafond![1]} %.`);
  assert.doesNotMatch(ecran, /max-h-\[\d+vh\]/, 'Une hauteur en vh ignorerait le clavier.');
});

// ── UNE NOTICE POSÉE SUR LA PAGE, PAS UN ÉCRAN QUI LA REMPLACE ─────────────

test('★ ACQUIS — la carte reste contenue et centrée', () => {
  // Elle occupait toute la hauteur du téléphone : on ne voyait plus
  // l'application derrière, et une question facultative prenait l'allure d'une
  // porte fermée. Mesuré à 390 px : carte de 358 px de large, 16 px de marge
  // de chaque côté, 690 px de haut sur 844 — l'overlay reste visible autour.
  const ecran = lire(ECRAN);
  assert.match(ecran, /max-w-\[400px\]/, 'La carte n’est plus bornée en largeur.');
  // Le rayon exact peut évoluer ; ce qui compte est qu'il reste franc. Une
  // notice à coins presque droits ne se lit plus comme un objet posé.
  const rayon = ecran.match(/max-w-\[400px\][^"]*rounded-\[(\d+)px\]/);
  assert.ok(rayon, 'La carte a perdu ses coins arrondis.');
  assert.ok(Number(rayon![1]) >= 20, `Coins trop droits : ${rayon![1]} px.`);
  assert.match(ecran, /items-center justify-center/, 'La carte n’est plus centrée.');
  assert.match(ecran, /bg-black\/80/, 'Le voile sombre derrière la carte a disparu.');
  assert.doesNotMatch(ecran, /rounded-t-\[28px\]/, 'La carte est redevenue une feuille collée en bas.');
});

test('★ ACQUIS — c’est l’intérieur de la carte qui défile, pas la page', () => {
  // Mesuré à 390 px : 609 px de contenu dans 444 px de zone visible, et la
  // page derrière ne défile pas d'un pixel.
  const ecran = lire(ECRAN);
  assert.match(ecran, /min-h-0 flex-1 overflow-y-auto/, 'Le corps de la carte ne défile plus.');
  assert.match(ecran, /document\.body\.style\.overflow = "hidden"/, 'La page défile de nouveau derrière.');
});

test('★ ACQUIS — les clubs ne sont plus rangés par championnat', () => {
  // On demandait « quelle est ton équipe préférée » et on répondait par un
  // classement administratif : cinq en-têtes, et le regard qui doit trouver le
  // bon pays avant de chercher un blason.
  const ecran = sansCommentaires(lire(ECRAN));
  assert.doesNotMatch(ecran, /CHAMPIONNATS_VEDETTES/, 'L’écran regroupe de nouveau par championnat.');
  assert.doesNotMatch(ecran, /champ\.libelle|champ\.drapeau/, 'Les en-têtes de championnat sont revenus.');
  assert.match(ecran, /clubsVedettes\(\)/, 'La grille unique a disparu.');
  assert.match(ecran, /grid grid-cols-2 gap-2\.5/, 'La grille n’est plus à deux colonnes sur téléphone.');
});

test('★ ACQUIS — les quatorze clubs tiennent dans une seule grille', () => {
  const clubs = clubsVedettes();
  assert.equal(clubs.length, 14, 'Le nombre de grands clubs proposés a changé.');
  // Le championnat n'est plus montré, mais il reste attaché au choix.
  for (const c of clubs) {
    assert.ok(c.championnat, `${c.nom} a perdu son championnat.`);
  }
});

test('★ ACQUIS — le club touché s’allume avant que l’écran ne change', () => {
  // Sans ce battement, la grille disparaissait à l'instant du contact et rien
  // ne confirmait CE QUI avait été touché — sur un téléphone, où le doigt
  // cache la moitié de la carte, on n'était pas sûr d'avoir visé juste.
  //
  // Mesuré dans le navigateur : bordure rgb(16,185,129) de 2 px et fond teinté
  // à 15 % sur la carte choisie, contre blanc à 7 % et 1 px sur les autres.
  const ecran = lire(ECRAN);
  assert.match(ecran, /aria-pressed=\{choisi\}/, 'L’état choisi n’est plus annoncé.');
  // Le halo prend les couleurs DU CLUB, pas le vert de marque : c'est ce qui
  // fait la différence entre « bouton sélectionné » et « c'est TON club ».
  assert.match(ecran, /borderColor: club\.couleur/, 'Le halo a perdu les couleurs du club.');
  assert.match(ecran, /boxShadow: `0 0 0 4px \$\{club\.couleur\}/, 'Le halo du club a disparu.');
  // Elle grandit : on ne récompense pas un geste en enfonçant le bouton.
  assert.match(ecran, /"border-2 scale-105"/, 'La carte choisie ne grandit plus.');
});

test('★ ACQUIS — chaque club porte une couleur lisible sur fond noir', () => {
  // Le bleu marine du PSG et le noir de la Juventus ne feraient aucun halo :
  // on prend leur seconde couleur. Un halo invisible vaut pas de halo, sauf
  // qu'il donne l'illusion d'avoir été prévu.
  for (const club of tousLesClubsVedettes()) {
    assert.match(club.couleur, /^#[0-9A-F]{6}$/, `${club.nom} : couleur mal formée.`);
    const r = parseInt(club.couleur.slice(1, 3), 16);
    const v = parseInt(club.couleur.slice(3, 5), 16);
    const b = parseInt(club.couleur.slice(5, 7), 16);
    // Luminance perçue : l'œil ne pèse pas les trois canaux pareillement.
    const clarte = 0.299 * r + 0.587 * v + 0.114 * b;
    assert.ok(clarte > 55, `${club.nom} : couleur trop sombre (${Math.round(clarte)}) pour un halo.`);
  }
});

test('★ ACQUIS — la carte entre en scène', () => {
  // Une notice qui surgit s'impose ; une notice qui monte se présente. Fait en
  // état React et non en image-clé CSS : aucune règle à déclarer, donc rien
  // qui puisse ne pas être généré par Tailwind.
  const ecran = lire(ECRAN);
  assert.match(ecran, /setEntree\(true\)/, 'L’animation d’entrée a disparu.');
  assert.match(ecran, /opacity-0 translate-y-4 scale-95/, 'L’état de départ de l’entrée a disparu.');
});

test('★ ACQUIS — aucune classe Tailwind fantôme dans les styles vivants', () => {
  // Un halo `shadow-[0_0_0_3px_rgba(...)]` et un `ring-[...]` avaient été
  // écrits : Tailwind ne générait AUCUNE règle pour ces valeurs. Les classes
  // étaient sur l'élément, et il ne se passait rien — le pire des cas, du
  // style qui a l'air écrit et qui n'existe pas.
  const ecran = sansCommentaires(lire(ECRAN));
  assert.doesNotMatch(ecran, /shadow-\[/, 'Une ombre sur mesure est revenue : vérifier qu’elle est générée.');
  assert.doesNotMatch(ecran, /\bring-\[/, 'Un anneau sur mesure est revenu : vérifier qu’il est généré.');
});

test('★ ACQUIS — rien ne peut pousser la page de côté', () => {
  const ecran = lire(ECRAN);
  assert.match(ecran, /overflow-x-hidden/, 'Le garde-fou contre le débordement a sauté.');
  assert.match(ecran, /break-words/, 'Un nom de club long peut de nouveau élargir sa carte.');
});

test('★ ACQUIS — les confettis s’allègent sur petit écran', () => {
  // Trois cents particules redessinées soixante fois par seconde transforment
  // la fête en diaporama sur un téléphone d'entrée de gamme — et une
  // célébration qui saccade se lit comme une application qui rame.
  const ecran = lire(ECRAN);
  assert.match(ecran, /window\.innerWidth < 480/, 'Les confettis ne s’allègent plus sur téléphone.');
  assert.match(ecran, /particleCount: n\(/, 'Le nombre de particules n’est plus modulé.');
});

// ── LE TON D'UN OUTIL QU'ON PAIE ───────────────────────────────────────────

test('★ ACQUIS — aucun émoji dans ce que l’écran affiche', () => {
  // Les outils professionnels ne mettent pas d'émoji dans leurs titres. Un
  // ballon après « Quel est ton club favori ? » et une main qui pointe après
  // « Donne-nous ta réponse » font remarquer la mise en forme au lieu de la
  // question — et rangent le produit du côté de la publicité.
  //
  // On lit le RENDU, pas les commentaires : ceux-ci citent volontairement les
  // anciens textes pour expliquer pourquoi ils ont disparu.
  const ecran = sansCommentaires(lire(ECRAN));
  const emojis = ecran.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? [];
  assert.equal(
    emojis.length,
    0,
    `L’écran affiche de nouveau ${emojis.length} émoji(s) : ${emojis.join(' ')}`
  );
});

test('★ ACQUIS — le titre est d’une seule couleur, sans dégradé', () => {
  // « club favori » était écrit en dégradé vert-jaune au milieu d'une phrase
  // blanche. Écrire trois mots d'une même phrase dans une autre couleur attire
  // l'œil sur la typographie, pas sur ce qui est demandé.
  const ecran = sansCommentaires(lire(ECRAN));
  const titre = ecran.match(/<h2[\s\S]{0,400}?<\/h2>/);
  assert.ok(titre, 'Le titre a disparu.');
  assert.match(titre![0], /Quel est ton club favori/, 'Le titre a changé de texte.');
  assert.doesNotMatch(titre![0], /linear-gradient/, 'Le dégradé est revenu dans le titre.');
  assert.doesNotMatch(titre![0], /<span/, 'Le titre est de nouveau découpé en morceaux colorés.');
});
