/**
 * RÉPONSE À UN ABONNÉ QUI DOUTE DE SES PREMIÈRES ANALYSES.
 *
 * Maman Moussa Ibrahim a écrit franchement qu'il n'était pas satisfait, tout
 * en pensant qu'il s'y était mal pris. Ses chiffres disent l'inverse : dix
 * analyses justes sur seize. Le message lui rend ses propres chiffres et lui
 * donne les trois leviers qui comptent, mesurés.
 *
 *   npx tsx scripts/_repondre-moussa.mts            (montre, n'envoie rien)
 *   npx tsx scripts/_repondre-moussa.mts --envoyer
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { envoyerCourriel, courrielDisponible } = await import('../src/lib/courriel.js');

const A = 'mamanmoussaibrahim982@gmail.com';
const SUJET = 'Vos analyses ProFoot : vous réussissez mieux que vous ne le pensez';

const TEXTE = `Bonjour Maman Moussa,

Merci pour votre message. Vous avez pris le temps de dire honnêtement ce
qui n'allait pas, et vous avez même ajouté que vous vous y étiez peut-être
mal pris. C'est rare, et c'est précieux : cela nous permet de vous aider
vraiment.

J'ai donc regardé vos analyses une par une. Voici ce qu'elles disent.

VOS CHIFFRES

Vous avez lancé 16 analyses depuis votre inscription. Les 16 ont été
confrontées au résultat réel du match. Dix sont justes.

Dix sur seize, c'est 62 %. Notre moyenne générale est de 53 % sur les
matchs de clubs. Vous êtes donc AU-DESSUS, pas en dessous. Vos toutes
premières analyses — Chelsea contre Arsenal, Barcelone contre Valence,
Inter contre Naples, Monaco contre Lens — sont toutes tombées justes.

Vous avez sans doute gardé en mémoire les six qui ont manqué. C'est
normal, tout le monde fait ça. Mais ce n'est pas ce que disent vos
chiffres.

LES TROIS CHOSES QUI CHANGENT TOUT

1. REGARDEZ L'INDICATEUR DE CONFIANCE, C'EST LE PLUS IMPORTANT

Sous chaque analyse, l'application affiche « Tendance très forte »,
« Tendance nette », « Issue incertaine »… Ce n'est pas décoratif. Nous
avons vérifié ce que chaque niveau tient réellement, sur des milliers
d'analyses passées :

    Tendance très forte  →  juste 76 fois sur 100
    Tendance forte       →  juste 68 fois sur 100
    Tendance nette       →  juste 61 fois sur 100
    La rencontre penche  →  juste 48 fois sur 100
    Issue incertaine     →  juste 38 fois sur 100

C'est le levier le plus puissant dont vous disposez. Si vous ne reteniez
qu'une seule chose de ce message : privilégiez les rencontres où
l'application annonce une tendance forte ou très forte, et méfiez-vous de
celles qu'elle dit incertaines. Elle vous prévient honnêtement — encore
faut-il l'écouter.

2. LE MATCH NUL EST NOTRE POINT AVEUGLE, ET NOUS LE DISONS

Un match sur quatre se termine sur un nul. Aucun modèle de ce type ne
sait les annoncer : nous l'avons mesuré encore cette semaine, sur plus de
3 000 rencontres, et toutes les façons d'annoncer davantage de nuls font
PERDRE en justesse.

Deux de vos six analyses manquées portaient sur des matchs terminés 0-0 :
Lettonie contre Chypre, et Hongrie contre Irlande du Nord. Ce n'est pas
vous qui vous y êtes mal pris — c'est la limite de l'outil, et nous
préférons vous la dire que vous laisser la découvrir.

Concrètement : quand deux équipes de niveau proche s'affrontent et que
l'application annonce une issue incertaine, c'est souvent un match à
laisser passer.

3. LES MATCHS DE L'ÉCRAN D'ACCUEIL, VOTRE QUESTION PRÉCISE

Vous demandez comment obtenir les meilleures analyses du jour, celles que
nous affichons sur l'écran d'accueil. La réponse est simple : ce sont les
mêmes analyses, sur des matchs choisis.

Chaque matin, l'application prépare à l'avance les grandes rencontres de
la journée. Elle a donc pour elles toutes les données : compositions,
absents, forme récente, cotes du marché quand elles existent. Il vous
suffit de toucher une de ces cartes sur l'écran d'accueil pour ouvrir
l'analyse déjà prête.

Une rencontre que vous cherchez vous-même dans le sélecteur fonctionne
aussi, mais l'application n'a pas toujours autant d'informations dessus —
surtout pour les petits championnats.

UN DERNIER POINT, QUI VOUS CONCERNE DIRECTEMENT

Les rencontres entre pays sont ce que notre moteur fait de mieux : 57 %
de vainqueurs trouvés, contre 53 % sur les clubs. Vous en avez analysé
beaucoup cette semaine — vous avez eu le bon réflexe.

Si vous voulez vérifier par vous-même : le mur des preuves, sur le site,
montre les pronostics émis AVANT les matchs, à côté du résultat réel.
Rien n'y est ressaisi après coup.

Votre accès Essentiel est actif jusqu'au 27 octobre. Écrivez-nous quand
vous voulez, à cette adresse : je lis chaque message, et une question
précise sur un match nous aide autant qu'elle vous aide.

Bonne continuation, et merci encore pour votre franchise.

L'équipe ProFoot AI
`;

const envoyer = process.argv.includes('--envoyer');
console.log(`À : ${A}\nSujet : ${SUJET}\n${'─'.repeat(70)}\n${TEXTE}${'─'.repeat(70)}`);
if (!envoyer) {
  console.log('\n(rien envoyé — ajouter --envoyer)');
} else if (!courrielDisponible()) {
  console.error('\n✖ RESEND_API_KEY absente : rien ne peut partir.');
  process.exitCode = 1;
} else {
  const ok = await envoyerCourriel({ a: A, sujet: SUJET, texte: TEXTE });
  console.log(ok ? '\n✔ Message envoyé.' : '\n✖ Envoi refusé — voir le message ci-dessus.');
  if (!ok) process.exitCode = 1;
}
