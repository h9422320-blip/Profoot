/**
 * ★ ACQUIS — ÉCRIRE À SIX MILLE PERSONNES SANS BRÛLER LE DOMAINE.
 *
 * ── CE QUI EST EN JEU, ET CE N'EST PAS LA CAMPAGNE ────────────────────────
 *
 * Les messages partent de `noreply@profootai.com` — LA MÊME adresse qui envoie
 * les liens de mot de passe et les ouvertures d'accès après paiement.
 *
 * Si Gmail classe une campagne en indésirable, ce n'est pas la campagne qu'on
 * perd. C'est la récupération de mot de passe et la livraison des achats des
 * 437 personnes qui ont payé. Le domaine est déjà sensible : le modèle de
 * courriel de récupération a dû être refait en août parce que Gmail brûlait le
 * lien en le pré-ouvrant.
 *
 * Ces tests protègent les quatre choses qui évitent ce scénario. Aucune n'est
 * décorative, et chacune a déjà été retirée par mégarde dans un projet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const diffusion = sansCommentaires(lire('src/lib/campagnes/diffusion.ts'));
const publics = sansCommentaires(lire('src/lib/campagnes/publics.ts'));
const registre = sansCommentaires(lire('src/lib/campagnes/index.ts'));

// ── LE DOUBLON EST LE PIRE DÉFAUT POSSIBLE ─────────────────────────────────

test('★ ACQUIS — la trace est réservée AVANT l’envoi, jamais après', () => {
  // Un passage coupé à mi-chemin — délai de fonction serveur dépassé — puis
  // relancé réécrirait aux mille premiers. Recevoir deux fois la même relance
  // commerciale, c'est du courrier indésirable, et la personne le signale.
  const posTrace = diffusion.indexOf("delivery_id: cleTrace(campagne, email)");
  const posEnvoi = diffusion.indexOf('await envoyerCourriel({');
  assert.ok(posTrace > 0, 'La réservation de trace a disparu.');
  assert.ok(posEnvoi > 0, 'L’envoi a disparu.');
  assert.ok(
    posTrace < posEnvoi,
    'La trace est écrite APRÈS l’envoi : un passage interrompu réécrira à tout le monde.'
  );
});

test('★ ACQUIS — une réservation non suivie d’envoi est rendue', () => {
  // Sans cela, une panne passagère du service condamnerait définitivement ces
  // personnes : la trace dirait « écrit » pour un message jamais parti.
  assert.match(
    diffusion,
    /\.delete\(\)\.eq\('delivery_id', cleTrace\(campagne, email\)\)/,
    'La réservation n’est plus rendue quand l’envoi échoue.'
  );
});

test('★ ACQUIS — une liste de déjà-écrits illisible ARRÊTE la campagne', () => {
  // C'est le seul endroit où avaler une erreur serait catastrophique : sans
  // cette liste, la campagne repart de zéro et réécrit à tout le monde.
  assert.match(
    diffusion,
    /throw new Error\(`liste des déjà-écrits illisible/,
    'La lecture des déjà-écrits avale de nouveau son erreur.'
  );
  assert.match(
    diffusion,
    /bilan\.details\.push\(`ARRÊT : \$\{\(e as Error\)\.message\}`\);\s*return bilan;/,
    'La campagne ne s’arrête plus quand elle ignore à qui elle a déjà écrit.'
  );
});

// ── LE DÉSABONNEMENT PROTÈGE LES CLIENTS QUI RESTENT ───────────────────────

test('★ ACQUIS — chaque message porte un lien de désinscription', () => {
  // Une personne qui veut partir et ne trouve pas comment clique sur « spam ».
  // Ce clic ne la retire pas de la liste : il apprend à Gmail que le domaine
  // envoie du courrier non désiré — et emporte les liens de mot de passe.
  assert.match(
    diffusion,
    /texte: corps\.texte \+ \(await piedDePage\(email\)\)/,
    'Le pied de désinscription n’est plus ajouté aux messages.'
  );
  assert.match(diffusion, /lienDesabonnement/, 'Le lien de désinscription a disparu.');
});

test('★ ACQUIS — les désabonnés sont écartés avant tout envoi', () => {
  assert.match(
    diffusion,
    /if \(desabonnes\.has\(email\)\) \{\s*bilan\.desabonnes\+\+;\s*continue;/,
    'Une personne désabonnée peut de nouveau recevoir un message.'
  );
});

test('★ ACQUIS — le lien de désinscription est signé', () => {
  // Sans signature, `?e=quelquun@gmail.com` désabonnerait n'importe qui : il
  // suffirait de deviner une adresse.
  assert.match(diffusion, /createHmac\('sha256', secret\)/, 'La signature a sauté.');
  const route = sansCommentaires(lire('src/app/api/desabonnement/route.ts'));
  assert.match(route, /timingSafeEqual/, 'La vérification n’est plus à durée constante.');
  assert.match(route, /if \(!valide\)/, 'La signature n’est plus vérifiée du tout.');
});

// ── LE DÉBIT ───────────────────────────────────────────────────────────────

test('★ ACQUIS — les envois sont plafonnés et cadencés', () => {
  // Six mille messages d'un coup depuis un domaine qui n'en a jamais envoyé
  // cent est la définition même d'un envoi suspect.
  assert.match(diffusion, /const RYTHME_MS = 500/, 'La cadence a sauté.');
  assert.match(
    diffusion,
    /await new Promise\(\(r\) => setTimeout\(r, RYTHME_MS\)\)/,
    'L’attente entre deux envois a disparu.'
  );
  assert.match(
    diffusion,
    /if \(bilan\.envoyes >= limite\)/,
    'Le plafond par passage a disparu.'
  );
  assert.match(
    diffusion,
    /ECHECS_AVANT_ARRET/,
    'La campagne ne s’arrête plus après une série d’échecs.'
  );
});

test('★ ACQUIS — la route d’envoi simule par défaut et refuse en GET', () => {
  const route = sansCommentaires(lire('src/app/api/campagne/route.ts'));
  assert.doesNotMatch(route, /export async function GET/, 'Une porte GET a été ouverte : la clé partirait dans les journaux et l’en-tête de provenance.');
  assert.match(route, /export async function POST/);
  assert.match(
    route,
    /const simulation = corps\.simulation !== false/,
    'La simulation n’est plus le comportement par défaut : un appel sans paramètre enverrait pour de vrai.'
  );
  assert.match(route, /cleValide\(cle\)/, 'La route n’est plus protégée par la clé.');
});

// ── LES PUBLICS ────────────────────────────────────────────────────────────

test('★ ACQUIS — le message du matin ne part PAS à tout le monde', () => {
  // Écrire chaque matin aux 7 202 comptes ferait 216 000 messages par mois :
  // le moyen le plus sûr de faire classer le domaine en indésirable.
  assert.match(
    publics,
    /export function publicDuMatin\(t: Terrain, fenetreJours = 7\)/,
    'La fenêtre du public du matin a changé — vérifier le volume avant de valider.'
  );
  assert.match(
    publics,
    /if \(!compte\.derniereEntree\) continue;/,
    'Le message du matin part de nouveau à des gens jamais connectés.'
  );
});

test('★ ACQUIS — les abonnés jamais entrés sont écartés du réveil', () => {
  // Ils ont déjà leur propre relance, avec un lien de mot de passe que celle-ci
  // n'a pas. Deux messages différents le même jour à la même personne la
  // convaincraient surtout qu'on ne sait pas ce qu'on fait.
  const bloc = publics.slice(publics.indexOf('export function abonnesDormants'));
  assert.match(bloc, /if \(!compte\.derniereEntree\) continue;/);
});

test('★ ACQUIS — les inscrits du jour ne sont pas relancés', () => {
  // Écrire « vous n'avez jamais essayé » à quelqu'un qui est en train
  // d'essayer est le meilleur moyen de le braquer.
  assert.match(
    publics,
    /export function jamaisEssaye\(t: Terrain, ageMinimumHeures = 24\)/,
    'Le délai de grâce des nouveaux inscrits a disparu.'
  );
});

test('★ ACQUIS — toutes les lectures paginent', () => {
  // Supabase rend mille lignes et s'arrête SANS LE DIRE. Une lecture naïve de
  // `subscriptions` serait juste par accident aujourd'hui (500 lignes) et
  // fausse au 1001ᵉ abonnement, sans aucun message d'erreur.
  assert.match(publics, /\.range\(depart, depart \+ 999\)/, 'La pagination a sauté.');
  assert.match(
    publics,
    /if \(!data \|\| data\.length < 1000\) break;/,
    'La boucle de pagination ne sait plus s’arrêter.'
  );
});

// ── LE RÉVEIL NE VEND RIEN À QUELQU'UN QUI A DÉJÀ PAYÉ ─────────────────────

test('★ ACQUIS — le message de réveil ne renvoie pas vers la page de tarifs', () => {
  // Une relance commerciale envoyée à un client en cours d'abonnement est la
  // meilleure façon de lui apprendre qu'il paie pour quelque chose dont il se
  // passe très bien.
  const debut = registre.indexOf('function messageDeReveil');
  const fin = registre.indexOf('function messageNonPayeurs');
  const bloc = registre.slice(debut, fin);
  assert.ok(debut > 0 && fin > debut, 'Le message de réveil est introuvable.');
  assert.doesNotMatch(bloc, /\/pricing/, 'Le réveil renvoie vers les tarifs : il vend à quelqu’un qui a déjà payé.');
  assert.match(bloc, /\/analyze/, 'Le réveil ne mène plus à l’analyse.');
});

test('★ ACQUIS — le réveil ne peut pas partir deux fois dans la semaine', () => {
  assert.match(
    registre,
    /campagne: `reveil-\$\{semaine\(\)\}`/,
    'La clé du réveil ne porte plus la semaine : un abonné pourrait être relancé tous les jours.'
  );
});

test('★ ACQUIS — les campagnes du jour sont datées, les rattrapages ne le sont pas', () => {
  // Le matin et le soir doivent pouvoir repartir demain ; les deux campagnes
  // de rattrapage ne doivent JAMAIS repartir.
  assert.match(registre, /campagne: `soir-\$\{jour\(\)\}`/);
  assert.match(registre, /campagne: `matin-\$\{jour\(\)\}`/);
  assert.match(registre, /campagne: 'non-payeurs'/, 'La campagne de rattrapage est devenue datée : elle réécrirait chaque jour.');
  assert.match(registre, /campagne: 'jamais-essaye'/);
});

test('★ ACQUIS — les chiffres annoncés dans les messages sont ceux du mur', () => {
  // Le message aux non-payeurs cite 56 % et 14 %. Ce sont les chiffres calculés
  // sur des rencontres distinctes, les mêmes que la page d'accueil. Annoncer
  // 68 % — le taux compté par lignes — serait répéter exactement la faute
  // qu'on vient de corriger sur la page d'accueil.
  assert.match(registre, /56 %/, 'Le taux annoncé a changé — vérifier qu’il est bien celui des rencontres distinctes.');
  const chiffres = sansCommentaires(lire('src/lib/chiffres-publics.ts'));
  assert.match(chiffres, /tauxIssue: 56/, 'Le relevé de repli ne concorde plus avec le message.');
});
