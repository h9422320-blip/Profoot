import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
import { lancerCampagne } from '@/lib/campagnes';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * LES TROIS COURRIELS QUOTIDIENS.
 *
 * ── LA BOUCLE QUI MANQUAIT À L'APPLICATION ────────────────────────────────
 *
 * Jusqu'ici, tous les messages envoyés étaient des messages de RÉPARATION :
 * livrer un accès manquant, renvoyer un mot de passe, relancer un abonné jamais
 * entré. Personne n'entendait jamais parler de l'application quand tout allait
 * bien.
 *
 * Le résultat se mesure : 77 % des gens qui essaient ne viennent qu'un seul
 * jour, et un abonné utilise son accès 2,9 jours sur trente.
 *
 * ── POURQUOI UNE SEULE TÂCHE ET NON TROIS ─────────────────────────────────
 *
 * Les trois campagnes lisent le MÊME état — les comptes, les abonnements,
 * l'historique. Trois tâches séparées feraient trois fois cette lecture.
 *
 * Chacune ne fait quelque chose qu'à son heure : le matin ne part pas le soir,
 * et le soir ne part pas le matin. C'est l'heure d'appel qui décide, pas le
 * code — la planification Vercel appelle cette adresse trois fois par jour.
 *
 * ── POURQUOI L'HEURE EST LUE EN UTC ───────────────────────────────────────
 *
 * Abidjan, Bamako et Ouagadougou sont à UTC. Dakar aussi. C'est l'heure locale
 * de la quasi-totalité des utilisateurs, et il n'y a pas de changement d'heure
 * à gérer.
 *
 * ── CE QU'ELLE NE FAIT PAS ────────────────────────────────────────────────
 *
 * Les deux campagnes de rattrapage — les 5 052 non-payeurs et les 1 711
 * jamais-essayé — ne tournent PAS ici. Elles s'adressent une seule fois à des
 * milliers de personnes, et un envoi de cette taille se pilote à la main,
 * palier par palier, en regardant ce qui arrive entre deux. Elles passent par
 * `/api/campagne`.
 */
export async function GET(request: Request) {
  const verdict = autoriserCron(request, 'courriels');
  if (!verdict.autorise) {
    console.error(`[COURRIELS] APPEL REFUSÉ : ${verdict.raison}`);
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
  }

  const heure = new Date().getUTCHours();
  const bilans: Record<string, unknown> = {};

  /**
   * LE MATIN — ce qui se joue aujourd'hui.
   *
   * Sept heures : les gens sont réveillés, la journée de football est connue,
   * et le message a douze heures pour être lu avant les premiers coups
   * d'envoi. L'activité mesurée décolle à partir de 6 h et culmine à 11 h.
   */
  if (heure >= 6 && heure < 10) {
    bilans.matin = await lancerCampagne('matin', { limite: 400, simulation: false });
  }

  /**
   * LE SOIR — « vous aviez raison ».
   *
   * Vingt-deux heures : les matchs européens sont finis et vérifiés, et c'est
   * le second pic d'activité de la journée — presque aussi fort que celui de
   * midi. Les gens reviennent déjà à cette heure-là pour savoir si ça a
   * marché ; le message arrive avec la réponse au lieu de la leur faire
   * chercher.
   */
  if (heure >= 21 && heure < 24) {
    bilans.soir = await lancerCampagne('soir', { limite: 400, simulation: false });
  }

  /**
   * LE RÉVEIL — l'abonné qui ne vient plus.
   *
   * Onze heures, et une seule fois par semaine et par personne : la clé de
   * campagne porte le numéro de semaine. Un abonné qui paie ne doit jamais
   * recevoir de rappel deux fois dans la même semaine — c'est le moment où il
   * se demande pourquoi il paie.
   */
  if (heure >= 10 && heure < 13) {
    bilans.reveil = await lancerCampagne('reveil', { limite: 150, simulation: false });
  }

  if (!Object.keys(bilans).length) {
    return NextResponse.json({ ok: true, heure, rien: 'aucune campagne à cette heure' });
  }

  console.log(`[COURRIELS] ${heure} h UTC — ${JSON.stringify(bilans)}`);
  return NextResponse.json({ ok: true, heure, ...bilans });
}
