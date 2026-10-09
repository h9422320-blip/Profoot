/**
 * RÉPONSE À L'ABONNÉ VIP QUI SE CROYAIT TROMPÉ.
 *
 * Il a payé 15 000 FCFA avec `…59@gmail.com` et se connecte avec
 * `…392@gmail.com`. Son accès existait depuis la veille, sur l'autre adresse.
 * Il voyait 15 % de son analyse et a porté plainte à la boutique.
 *
 * Le message part aux DEUX adresses : il ne lit peut-être que l'une des deux,
 * et c'est précisément le problème qu'on corrige.
 *
 * Le remboursement n'est ni promis ni refusé ici : c'est l'argent du
 * propriétaire, la décision lui appartient.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

export const A = ['hiyekodjidji392@gmail.com', 'hiyekodjidji59@gmail.com'];
export const SUJET = 'Votre accès VIP est rétabli — nos excuses';
export const TEXTE = `Bonjour,

Votre accès VIP fonctionne, depuis maintenant. Vous n'avez rien à
repayer, et rien à réinstaller : reconnectez-vous simplement avec
hiyekodjidji392@gmail.com, l'adresse que vous utilisez d'habitude.

CE QUI S'EST PASSÉ

Vous avez payé 15 000 FCFA le 8 octobre, et votre accès VIP s'est bien
ouvert dans la minute. Mais il s'est ouvert sur l'adresse que vous aviez
saisie à la boutique : hiyekodjidji59@gmail.com.

Or vous vous connectez avec une autre adresse : hiyekodjidji392@gmail.com.
C'est sur celle-là que vous faites vos analyses — 34 à ce jour. Notre
application relie l'accès à l'adresse du paiement ; elle n'avait aucun
moyen de deviner que les deux boîtes étaient à vous.

Vous avez donc payé, l'accès existait, et vous tombiez quand même sur la
demande de paiement. Vu de votre côté, c'était impossible à comprendre
autrement que comme une tromperie. Nous comprenons parfaitement votre
réaction, et nous vous présentons nos excuses : ce n'est pas à vous de
deviner ce genre de chose.

CE QUE NOUS AVONS FAIT

Nous avons déplacé votre accès VIP sur le compte que vous utilisez. Il
est actif jusqu'au 8 octobre 2027, et il vous donne :

  • l'analyse complète, sans aucun pourcentage masqué ;
  • l'Agent VIP, à qui vous pouvez poser vos questions sur un match ;
  • toutes les prévisions de buts et de scores.

Vous n'avez rien à faire d'autre que vous reconnecter.

SI VOUS SOUHAITEZ MALGRÉ TOUT ÊTRE REMBOURSÉ

C'est votre droit et nous le respecterons. Répondez simplement à ce
message en le demandant, et le responsable s'en occupe personnellement.
Nous préférons un client remboursé qu'un client qui se sent floué.

Encore une fois, toutes nos excuses pour ces heures d'incompréhension.

L'équipe ProFoot AI
`;

if (process.argv[1]?.includes('_repondre-hiyeko')) {
  const { envoyerCourriel, courrielDisponible } = await import('../src/lib/courriel.js');
  console.log(`À : ${A.join(', ')}\nSujet : ${SUJET}\n${'─'.repeat(70)}\n${TEXTE}${'─'.repeat(70)}`);
  if (!process.argv.includes('--envoyer')) console.log('\n(rien envoyé — ajouter --envoyer)');
  else if (!courrielDisponible()) console.error('\n✖ RESEND_API_KEY absente ici : passer par /api/courrier.');
  else for (const a of A) console.log(a, (await envoyerCourriel({ a, sujet: SUJET, texte: TEXTE })) ? '✔ parti' : '✖ refusé');
}
