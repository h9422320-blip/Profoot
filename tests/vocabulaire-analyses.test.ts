/**
 * ★ ACQUIS — LE VOCABULAIRE DES ANALYSES EST FILTRÉ, LUI AUSSI.
 *
 * ── LE 26 AOÛT 2026 ───────────────────────────────────────────────────────
 *
 * Le filtre de vocabulaire, construit après l'alerte de la boutique, ne
 * protégeait que l'Agent VIP. Mesuré sur les quatre cents dernières analyses
 * réellement servies : CINQUANTE contenaient du vocabulaire à risque.
 *
 *     « les Havrais devront miser sur un contre »        28 fois
 *     « s'imposer sans trembler »                        22 fois
 *     « partent avec les faveurs des pronostics »         3 fois
 *
 * L'analyse est le produit principal. C'est le texte qu'un contrôle de
 * conformité lirait en premier, et il était le seul à n'être protégé par rien.
 *
 * ── CE QUE CES TESTS PROTÈGENT ────────────────────────────────────────────
 *
 *   1. les tournures observées sortent propres ET LISIBLES — un remplacement
 *      qui casse la grammaire se remarque plus vite que le mot qu'il chasse ;
 *   2. le filtre ne touche QUE la prose : un nom de club, un stade ou un
 *      chiffre qui changerait serait pire que le défaut corrigé ;
 *   3. il est branché sur le passage obligé de la route d'analyse — un filtre
 *      parfait qui ne tourne nulle part ne protège de rien, et c'est l'angle
 *      mort qui nous a déjà échappé trois fois.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  assainirAnalyse,
  remplacerVocabulaire,
  contientVocabulaireInterdit,
  CHEMINS_DE_PROSE,
} from '../src/lib/filtre-vocabulaire';

const route = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/analyze/route.ts'),
  'utf8'
);

// ── LES TOURNURES RÉELLEMENT OBSERVÉES ─────────────────────────────────────

test('★ ACQUIS — « miser » sort propre SANS casser la conjugaison', () => {
  // Le remplacement rendait le mot nu « compter » quelle que soit la forme :
  // « Real Madrid misera » devenait « Real Madrid compter ». Une phrase au
  // verbe non conjugué saute aux yeux d'un lecteur francophone.
  const cas: [string, string][] = [
    ['les Havrais devront miser sur un contre', 'les Havrais devront compter sur un contre'],
    ['Real Madrid misera sur son volume', 'Real Madrid comptera sur son volume'],
    ['les Eagles miseront sur des transitions', 'les Eagles compteront sur des transitions'],
    ['vous misez sur la possession', 'vous comptez sur la possession'],
    ['nous misons sur le pressing', 'nous comptons sur le pressing'],
  ];
  for (const [avant, attendu] of cas) {
    assert.equal(remplacerVocabulaire(avant), attendu, `« ${avant} » mal réécrit.`);
    assert.ok(!contientVocabulaireInterdit(attendu), `« ${attendu} » reste fautif.`);
  }
});

test("★ ACQUIS — « statut coté » retrouve son accent au lieu de devenir du charabia", () => {
  // Le modèle écrit parfois sans accents. « Malgré son statut cote » était pris
  // pour le mot du marché et rendu « son statut probabilité » — une phrase
  // illisible, servie à un abonné payant, pour une faute de conformité qui
  // n'existait pas.
  assert.equal(
    remplacerVocabulaire('Malgre son statut cote, Tottenham est en crise'),
    'Malgre son statut coté, Tottenham est en crise'
  );
  // Et l'adjectif correctement accentué n'a jamais été en cause : il le reste.
  const dejaJuste = 'un joueur tres bien coté sur le marche';
  assert.equal(remplacerVocabulaire(dejaJuste), dejaJuste);
});

test('★ ACQUIS — les autres tournures observées sortent lisibles', () => {
  assert.equal(
    remplacerVocabulaire("s'imposer logiquement sans trembler"),
    "s'imposer logiquement avec autorité"
  );
  assert.equal(
    remplacerVocabulaire('partent avec les faveurs des pronostics'),
    'partent avec les faveurs des analyses'
  );
});

// ── CE QUE LE FILTRE NE DOIT JAMAIS TOUCHER ────────────────────────────────

test('★ ACQUIS — le filtre ne touche pas aux noms de clubs ni aux chiffres', () => {
  const analyse: any = {
    quickSummary: 'Le Havre devra miser sur un contre.',
    competition: 'Ligue 1',
    venue: 'Stade Océane',
    date: '26 août 2026',
    kickoffISO: '2026-08-26T19:00:00+00:00',
    predictedScore: { team1Goals: 2, team2Goals: 1, reasoning: 'Paris misera sur sa possession.' },
    globalForm: {
      team1: { name: 'Paris Saint-Germain', goalsScored: 12 },
      team2: { name: 'Le Havre AC', goalsScored: 4 },
    },
    sections: [{ title: 'Bataille Tactique', icon: 'Target', content: "S'imposer sans trembler." }],
  };

  assainirAnalyse(analyse);

  // La prose est nettoyée…
  assert.equal(analyse.quickSummary, 'Le Havre devra compter sur un contre.');
  assert.equal(analyse.predictedScore.reasoning, 'Paris comptera sur sa possession.');
  assert.equal(analyse.sections[0].content, "S'imposer avec autorité.");

  // …et rien d'autre n'a bougé. Le nom du club en particulier : c'est le seul
  // motif du fichier sensible à la casse, et le seul qui pourrait le mutiler.
  assert.equal(analyse.globalForm.team1.name, 'Paris Saint-Germain');
  assert.equal(analyse.globalForm.team2.name, 'Le Havre AC');
  assert.equal(analyse.competition, 'Ligue 1');
  assert.equal(analyse.venue, 'Stade Océane');
  assert.equal(analyse.kickoffISO, '2026-08-26T19:00:00+00:00');
  assert.equal(analyse.predictedScore.team1Goals, 2);
  assert.equal(analyse.predictedScore.team2Goals, 1);
  assert.equal(analyse.sections[0].icon, 'Target');
});

test('★ ACQUIS — une analyse déjà propre ressort rigoureusement identique', () => {
  const propre = { quickSummary: 'Arsenal reçoit Aston Villa dans un match décisif.' };
  const copie = JSON.parse(JSON.stringify(propre));
  const r = assainirAnalyse(propre);
  assert.equal(r.champsNettoyes, 0);
  assert.deepEqual(propre, copie);
});

test('★ ACQUIS — une analyse absente ou malformée ne fait pas tomber la route', () => {
  // `respond` reçoit aussi des replis. Une exception ici priverait l'abonné de
  // son analyse pour un problème de vocabulaire — le remède serait pire.
  for (const valeur of [null, undefined, 'texte', 42]) {
    const r = assainirAnalyse(valeur as any);
    assert.equal(r.champsNettoyes, 0);
  }
  assert.doesNotThrow(() => assainirAnalyse({ sections: null, keyStrengths: 'pas un objet' }));
  assert.doesNotThrow(() => assainirAnalyse({ sections: [null, { content: null }] }));
});

test('★ ACQUIS — les listes de points forts sont couvertes', () => {
  const a: any = { keyStrengths: { team1: ['Capacité à miser sur le pressing'], team2: [] } };
  assainirAnalyse(a);
  assert.equal(a.keyStrengths.team1[0], 'Capacité à compter sur le pressing');
});

// ── LE BRANCHEMENT ─────────────────────────────────────────────────────────

test("★ ACQUIS — le filtre est branché sur le passage obligé de la route", () => {
  // Les quatre sorties de la route — analyse fraîche, réserve, match joué,
  // repli — passent toutes par `respond`. Le nettoyage doit y être, et AVANT
  // l'enregistrement, sinon la base conserverait le texte fautif.
  assert.match(route, /import \{ assainirAnalyse \} from "@\/lib\/filtre-vocabulaire"/);

  const debut = route.indexOf('const respond = async (');
  assert.ok(debut > 0, 'La fonction `respond` a disparu de la route.');
  const corps = route.slice(debut, debut + 2500);

  const posFiltre = corps.indexOf('assainirAnalyse(data)');
  const posEnregistrement = corps.indexOf('enregistrerAnalyse({');
  const posReponse = corps.indexOf('return NextResponse.json');

  assert.ok(posFiltre > 0, '`respond` ne nettoie plus le vocabulaire.');
  assert.ok(
    posFiltre < posEnregistrement,
    "Le nettoyage passe APRÈS l'enregistrement : la base garderait le texte fautif."
  );
  assert.ok(
    posFiltre < posReponse,
    'Le nettoyage passe après la réponse : le texte fautif partirait quand même.'
  );
});

test('★ ACQUIS — la liste des champs de prose reste explicite', () => {
  // Un parcours automatique de toutes les chaînes atteindrait les noms de
  // clubs. La liste nommée est la protection : elle doit couvrir les champs
  // longs relevés en production, et rester une liste.
  for (const attendu of [
    'quickSummary',
    'sections[].content',
    'scenarios[].content',
    'predictedScore.reasoning',
    'keyStrengths.team1[]',
    'keyStrengths.team2[]',
  ]) {
    assert.ok(
      CHEMINS_DE_PROSE.includes(attendu),
      `${attendu} n'est plus filtré alors qu'il porte de la prose en production.`
    );
  }
  for (const interdit of ['globalForm.team1.name', 'competition', 'venue', 'kickoffISO']) {
    assert.ok(
      !CHEMINS_DE_PROSE.includes(interdit),
      `${interdit} est passé sous le filtre : un nom ou une date va être réécrit.`
    );
  }
});
