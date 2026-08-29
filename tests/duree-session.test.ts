/**
 * ★ ACQUIS — LA DURÉE DE SESSION EST ÉCRITE DEUX FOIS ET DOIT LE RESTER
 * IDENTIQUE.
 *
 * ── POURQUOI CE TEST EXISTE ───────────────────────────────────────────────
 *
 * Deux fichiers appliquent la même règle : le portier de requêtes, qui
 * déconnecte et renvoie vers la page de connexion, et le calcul des droits,
 * qui décide de ce à quoi la personne a accès.
 *
 * Si le portier était plus permissif que le calcul des droits, il laisserait
 * entrer quelqu'un que celui-ci tient pour anonyme. L'abonné payant verrait
 * alors le mur de paiement SANS jamais être renvoyé vers la connexion : sa
 * barre latérale afficherait son nom, et l'application lui réclamerait de
 * payer ce qu'il a déjà payé. Aucun message, aucun moyen de comprendre, aucun
 * moyen de réparer — la panne exacte que des clients décrivent par « j'ai payé
 * et je n'ai pas accès ».
 *
 * ── POURQUOI SEPT JOURS ───────────────────────────────────────────────────
 *
 * La limite était d'un jour. Mesuré le 29 août 2026 : 242 des 358 abonnés
 * actifs avaient une session périmée, et devaient retaper leur mot de passe à
 * leur prochain retour. Sur un téléphone et une connexion lente, une
 * reconnexion quotidienne imposée à quelqu'un qui a déjà payé est une friction
 * qu'aucune sécurité ne justifie ici.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/** Extrait `const MAX_SESSION_AGE_MS = … ;` et l'évalue en millisecondes. */
function dureeSession(fichier: string): number {
  const source = lire(fichier);
  const m = source.match(/MAX_SESSION_AGE_MS\s*=\s*([\d\s*]+);/);
  assert.ok(m, `${fichier} : la durée de session est introuvable.`);
  const facteurs = m![1].split('*').map((x) => Number(x.trim()));
  assert.ok(facteurs.every(Number.isFinite), `${fichier} : durée illisible.`);
  return facteurs.reduce((t, x) => t * x, 1);
}

const DROITS = 'src/lib/subscription.ts';
const PORTIER = 'src/utils/supabase/middleware.ts';

test('★ ACQUIS — les deux durées de session sont identiques', () => {
  const a = dureeSession(DROITS);
  const b = dureeSession(PORTIER);
  assert.equal(
    a,
    b,
    `Le calcul des droits dit ${a / 3600000} h et le portier ${b / 3600000} h. ` +
      `Un abonné payant peut voir le mur de paiement sans être renvoyé vers la connexion.`
  );
});

test('★ ACQUIS — la session dure sept jours', () => {
  const SEPT_JOURS = 7 * 24 * 60 * 60 * 1000;
  assert.equal(dureeSession(DROITS), SEPT_JOURS, 'Le calcul des droits n’est plus à sept jours.');
  assert.equal(dureeSession(PORTIER), SEPT_JOURS, 'Le portier n’est plus à sept jours.');
});

test('★ ACQUIS — la session ne redescend jamais sous vingt-quatre heures', () => {
  // Le seuil n'est pas arbitraire : en dessous d'un jour, un abonné qui
  // consulte le soir et revient le lendemain matin serait déconnecté entre
  // deux visites normales.
  const UN_JOUR = 24 * 60 * 60 * 1000;
  assert.ok(dureeSession(DROITS) >= UN_JOUR);
  assert.ok(dureeSession(PORTIER) >= UN_JOUR);
});

test('★ ACQUIS — le portier déconnecte localement, pas sur tous les appareils', () => {
  // Une déconnexion globale ferait tomber le téléphone de quelqu'un parce que
  // son ordinateur n'a pas servi depuis une semaine.
  const portier = lire(PORTIER);
  assert.match(portier, /signOut\(\{ scope: 'local' \}\)/, 'La déconnexion n’est plus locale.');
});
