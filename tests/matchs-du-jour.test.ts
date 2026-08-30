/**
 * ★ ACQUIS — TAPER UN MATCH DU JOUR EST LA MÊME CHOSE QUE CHOISIR DEUX ÉQUIPES.
 *
 * ── LE RISQUE QUE CES ASSERTIONS ÉCARTENT ─────────────────────────────────
 *
 * Un carrousel qui lance « son » analyse aurait été la faute la plus naturelle
 * du monde : quelques lignes, un appel à `/api/analyze`, et ça marche. Puis un
 * jour la reprise automatique est ajoutée à un chemin et pas à l'autre ; puis
 * le décompte du quota diverge ; et un abonné paie deux fois le même match sans
 * que personne ne comprenne pourquoi.
 *
 * Le carrousel ne fait donc QUE rendre deux équipes. C'est l'écran d'analyse
 * qui les reçoit, exactement comme si elles sortaient des deux sélecteurs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SOURCE = 'src/lib/grands-matchs-du-jour.ts';
const CARROUSEL = 'src/app/(dashboard)/analyze/MatchsDuJour.tsx';
const ECRAN = 'src/app/(dashboard)/analyze/AnalyzeClient.tsx';
const PAGE = 'src/app/(dashboard)/analyze/page.tsx';

test('★ ACQUIS — le carrousel ne contient AUCUNE logique d’analyse', () => {
  const s = sansCommentaires(lire(CARROUSEL));
  assert.doesNotMatch(s, /\/api\/analyze/, 'Le carrousel appelle l’analyse lui-même : le quota va diverger.');
  assert.doesNotMatch(s, /fetch\(/, 'Le carrousel parle au serveur : ce n’est plus le même flux.');
  assert.doesNotMatch(s, /consumeAnalysis/, 'Le carrousel touche au quota.');
  assert.match(s, /onChoisir\(m\)/, 'Le carrousel ne rend plus le match à son hôte.');
});

test('★ ACQUIS — le tap passe par le flux de la sélection manuelle', () => {
  // `handleQuickMatchSelect` pose les deux équipes puis appelle `handleAnalyze`,
  // qui est exactement ce que fait le bouton « Analyser le match avec l'IA ».
  const s = sansCommentaires(lire(ECRAN));
  assert.match(
    s,
    /const choisirMatchDuJour = \(m: MatchDuJour\) => \{[\s\S]{0,220}handleQuickMatchSelect\(m\.dom\.id, m\.ext\.id\);/,
    'Le tap ne passe plus par le flux existant.'
  );
  // Sans inscription au référentiel, le club s'affiche « Inconnu » et son logo
  // casse — c'est ce qu'a vécu le FC Bâle le jour de Bâle–Barcelone.
  assert.match(
    s,
    /const choisirMatchDuJour[\s\S]{0,200}enregistrerClub\(m\.dom\);[\s\S]{0,60}enregistrerClub\(m\.ext\);/,
    'Les clubs du match ne sont plus inscrits au référentiel local.'
  );
  assert.match(
    s,
    /handleQuickMatchSelect = \(hId: string, aId: string\) => \{[\s\S]{0,200}handleAnalyze\(hId, aId\)/,
    'Le flux commun ne lance plus l’analyse.'
  );
});

test('★ ACQUIS — les cinq grands championnats, et pas les autres', () => {
  // Un samedi ordinaire compte plusieurs centaines de rencontres dans le
  // monde ; un carrousel de trois cents cartes ne se parcourt pas sur un
  // téléphone.
  const s = sansCommentaires(lire(SOURCE));
  for (const l of ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1']) {
    assert.match(s, new RegExp(`LEAGUE_IDS\\.${l}`), `${l} ne fait plus partie des grands championnats.`);
  }
  assert.match(s, /GRANDS_CHAMPIONNATS\.includes\(ligue\)/, 'Le filtre par championnat a sauté.');
});

test('★ ACQUIS — un seul appel au fournisseur par jour, partagé', () => {
  // Le quota du fournisseur a frôlé les 100 % le 16 août 2026, et au-delà plus
  // aucune analyse ne fonctionne pour personne. Un appel par visiteur sur la
  // page la plus consultée du site l'épuiserait en une matinée.
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /lireReserve<MatchDuJour\[\]>/, 'La liste n’est plus lue dans la réserve partagée.');
  assert.match(s, /ecrireReserve\(cleJour/, 'La liste n’est plus rangée dans la réserve.');
  assert.match(s, /dureeJusquAMinuit\(\)/, 'La réserve ne tient plus la journée.');

  // La liste descend du SERVEUR : la calculer dans le navigateur ferait un
  // appel par visiteur, ce que la réserve partagée sert précisément à éviter.
  assert.match(sansCommentaires(lire(PAGE)), /await matchsDuJour\(\)/, 'La page serveur ne relève plus la liste.');
  assert.doesNotMatch(
    sansCommentaires(lire(CARROUSEL)),
    /matchsDuJour\(\)/,
    'Le carrousel interroge le fournisseur depuis le navigateur.'
  );
});

test('★ ACQUIS — l’heure affichée est celle du lecteur', () => {
  // La liste est mise en réserve et servie identique à tout le monde : elle ne
  // peut pas connaître le fuseau de celui qui la lit. Une liste calculée pour
  // Conakry resservie à Tokyo donnerait des heures fausses.
  const s = sansCommentaires(lire(CARROUSEL));
  assert.match(s, /heureLocale\(m\.kickoffISO/, 'L’heure ne sort plus du fuseau du lecteur.');
  assert.match(s, /suppressHydrationWarning/, 'La divergence serveur/navigateur est signalée comme une anomalie.');
});

test('★ ACQUIS — jamais de section vide', () => {
  // Un bloc au titre sans contenu se lit comme une panne.
  const s = sansCommentaires(lire(CARROUSEL));
  assert.match(s, /if \(matchs\.length === 0\)/, 'Le cas « aucun match » n’est plus traité.');
  assert.match(s, /Pas de grand match/, 'Le message du cas vide a disparu.');
  // Et avant d'en arriver là, on propose la suite du calendrier.
  assert.match(sansCommentaires(lire(SOURCE)), /getUpcomingFixtures\(7\)/, 'Le repli sur les prochains matchs a sauté.');
});

test('★ ACQUIS — une rencontre déjà jouée ne reste pas proposée', () => {
  // La réserve garde la journée entière ; le tri par heure se fait à CHAQUE
  // lecture. Sans quoi, à 22 h, le carrousel proposerait encore des rencontres
  // jouées l'après-midi.
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /function aVenir/, 'Le tri par heure a disparu.');
  assert.match(s, /Date\.now\(\) - BATTEMENT_MS/, 'Le seuil de fraîcheur n’est plus calculé à la lecture.');
});

test('★ ACQUIS — le carrousel ne peut pas élargir la page', () => {
  // Quinze cartes font 2 660 px. Mesuré dans le navigateur : sans `min-w-0`,
  // tout ancêtre « flex » s'élargit et la page entière défile horizontalement —
  // sur un téléphone, c'est la page qui part de travers, pas seulement la
  // bande de matchs.
  const s = sansCommentaires(lire(CARROUSEL));
  assert.match(s, /w-full min-w-0 space-y-2/, 'Le conteneur ne se contraint plus.');
  assert.match(s, /flex w-full min-w-0 gap-2\.5 overflow-x-auto/, 'La piste ne se contraint plus.');
});

test('★ ACQUIS — le défilement automatique ne relit pas sa position dans la page', () => {
  // `scrollLeft` est ARRONDI par le navigateur : écrire 0,4 puis relire rend 0.
  // Le pas était perdu à chaque tour et le carrousel restait immobile — mesuré,
  // pas supposé. La position se tient donc à part.
  const s = sansCommentaires(lire(CARROUSEL));
  assert.match(s, /const position = useRef\(0\)/, 'La position n’est plus tenue à part.');
  assert.match(s, /position\.current \+ PAS_PX/, 'Le pas ne s’accumule plus.');
  assert.doesNotMatch(s, /el\.scrollLeft \+ PAS_PX/, 'Le pas repart de la valeur arrondie par le navigateur.');
});

test('★ ACQUIS — le collage ne combat pas le défilement automatique', () => {
  // `scroll-snap-type` ramène la piste sur la carte la plus proche : écrire 100
  // donnait 178. Il annulait chaque pas. Il est excellent au doigt, donc on
  // l'allume au moment où la personne prend la main.
  const s = sansCommentaires(lire(CARROUSEL));
  assert.match(s, /scrollSnapType: manuel \? 'x proximity' : 'none'/, 'Le collage combat de nouveau l’animation.');
});

test('★ ACQUIS — le défilement s’arrête au doigt, et ne repart pas', () => {
  // Un carrousel qui reprend sa course pendant qu'on lit déplace la carte qu'on
  // visait au moment où l'on tape.
  const s = sansCommentaires(lire(CARROUSEL));
  assert.match(s, /onPointerDown=\{stopper\}/, 'Le doigt n’arrête plus le défilement.');
  assert.match(s, /onTouchStart=\{stopper\}/, 'Le toucher n’arrête plus le défilement.');
  assert.match(s, /onWheel=\{stopper\}/, 'La molette n’arrête plus le défilement.');
  assert.match(s, /if \(manuel \|\| matchs\.length < 2\) return;/, 'Le défilement repart après une reprise en main.');
  assert.match(s, /if \(document\.hidden\) return;/, 'L’animation tourne dans un onglet caché.');
  assert.match(s, /prefers-reduced-motion/, 'Le réglage « animations réduites » n’est plus respecté.');
});

test('★ ACQUIS — les cartes restent prenables au doigt', () => {
  // 168 × 88 px : deux cartes et demie tiennent sur un écran de 390 px, ce qui
  // montre qu'il y en a d'autres derrière. Bien au-delà des 44 px d'une zone de
  // tap confortable.
  const s = sansCommentaires(lire(CARROUSEL));
  const l = s.match(/w-\[(\d+)px\] min-h-\[(\d+)px\]/);
  assert.ok(l, 'La taille des cartes n’est plus fixée.');
  assert.ok(Number(l![1]) >= 140, 'Les cartes sont trop étroites pour rester lisibles.');
  assert.ok(Number(l![2]) >= 44, 'Les cartes sont plus basses qu’une zone de tap confortable.');
});

test('★ ACQUIS — aucun vocabulaire de paris', () => {
  const s = lire(CARROUSEL) + lire(SOURCE);

  // « pari » seul attraperait Paris, et « mise » attraperait « mise en page ».
  // Une assertion qui crie au loup finit par être désarmée : on ne retient que
  // les mots qui n'ont pas d'autre usage.
  for (const mot of ['parier', 'parieur', 'pronostic', 'bookmaker', 'paris sportif']) {
    assert.doesNotMatch(
      s,
      new RegExp(`${mot}s?`, 'i'),
      `Le mot « ${mot} » est apparu : ce n'est pas ce que vend ProFoot.`
    );
  }
});
