import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  estErreurDeVersion,
  noterAnalyseEnCours,
  oublierAnalyseEnCours,
  rechargerUneFois,
  reprendreAnalyse,
} from '../src/lib/nouvelle-version';

/**
 * ── LE PARCOURS ENTIER, TEL QUE L'ABONNÉ LE VIT ────────────────────────────
 *
 * 16 septembre 2026. Une mise en ligne tombe pendant une analyse : la page
 * réclame un morceau renommé, Turbopack lève `ChunkLoadError`. Il faut, dans
 * l'ordre : UN rechargement, puis la MÊME analyse relancée d'elle-même — et
 * jamais une analyse relancée sur un rechargement ordinaire.
 *
 * On rejoue ici ce parcours avec un faux onglet : stockage de session et
 * rechargement comptés.
 */
function fauxOnglet() {
  const stock = new Map<string, string>();
  let rechargements = 0;
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (stock.has(k) ? stock.get(k)! : null),
    setItem: (k: string, v: string) => void stock.set(k, String(v)),
    removeItem: (k: string) => void stock.delete(k),
  };
  (globalThis as any).window = { location: { reload: () => void rechargements++ } };
  return { rechargements: () => rechargements };
}

const BALE = { id: 'fcb-2127', name: 'FC Bâle', logo: 'x.png', league: 'ucl' };
const BARCA = { id: '529', name: 'Barcelone', logo: 'y.png', league: 'ucl' };

test('★ ACQUIS — une mise en ligne pendant une analyse : un rechargement, puis la même analyse', () => {
  const onglet = fauxOnglet();

  noterAnalyseEnCours(BALE, BARCA);

  const panne = new Error('Failed to load chunk /_next/static/immutable/chunks/0666khkr2mnoq.js from module 4521');
  panne.name = 'ChunkLoadError';
  assert.ok(estErreurDeVersion(panne));
  assert.equal(rechargerUneFois(), true, 'La panne de version ne recharge plus la page.');
  assert.equal(onglet.rechargements(), 1);

  // Une deuxième erreur dans la même demi-minute ne recharge pas en boucle.
  assert.equal(rechargerUneFois(), false, 'Rechargement en boucle : la page clignoterait à l’infini.');
  assert.equal(onglet.rechargements(), 1);

  // Après le rechargement, la page relit l'analyse — clubs ENTIERS, pour qu'un
  // club hors des championnats préchargés ne s'affiche pas « Inconnu ».
  const reprise = reprendreAnalyse();
  assert.deepEqual(reprise, { club1: BALE, club2: BARCA }, 'L’analyse interrompue n’est pas relancée.');

  // Une seule fois.
  assert.equal(reprendreAnalyse(), null, 'La même analyse serait relancée à chaque rechargement.');
});

test('★ ACQUIS — un rechargement ordinaire ne relance JAMAIS une analyse', () => {
  fauxOnglet();
  noterAnalyseEnCours(BALE, BARCA);
  // Aucun rechargement de version : l'abonné a simplement rechargé la page.
  assert.equal(reprendreAnalyse(), null, 'Un simple rechargement relance un calcul que personne n’a demandé.');

  // Et une analyse qui a échoué pour de bon est oubliée.
  fauxOnglet();
  noterAnalyseEnCours(BALE, BARCA);
  oublierAnalyseEnCours();
  rechargerUneFois();
  assert.equal(reprendreAnalyse(), null);
});

test('★ ACQUIS — les trois endroits où la panne peut s’arrêter savent la réparer', () => {
  const sans = (p: string) => fs.readFileSync(p, 'utf8');

  // La barrière autour du résultat : les sections chargées à la demande y
  // tombent en premier. C'est là que la panne restait bloquée.
  const barriere = sans('src/components/BarriereDeRendu.tsx');
  assert.match(barriere, /estErreurDeVersion\(erreur\) && rechargerUneFois\(\)/,
    'La barrière du résultat retient la panne de version sans recharger : l’analyse reste invisible.');

  // La page d'analyse note le match au lancement, et le reprend au retour.
  const page = sans('src/app/(dashboard)/analyze/AnalyzeClient.tsx');
  assert.match(page, /noterAnalyseEnCours\(getClub\(activeT1\)/, 'Le match n’est plus noté au lancement.');
  assert.match(page, /const reprise = reprendreAnalyse\(\);/, 'La page ne reprend plus l’analyse interrompue.');
});
