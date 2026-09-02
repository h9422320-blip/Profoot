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

test('★ ACQUIS — le réveil n’annonce jamais une échéance déjà passée', () => {
  // Le 1er septembre 2026, la simulation a sorti :
  //     ob42654@gmail.com — « Votre accès ProFoot court jusqu'au 7 août »
  // Un mois en arrière. La personne était bien active — par une ligne SANS
  // date — mais traînait une ancienne ligne échue, et c'est celle-là que le
  // message citait. Annoncer une échéance dépassée à quelqu'un qui a payé, c'est
  // lui dire qu'il n'a plus rien alors qu'il a encore tout.
  const bloc = publics.slice(publics.indexOf('export function abonnesDormants'));
  assert.match(
    bloc,
    /a\.expireLe &&\s*new Date\(a\.expireLe\)\.getTime\(\) > maintenant/,
    'Le réveil peut de nouveau citer une date d’expiration passée.'
  );
});

// ── LE QUOTA EST PARTAGÉ AVEC LES MESSAGES VITAUX ──────────────────────────

test('★ ACQUIS — une campagne ne peut pas vider le quota du jour', () => {
  // Le 1er septembre 2026, la première campagne réelle s'est arrêtée sur :
  //     429 — "You have reached your daily email sending quota."
  //
  // L'offre en cours autorise CENT messages par jour, et c'est le MÊME
  // compteur qui sert au lien de mot de passe oublié et à l'ouverture d'accès
  // envoyée à quelqu'un qui vient de payer.
  //
  // Sans ce budget : la campagne du matin part à 7 h 10, consomme les cent
  // messages en cinquante secondes, et le premier client qui paie à 9 h ne
  // reçoit pas son accès. On aurait automatisé la panne qu'on a passé trois
  // semaines à réparer.
  assert.match(diffusion, /const BUDGET_QUOTIDIEN = Math\.max\(/, 'Le budget quotidien a disparu.');
  assert.match(
    diffusion,
    /Number\(process\.env\.COURRIEL_BUDGET_QUOTIDIEN\) \|\| 50/,
    'Le budget par défaut a changé — vérifier qu’il laisse la moitié du quota aux messages vitaux.'
  );
  assert.match(
    diffusion,
    /if \(bilan\.envoyes >= budgetRestant\)/,
    'Le budget ne coupe plus la boucle d’envoi : le plafond demandé pourrait le dépasser.'
  );
});

test('★ ACQUIS — le budget est compté en base, pas en mémoire', () => {
  // Trois campagnes tournent dans trois appels de fonction serveur différents,
  // et chaque appel démarre à zéro. Un compteur en mémoire les laisserait
  // consommer le budget chacune de son côté — donc le triple.
  assert.match(diffusion, /\.eq\('provider', 'campagne'\)/, 'Le décompte du jour ne lit plus les traces.');
  assert.match(diffusion, /\.gte\('received_at', minuit\.toISOString\(\)\)/, 'Le décompte ne se limite plus à aujourd’hui.');
});

test('★ ACQUIS — un décompte illisible bloque les envois plutôt que de les laisser passer', () => {
  // Mieux vaut n'écrire à personne aujourd'hui que de priver d'accès quelqu'un
  // qui a payé.
  assert.match(
    diffusion,
    /if \(error\) return BUDGET_QUOTIDIEN;/,
    'Une lecture ratée du budget laisse de nouveau partir la campagne entière.'
  );
});

test('★ ACQUIS — la simulation n’est pas bridée par le budget', () => {
  // Elle n'envoie rien, et doit pouvoir montrer la liste entière même quand le
  // quota du jour est épuisé — c'est justement ce moment-là qu'on veut inspecter.
  assert.match(diffusion, /if \(!options\.simulation\) \{\s*const dejaPartis = await envoyesAujourdhui\(\)/);
});

// ── LE PIÈGE DU PAYS À LA CAISSE ───────────────────────────────────────────

test('★ ACQUIS — la notice prévient du pays avant d’envoyer à la caisse', () => {
  // La boutique MakeTou est guinéenne. Sa page de paiement s'ouvre sur
  // « Guinea » quel que soit le visiteur, et affiche donc :
  //
  //     ProFoot AI — Accès Essentiel : 31 242 GNF
  //
  // Vérifié le 2 septembre 2026 : en passant le pays à la Côte d'Ivoire sur
  // cette même page, le prix devient « 2 000 F CFA ». Le montant prélevé est
  // le bon — c'est l'affichage qui trompe.
  //
  // Un acheteur à Abidjan à qui l'on vient d'annoncer 2 000 FCFA lit
  // « 31 242 », quinze fois le prix, et s'en va. Sur 1 301 personnes parties
  // en caisse, 469 ont payé ; 244 ont essayé au moins deux fois sans jamais
  // aboutir, l'une d'elles dix-neuf fois.
  //
  // Aucun paramètre d'adresse ne pré-choisit le pays — ?country=CI, ?pays=CI
  // et ?country_code=CI ont tous été essayés, tous rendent la page en GNF.
  // Cette notice est donc le SEUL endroit où l'acheteur peut encore être
  // prévenu.
  const notice = sansCommentaires(lire('src/components/NoticePaiement.tsx'));
  assert.match(
    notice,
    /choisissez d&apos;abord votre pays/i,
    'L’avertissement sur le pays a disparu de la notice.'
  );
  assert.match(notice, /31 242 GNF/, 'L’exemple chiffré a disparu : « francs guinéens » seul ne parle à personne.');
});

// ── LES COURRIELS PARTENT SANS DÉPENDRE D'UNE TÂCHE PLANIFIÉE ──────────────

test('★ ACQUIS — le déclencheur vit sur la route la plus fréquentée', () => {
  // Trois tâches planifiées ont été déclarées le 1er septembre 2026 — 7 h 10,
  // 11 h 10, 21 h 40 UTC. Le lendemain à 17 h 41, elles avaient produit ZÉRO
  // message. Pendant ce temps l'entretien quotidien avait bien tourné, à
  // 14 h 11 : l'heure d'aucune tâche. C'est une visite de page qui l'avait
  // déclenché.
  //
  // Dans cette application, ce qui tourne vraiment, ce sont les visites.
  const mesure = sansCommentaires(lire('src/app/api/mesure/route.ts'));
  assert.match(mesure, /declencherCampagnesDuJour/, 'Le déclencheur a été retiré de la route de mesure.');
  assert.match(
    mesure,
    /after\(async \(\) => \{[\s\S]{0,200}declencherCampagnesDuJour/,
    'Le déclenchement ne passe plus par after() : une fonction serveur est GELÉE dès la réponse envoyée, et l’envoi serait tué en plein milieu.'
  );
});

test('★ ACQUIS — une campagne ne peut pas partir deux fois dans la journée', () => {
  // Des centaines de visites par heure passent par ce déclencheur. Sans marque,
  // chacune relancerait la campagne.
  const d = sansCommentaires(lire('src/lib/campagnes/declencheur.ts'));
  assert.match(
    d,
    /const marque = \(campagne: string\) =>\s*`campagne-partie:\$\{campagne\}:\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}`/,
    'La marque du jour a disparu ou changé de forme.'
  );
  const posMarque = d.indexOf('await ecrireReserve(cle');
  const posEnvoi = d.indexOf('await lancerCampagne(');
  assert.ok(posMarque > 0 && posEnvoi > posMarque,
    'La marque est posée APRÈS l’envoi : deux visiteurs simultanés paieraient deux fois la lecture complète des comptes.');
});

test('★ ACQUIS — hors des trois fenêtres, le déclencheur ne touche pas la base', () => {
  // Vingt heures sur vingt-quatre. Sans ce retour anticipé, chaque page ouverte
  // du site ferait une lecture de réserve pour rien.
  const d = sansCommentaires(lire('src/lib/campagnes/declencheur.ts'));
  const posRdv = d.indexOf('const rdv = RENDEZ_VOUS.find');
  const posSortie = d.indexOf('if (!rdv) return null;');
  const posLecture = d.indexOf('await lireReserve');
  assert.ok(posRdv > 0 && posSortie > posRdv, 'La sortie anticipée a disparu.');
  assert.ok(posSortie < posLecture, 'La lecture de réserve passe avant le contrôle de l’heure.');
});

test('★ ACQUIS — les trois rendez-vous couvrent matin, réveil et soir', () => {
  const d = sansCommentaires(lire('src/lib/campagnes/declencheur.ts'));
  assert.match(d, /campagne: 'matin', debut: 6, fin: 10/, 'La fenêtre du matin a changé.');
  assert.match(d, /campagne: 'reveil', debut: 10, fin: 13/, 'La fenêtre du réveil a changé.');
  assert.match(d, /campagne: 'soir', debut: 21, fin: 24/, 'La fenêtre du soir a changé.');
});
