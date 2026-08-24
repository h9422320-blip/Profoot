import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ★ ACQUIS — LE MENU NE FAIT PLUS CROIRE À UN VISITEUR QU'IL EST CONNECTÉ.
 *
 * ── LE DÉFAUT, ET POURQUOI IL PASSAIT INAPERÇU ────────────────────────────
 *
 * La barre latérale affichait à TOUT LE MONDE un profil « Utilisateur ·
 * Gratuit », un compteur « 0 analyse aujourd'hui » avec sa barre de
 * progression, et un bouton « Se déconnecter ». Y compris à quelqu'un qui
 * n'avait jamais eu de compte.
 *
 * Or cette barre s'affiche aussi sur les pages PUBLIQUES — /pricing,
 * /matches, /competitions, /standings, /preuves — vues par des milliers de
 * visiteurs non connectés. Mesuré le 24 août 2026 : 1 792 visites sur les
 * tarifs et 2 988 sur les pages d'analyse en sept jours.
 *
 * Du point de vue du visiteur : il se croit connecté, clique sur « Analyse
 * tactique », et le site le renvoie vers la connexion sans un mot
 * d'explication. Vu de sa place, le site bugue.
 *
 * Et il ne le signale jamais. On abandonne, on ne se plaint pas — c'est
 * pourquoi ce défaut a vécu si longtemps sans qu'aucun message ne le décrive.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * 1. Le menu sait s'il y a quelqu'un, et s'en sert.
 * 2. Rien de personnel n'est montré à un visiteur : ni profil, ni compteur,
 *    ni bouton de déconnexion.
 * 3. Le visiteur reçoit à la place une invitation à créer un compte.
 * 4. Tant que la réponse du serveur n'est pas arrivée, on n'affiche NI l'un
 *    NI l'autre — sinon le menu clignoterait à chaque ouverture de page.
 */

const SIDEBAR = join(process.cwd(), 'src/components/layout/Sidebar.tsx');
const src = readFileSync(SIDEBAR, 'utf8');

test('★ ACQUIS — le menu retient si quelqu un est connecte', () => {
  assert.ok(
    src.includes('const [connecte, setConnecte]'),
    "Le menu ne retient plus l'état de connexion. Il appelait déjà `getUser()` " +
      "et jetait la réponse : il SAVAIT qu'il n'y avait personne, et affichait " +
      'quand même un profil.'
  );

  assert.ok(
    src.includes('setConnecte(!!user)'),
    "L'état de connexion n'est plus renseigné depuis la réponse du serveur."
  );
});

test('★ ACQUIS — aucun bouton de deconnexion pour un visiteur', () => {
  // Le formulaire de déconnexion doit vivre à l'intérieur de la branche
  // `connecte ?`, jamais au niveau du dessus.
  const iCondition = src.indexOf('{connecte ? (');
  const iFormulaire = src.indexOf('<form action={logout}>');

  assert.ok(iCondition > 0, 'La condition sur l’état de connexion a disparu du bas du menu.');
  assert.ok(
    iFormulaire > iCondition,
    'Le bouton « Se déconnecter » est ressorti de la condition. Proposer de se ' +
      'déconnecter à quelqu’un qui n’est pas connecté lui fait croire qu’il l’est.'
  );
});

test('★ ACQUIS — le compteur personnel est reserve aux connectes', () => {
  assert.ok(
    src.includes('{connecte && ('),
    'Le compteur « analyses aujourd’hui » s’affiche de nouveau pour tout le ' +
      'monde. Servi à un visiteur sans compte, il montre « 0 analyse » sous une ' +
      'barre vide : un tableau de bord personnel pour quelqu’un qui n’en a pas.'
  );
});

test('★ ACQUIS — le visiteur est invite a creer un compte', () => {
  assert.ok(
    src.includes('Créer un compte'),
    "L'invitation à créer un compte a disparu. Le bas du menu serait vide pour " +
      'un visiteur — occasion manquée là où il regarde justement.'
  );
  assert.ok(
    src.includes('href="/signup"') && src.includes('href="/login"'),
    'Les deux chemins doivent rester offerts : créer un compte pour un nouveau, ' +
      'se connecter pour quelqu’un dont la session a simplement expiré.'
  );
});

test('★ ACQUIS — rien ne s affiche tant qu on ne sait pas', () => {
  assert.ok(
    src.includes('useState<boolean | null>(null)') && src.includes('{connecte !== null && ('),
    "L'état intermédiaire a disparu. Sans lui, le menu afficherait d'abord " +
      "l'invitation à s'inscrire, puis la remplacerait par le profil dès la " +
      'réponse du serveur : un clignotement à chaque ouverture de page.'
  );
});
