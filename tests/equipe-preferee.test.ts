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
} from '../src/lib/equipes-vedettes';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

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
  const ecran = lire(ECRAN);
  assert.match(ecran, /canvas-confetti/, 'Les confettis ont disparu.');
  assert.match(ecran, /Waouh/, 'Le message de fête a disparu.');
  assert.match(ecran, /GRAND fan de/, 'Le message ne nomme plus le club.');
  assert.match(
    ecran,
    /prefers-reduced-motion/,
    'Les confettis ignorent les réglages d’accessibilité du téléphone.'
  );
});

test('★ ACQUIS — la fête rend la main toute seule', () => {
  // Un écran de joie dont on ne sort qu'en cliquant cesse d'être une joie.
  const ecran = lire(ECRAN);
  assert.match(ecran, /DUREE_FETE_MS/);
  assert.match(ecran, /setEtape\("sommeil"\)/);
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
  // Mesuré dans un navigateur à 360 px le 28 août 2026 : bouton « Passer »
  // 44 px, champ de recherche 54 px, carte de club 66 px, « Continuer » 52 px.
  // Ces minimums vivent dans les classes, un test peut donc les tenir.
  const ecran = lire(ECRAN);
  assert.match(ecran, /min-h-\[44px\][^"]*rounded-full/, 'Le bouton « Passer » a perdu sa hauteur minimale.');
  assert.match(ecran, /min-h-\[52px\][^"]*rounded-\[16px\]/, 'Le champ de recherche a perdu sa hauteur minimale.');
  assert.match(ecran, /min-h-\[64px\]/, 'Les cartes de club ont perdu leur hauteur minimale.');
  assert.match(ecran, /min-h-\[56px\]/, 'Les résultats de recherche ont perdu leur hauteur minimale.');
});

test('★ ACQUIS — le champ de recherche ne fait pas zoomer iOS', () => {
  // Sous 16 px de corps, iOS zoome tout seul à la mise au point : l'écran part
  // de travers et rien ne le remet droit. C'est un détail d'une ligne qui rend
  // le formulaire inutilisable sur iPhone.
  const ecran = lire(ECRAN);
  assert.match(ecran, /text-\[16px\] sm:text-\[14px\]/, 'Le champ est repassé sous 16 px sur téléphone.');
});

test('★ ACQUIS — la feuille remonte au-dessus du clavier', () => {
  // Sur Android le clavier se pose PAR-DESSUS la page sans la réduire. Une
  // feuille collée en bas passe dessous avec ses résultats — on demande, la
  // réponse arrive, et elle est cachée par le clavier qui a servi à demander.
  const ecran = lire(ECRAN);
  assert.match(ecran, /window\.visualViewport/, 'La feuille ne suit plus le clavier.');
  assert.match(ecran, /height: `calc\(100% - \$\{clavier\}px\)`/);
  // Hauteur en pourcentage du conteneur, pas en `vh` : `vh` ignore le clavier.
  assert.match(ecran, /max-h-\[94%\]/, 'La feuille est repassée à une hauteur en vh.');
  assert.doesNotMatch(ecran, /max-h-\[94vh\]/);
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
