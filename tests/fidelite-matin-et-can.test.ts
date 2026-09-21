/**
 * ★ ACQUIS — LE RENDEZ-VOUS DU MATIN, LE VERDICT D'HIER, ET LA CAN.
 *
 * ── LE FAIT QUI COMMANDE TOUT CE FICHIER ──────────────────────────────────
 *
 * Mesuré le 21 septembre 2026 sur les abonnés dont le premier mois est
 * terminé : 7 jours d'usage ou plus → 78,6 % reprennent ; 1 à 2 jours → 0 %.
 * Le réachat se joue sur le nombre de JOURS où l'on ouvre l'application.
 *
 * Trois leviers choisis par le propriétaire le même jour :
 *
 *   1. un rendez-vous chaque matin ;
 *   2. le verdict personnel de la veille, justes ET ratés ;
 *   4. pendant la trêve des championnats d'Europe, les matchs de SON public :
 *      les qualifications de la CAN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fabriqueMessageDuMatin, type ProgrammeDuMatin } from '../src/lib/campagnes/index';
import { publicDuMatin, type Terrain } from '../src/lib/campagnes/publics';
import { selectionParNom, selectionParApiId, nomAffiche } from '../src/lib/selections-africaines';

const JOUR = 86_400_000;
const PROGRAMME_VIDE: ProgrammeDuMatin = { surs: [], matchs: [], prochains: null };

const verdict = (juste: boolean, e1 = 'A', e2 = 'B') => ({
  equipe1: e1,
  equipe2: e2,
  predit: '1 - 0',
  reel: juste ? '2 - 0' : '1 - 1',
  juste,
  scoreExact: false,
});

test('★ ACQUIS — le verdict montre les justes ET les ratés', () => {
  const m = fabriqueMessageDuMatin(PROGRAMME_VIDE)({
    email: 'x@y.z',
    contexte: { abonne: true, verdict: [verdict(true, 'A', 'B'), verdict(false, 'C', 'D'), verdict(true, 'E', 'F')] },
  });
  assert.ok(m, 'Un abonné qui a un verdict hier ne reçoit rien.');
  assert.match(m!.sujet, /Hier : 2 sur 3/, 'Le sujet ne porte plus le verdict.');
  assert.match(m!.texte, /✓ A – B/, 'Les justes ne sont plus listés.');
  assert.match(m!.texte, /✗ C – D/, 'Les ratés sont de nouveau cachés : le verdict n’est plus honnête.');
});

test('★ ACQUIS — un mauvais jour renvoie vers la sélection au lieu de s’arrêter', () => {
  const m = fabriqueMessageDuMatin(PROGRAMME_VIDE)({
    email: 'x@y.z',
    contexte: { abonne: true, verdict: [verdict(false), verdict(false, 'C', 'D'), verdict(true, 'E', 'F')] },
  });
  assert.match(m!.texte, /les rencontres qu’elle lit le mieux/, 'Un jour à 1 sur 3 ne propose plus de remède.');
});

test('★ ACQUIS — un jour sans affiche annonce le prochain rendez-vous, avec la bonne affiche', () => {
  const programme: ProgrammeDuMatin = {
    surs: [],
    matchs: [],
    prochains: {
      jour: 'jeudi 24 septembre',
      matchs: [
        { dom: 'Namibie', ext: 'Congo', heure: '13:00' },
        { dom: 'Côte d’Ivoire', ext: 'Ghana', heure: '19:00' },
      ],
      affiche: { dom: 'Côte d’Ivoire', ext: 'Ghana', heure: '19:00' },
    },
  };
  const m = fabriqueMessageDuMatin(programme)({ email: 'x@y.z', contexte: { abonne: true, verdict: [] } });
  assert.ok(m, 'Un jour de trêve, le rendez-vous du matin ne part plus : c’est trois semaines de silence.');
  assert.match(m!.sujet, /Côte d’Ivoire – Ghana/, 'Le sujet annonce le match le plus matinal au lieu de l’affiche.');
  assert.match(m!.texte, /PROCHAIN RENDEZ-VOUS — JEUDI 24 SEPTEMBRE/);
});

test('★ ACQUIS — rien à dire, rien d’envoyé', () => {
  const m = fabriqueMessageDuMatin(PROGRAMME_VIDE)({ email: 'x@y.z', contexte: { abonne: true, verdict: [] } });
  assert.equal(m, null, 'Un message vide part quand même : il consomme une place pour rien.');
});

test('★ ACQUIS — les cinquante places vont d’abord aux abonnés sous sept jours', () => {
  const maintenant = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const compte = (id: string) => ({ id, email: `${id}@x.z`, creeLe: iso(maintenant - 40 * JOUR), derniereEntree: iso(maintenant) });
  const analyse = (userId: string, joursAvant: number) => ({
    userId,
    creeLe: iso(maintenant - joursAvant * JOUR),
    equipe1: null,
    equipe2: null,
    scorePredit: null,
    scoreReel: null,
    issueCorrecte: null,
    scoreCorrect: null,
    verifieeLe: null,
  });
  const comptes = [compte('habitue'), compte('debutant'), compte('curieux')];
  const t: Terrain = {
    comptes,
    parId: new Map(comptes.map((c) => [c.id, c])),
    abonnements: [
      { userId: 'habitue', plan: 'essential_monthly', statut: 'active', expireLe: iso(maintenant + 10 * JOUR), creeLe: iso(maintenant - 20 * JOUR) },
      { userId: 'debutant', plan: 'essential_monthly', statut: 'active', expireLe: iso(maintenant + 25 * JOUR), creeLe: iso(maintenant - 5 * JOUR) },
    ],
    abonnesActifs: new Set(['habitue', 'debutant']),
    ontPaye: new Set(['habitue', 'debutant']),
    // L'habitué a ouvert quinze jours ; le débutant, un seul ; le curieux
    // n'est pas abonné.
    analyses: [
      ...Array.from({ length: 15 }, (_, i) => analyse('habitue', i + 1)),
      analyse('debutant', 2),
      analyse('curieux', 1),
    ],
    derniereAnalyse: new Map([
      ['habitue', maintenant - JOUR],
      ['debutant', maintenant - 2 * JOUR],
      ['curieux', maintenant - JOUR],
    ]),
    nombreAnalyses: new Map([
      ['habitue', 15],
      ['debutant', 1],
      ['curieux', 1],
    ]),
  };
  const ordre = publicDuMatin(t).map((d) => d.userId);
  assert.equal(ordre[0], 'debutant', 'L’abonné à un seul jour d’usage ne passe plus en premier.');
  assert.ok(ordre.indexOf('habitue') < ordre.indexOf('curieux'), 'Un non-abonné passe devant un abonné.');
});

test('★ ACQUIS — les sélections africaines se reconnaissent par leur nom français et leur identifiant exact', () => {
  assert.equal(selectionParNom("Côte d'Ivoire")?.apiId, 1501);
  assert.equal(selectionParNom('Côte d’Ivoire')?.apiId, 1501, 'L’apostrophe typographique ne trouve plus la Côte d’Ivoire.');
  assert.equal(selectionParNom('Ivory Coast')?.apiId, 1501);
  assert.equal(selectionParNom('Cameroun')?.apiId, 1530);
  assert.equal(selectionParNom('Bénin')?.apiId, 1516);
  assert.equal(selectionParNom('Burkina Faso')?.apiId, 1502);
  // Les confusions que la recherche par nom commettait.
  assert.equal(selectionParNom('Congo')?.apiId, 1517, 'Le Congo est confondu avec la RD Congo.');
  assert.equal(selectionParNom('RD Congo')?.apiId, 1508);
  assert.equal(selectionParNom('Guinée')?.apiId, 1509, 'La Guinée est confondue avec la Guinée-Bissau.');
  assert.equal(selectionParNom('Guinée-Bissau')?.apiId, 1513);
  assert.equal(nomAffiche(1530, 'Cameroon'), 'Cameroun', 'Le carrousel affiche de nouveau les noms en anglais.');
  assert.equal(nomAffiche(999999, 'Inconnue FC'), 'Inconnue FC');
  assert.ok((selectionParApiId(1501)?.interet ?? 0) > (selectionParApiId(1493)?.interet ?? 0), 'La Côte d’Ivoire ne passe plus devant la Namibie.');
});

test('★ ACQUIS — chaque carte de sélection porte un identifiant que le serveur accepte', async () => {
  // Le serveur d'analyse ne connaît une équipe que par son catalogue : une
  // carte au nom inventé recevait « Équipe inconnue » (404), et l'abonné qui
  // la touchait voyait l'analyse échouer deux fois. Constaté le 21 septembre
  // 2026 sur Côte d'Ivoire–Ghana, le jour même de la mise en ligne.
  const { clubs } = await import('../src/lib/data');
  const { SELECTIONS_AFRICAINES } = await import('../src/lib/selections-africaines');
  for (const s of SELECTIONS_AFRICAINES) {
    const c = (clubs as any)[s.catalogue];
    assert.ok(c, `« ${s.nom} » porte l’identifiant « ${s.catalogue} », absent du catalogue : son analyse échouera.`);
    assert.equal(c.league, 'can', `« ${s.nom} » n’est pas rangée dans la CAN du catalogue.`);
  }
  const source = (await import('node:fs')).readFileSync('src/lib/grands-matchs-du-jour.ts', 'utf8');
  assert.doesNotMatch(source, /id: `nat-/, 'Les cartes de sélection reprennent un identifiant inventé.');
});
