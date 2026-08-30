/**
 * AUCUNE VENTE NE RESTE SILENCIEUSE.
 *
 * ── CE QUI A RENDU CE FICHIER NÉCESSAIRE ──────────────────────────────────
 *
 * Le 28 août 2026 au matin, neuf personnes ont payé et aucune n'a reçu son
 * accès. Le serveur le savait : dix lignes « Montant null incompatible »
 * dormaient dans son journal depuis 07h33. Personne ne les lisait.
 *
 * Le propriétaire l'a appris à 10h30, par des messages WhatsApp de clients en
 * colère. Trois heures pendant lesquelles chaque nouvelle vente aggravait la
 * situation, et pendant lesquelles l'information nécessaire était déjà là.
 *
 * Le défaut de fond n'était donc pas le format des montants — celui-là est
 * corrigé et ne reviendra pas. Le défaut de fond, c'est qu'une vente pouvait
 * échouer sans que personne ne l'apprenne. Un autre défaut viendra un jour,
 * différent ; ce qui doit changer, c'est le délai avant qu'on le sache.
 *
 * ── LA RÈGLE ──────────────────────────────────────────────────────────────
 *
 * Toute vente encaissée qui n'aboutit PAS à un accès ouvert déclenche une
 * alerte immédiate. Sans exception, y compris pour les cas prévus et bénins :
 * un acheteur sans compte n'est pas une anomalie technique, mais c'est
 * quelqu'un qui a payé et qui attend.
 *
 * Et toute vente qui aboutit prévient le client. Il n'est pas forcément parti
 * de profootai.com — la boutique est publique, son lien circule sur WhatsApp —
 * et dans ce cas rien ne le ramène. Ce message est son chemin de retour.
 */

import type { Courriel } from './courriel';

/** L'adresse qui reçoit les alertes de vente. */
export const ALERTE_A = 'm09997818@gmail.com';

const enDate = (iso: string | null | undefined): string | null =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

/**
 * L'accès vient de s'ouvrir — on donne au client son chemin de retour.
 *
 * Court volontairement : il vient de payer, il veut entrer, pas lire.
 */
export function messageBienvenue(expireLe: string | null): Omit<Courriel, 'a'> {
  const echeance = enDate(expireLe);
  return {
    sujet: 'Votre accès ProFoot AI est ouvert',
    texte: [
      'Bonjour,',
      '',
      'Votre paiement est confirmé et votre accès ProFoot AI est actif' +
        (echeance ? ` jusqu'au ${echeance}` : '') +
        '.',
      '',
      'Pour commencer :',
      '',
      '1. Rendez-vous sur profootai.com',
      '2. Connectez-vous avec cette adresse e-mail, celle de votre achat',
      '3. Choisissez deux équipes et lancez votre analyse',
      '',
      'Si vous n\'arrivez pas à vous connecter, répondez simplement à ce message.',
      '',
      'Ousmane',
      'ProFoot AI — profootai.com',
    ].join('\n'),
  };
}

/**
 * Il a payé, mais aucun compte ne porte son adresse.
 *
 * Ce cas n'est pas rare et ne le sera jamais : la boutique est publique, on
 * peut y acheter sans être passé par l'application. Le message doit donc être
 * clair et sans reproche — il n'a rien fait de mal.
 */
export function messageCompteAcreer(email: string): Omit<Courriel, 'a'> {
  return {
    sujet: 'Votre paiement ProFoot AI — une étape pour ouvrir votre accès',
    texte: [
      'Bonjour,',
      '',
      'Votre paiement a bien été reçu et il est enregistré. Il reste une étape, ' +
        'et elle prend une minute.',
      '',
      'Nous n\'avons pas encore de compte ProFoot à cette adresse. C\'est elle qui ' +
        'relie votre paiement à votre accès.',
      '',
      '1. Rendez-vous sur profootai.com',
      `2. Créez votre compte avec cette adresse exactement : ${email}`,
      '3. Votre accès s\'ouvrira automatiquement, sans code à saisir',
      '',
      'Si vous avez déjà un compte sous une autre adresse, répondez à ce message ' +
        'en nous l\'indiquant : nous y transférerons votre accès nous-mêmes.',
      '',
      'Ousmane',
      'ProFoot AI — profootai.com',
    ].join('\n'),
  };
}

/**
 * L'alerte au propriétaire : une vente encaissée n'a pas ouvert d'accès.
 *
 * Elle porte tout ce qu'il faut pour agir sans rien chercher — l'adresse du
 * client, la référence de la vente, le produit, et le motif exact. La commande
 * de rattrapage est écrite dedans : au moment où on lit ce message, on n'a pas
 * envie de se souvenir de son nom.
 */
export function messageAlerteVenteNonHonoree(details: {
  email: string | null;
  venteId: string | null;
  produit: string | null;
  motif: string;
  pays?: string | null;
  moyen?: string | null;
}): Omit<Courriel, 'a'> {
  const { email, venteId, produit, motif, pays, moyen } = details;
  return {
    sujet: `ProFoot — une vente n'a PAS ouvert d'accès (${email ?? 'client inconnu'})`,
    texte: [
      'Une vente MakeTou vient d\'être encaissée sans que l\'accès s\'ouvre.',
      '',
      `Client   : ${email ?? '(adresse absente du message)'}`,
      `Vente    : ${venteId ?? '(référence absente)'}`,
      `Produit  : ${produit ?? '(nom absent)'}`,
      // `null` et non `''` : les lignes vides du message sont voulues, et un
      // filtre sur les chaînes vides les emporterait toutes.
      pays ? `Pays     : ${pays}` : null,
      moyen ? `Paiement : ${moyen}` : null,
      '',
      `Motif    : ${motif}`,
      '',
      // ── DIRE OÙ AGIR, PAS SEULEMENT QU'IL FAUT AGIR ────────────────────
      //
      // Le message se terminait par « il faut agir maintenant » suivi d'une
      // commande à taper dans un terminal. Le destinataire de cette alerte
      // lit ses courriels sur un téléphone : il ne peut pas exécuter de
      // commande, et une consigne qu'on ne peut pas suivre équivaut à pas de
      // consigne du tout.
      //
      // Depuis le 29 août l'application se répare seule dans la plupart des
      // cas. L'alerte doit donc dire ce qui est déjà en cours, et ne réclamer
      // une intervention humaine que lorsqu'il en faut vraiment une.
      'CE QUI SE FAIT TOUT SEUL',
      '',
      "Si l'acheteur n'a pas de compte, l'application le crée, crédite l'accès",
      'et lui envoie un lien pour choisir son mot de passe. En cas d\'échec,',
      "l'entretien repasse deux fois par jour, et l'acheteur est relancé",
      'automatiquement au bout de 24 h puis de 72 h.',
      '',
      "SI RIEN NE BOUGE D'ICI QUELQUES HEURES",
      '',
      "Ouvrez /admin/logs et cliquez « Livrer maintenant » : c'est le même",
      'traitement, déclenché à la main.',
      '',
      'ProFoot AI — alerte automatique',
    ]
      .filter((l): l is string => l !== null)
      .join('\n'),
  };
}
