/**
 * FAIRE PARTIR LES COURRIELS DU JOUR SANS DÉPENDRE D'UNE TÂCHE PLANIFIÉE.
 *
 * ── CE QUI S'EST PASSÉ LE 2 SEPTEMBRE 2026 ────────────────────────────────
 *
 * Trois tâches planifiées ont été déclarées la veille : 7 h 10, 11 h 10 et
 * 21 h 40 UTC. Le lendemain, à 17 h 41, le décompte des courriels partis
 * donnait :
 *
 *     2026-09-01 : 143 messages   (envoyés à la main)
 *     2026-09-02 :   5 messages   (envoyés à la main)
 *
 * Zéro. Ni le message du matin, ni le réveil de 11 h. Le travail de la journée
 * — relances, surveillance — était bien passé, mais à 14 h 11, ce qui n'est
 * l'heure d'aucune tâche : c'est l'entretien paresseux, celui que déclenche une
 * simple visite de page.
 *
 * La cause probable est le nombre de tâches : l'offre d'entrée de l'hébergeur
 * en autorise deux, et le projet en déclarait déjà deux avant d'en ajouter
 * trois. Mais la cause exacte importe moins que le constat : dans cette
 * application, ce qui tourne vraiment, ce sont les visites.
 *
 * ── ALORS ON S'APPUIE SUR CE QUI MARCHE ───────────────────────────────────
 *
 * Le site reçoit des centaines de visites par heure. Chacune peut, pour un coût
 * dérisoire, vérifier s'il est l'heure d'un courriel et le faire partir. Aucune
 * planification à configurer, rien à activer, et cela continue de fonctionner
 * si l'hébergeur change.
 *
 * ── POURQUOI CE N'EST PAS UN BRICOLAGE ────────────────────────────────────
 *
 * C'est exactement le mécanisme que l'application emploie déjà pour son
 * entretien quotidien — reconstruire le mur, vérifier les pronostics, rouvrir
 * les accès payés. Il a fait ses preuves : c'est LUI qui a tourné aujourd'hui,
 * pendant que les tâches planifiées ne faisaient rien.
 *
 * La différence tient à la cadence. L'entretien se contente d'une fois toutes
 * les vingt heures ; ici il faut trois rendez-vous distincts dans la journée.
 * Chaque campagne porte donc sa propre marque, et ne peut partir qu'une fois
 * par jour — ou par semaine pour le réveil.
 *
 * ── LE COÛT, QUI EST LA CONDITION DE TOUT ─────────────────────────────────
 *
 * Une lecture de réserve par appel, et rien de plus quand ce n'est pas l'heure.
 * Hors des trois fenêtres — soit vingt heures sur vingt-quatre — la fonction
 * rend la main avant même de toucher la base.
 */

import { lireReserve, ecrireReserve } from '../api-football';
import { lancerCampagne, type NomCampagne } from './index';

/**
 * Les trois rendez-vous, en heures UTC.
 *
 * UTC est l'heure locale d'Abidjan, Bamako, Ouagadougou et Dakar — là où sont
 * les utilisateurs. Il n'y a pas de changement d'heure à gérer.
 *
 * Les fenêtres sont larges — trois à quatre heures — parce qu'on dépend des
 * visites : personne ne garantit qu'il y en aura une à 7 h 10 pile. Large, la
 * fenêtre attrape forcément quelqu'un ; et la marque du jour empêche que le
 * message parte deux fois.
 */
const RENDEZ_VOUS: { campagne: NomCampagne; debut: number; fin: number; limite: number }[] = [
  // Le matin : la journée de football est connue, et le message a douze heures
  // pour être lu avant les premiers coups d'envoi.
  { campagne: 'matin', debut: 6, fin: 10, limite: 400 },
  // Le réveil des abonnés silencieux, en milieu de matinée. Sa clé porte la
  // semaine : une même personne n'est jamais réveillée deux fois en sept jours.
  { campagne: 'reveil', debut: 10, fin: 13, limite: 150 },
  // Le soir : les matchs européens sont finis et vérifiés, et c'est le second
  // pic d'activité de la journée.
  { campagne: 'soir', debut: 21, fin: 24, limite: 400 },
];

/** Une marque par campagne et par jour. C'est elle qui interdit le doublon. */
const marque = (campagne: string) =>
  `campagne-partie:${campagne}:${new Date().toISOString().slice(0, 10)}`;

/**
 * Fait partir le courriel du moment, s'il est l'heure et s'il n'est pas parti.
 *
 * Ne lève jamais et n'attend rien de l'appelant : elle est faite pour être
 * lancée depuis `after()`, une fois la réponse déjà envoyée au visiteur.
 */
export async function declencherCampagnesDuJour(): Promise<string | null> {
  try {
    const heure = new Date().getUTCHours();
    const rdv = RENDEZ_VOUS.find((r) => heure >= r.debut && heure < r.fin);

    // Vingt heures sur vingt-quatre, on s'arrête ici — avant toute lecture.
    if (!rdv) return null;

    const cle = marque(rdv.campagne);
    const dejaFait = await lireReserve<string>(cle).catch(() => null);
    if (dejaFait?.contenu && !dejaFait.expiree) return null;

    // ── LA MARQUE EST POSÉE AVANT L'ENVOI ────────────────────────────────
    //
    // Deux visiteurs à la même seconde liraient tous deux « pas encore parti »
    // et lanceraient tous deux la campagne. La diffusion résisterait — sa
    // contrainte d'unicité par destinataire n'en laisserait pas passer deux —
    // mais on paierait deux fois la lecture complète des comptes, des
    // abonnements et de l'historique.
    //
    // Trente heures de validité : assez pour couvrir la journée, pas assez
    // pour bloquer celle de demain.
    await ecrireReserve(cle, new Date().toISOString(), 30 * 60 * 60 * 1000);

    const bilan = await lancerCampagne(rdv.campagne, {
      limite: rdv.limite,
      simulation: false,
    });

    const resume =
      `[CAMPAGNE] ${rdv.campagne} à ${heure} h UTC — ` +
      `${bilan.envoyes} envoyé(s), ${bilan.dejaEcrits} déjà écrit(s), ${bilan.echecs} échec(s)`;
    console.log(resume);
    return resume;
  } catch (e) {
    // Une campagne qui échoue ne doit jamais abîmer la page qui l'a déclenchée.
    console.warn('[CAMPAGNE] Déclenchement impossible :', (e as Error)?.message);
    return null;
  }
}
