/**
 * Enregistrement d'une analyse, côté serveur.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * L'historique était écrit par le NAVIGATEUR, à partir de ce que le serveur lui
 * avait renvoyé. Or un compte gratuit ne reçoit pas le score prédit ni les
 * probabilités — c'est le paywall, et c'est voulu. Le navigateur n'avait donc
 * rien à écrire dans ces colonnes.
 *
 * Le code comblait le vide par un « 2 - 1 » écrit en dur, ce qui remplissait la
 * base de scores inventés. Ce repli retiré, la colonne se vidait : sur la page
 * d'administration, une analyse sur deux affichait « — ». Faux avant, vide
 * ensuite — aucune des deux situations n'est acceptable.
 *
 * Ici, sur le serveur, l'analyse complète est disponible quel que soit l'état
 * de l'abonnement. Le score enregistré est donc toujours le vrai, pour tout le
 * monde, et il ne dépend plus de ce que le navigateur veut bien renvoyer.
 */

import { createAdminClient } from './supabase-admin';

export interface AnalyseAEnregistrer {
  userId: string;
  equipe1: { id?: string; name?: string; logo?: string; league?: string };
  equipe2: { id?: string; name?: string; logo?: string; league?: string };
  /** L'analyse complète, avant tout découpage pour les comptes gratuits. */
  donnees: any;
}

const texte = (v: unknown, max = 300): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const entier = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * Écrit l'analyse. Ne doit JAMAIS empêcher la réponse de partir : l'abonné
 * attend son analyse, et notre besoin de traçabilité ne le concerne pas.
 */
export async function enregistrerAnalyse(a: AnalyseAEnregistrer): Promise<void> {
  try {
    const d = a.donnees ?? {};
    const termine = !!d.isFinished;

    // Un match terminé porte son score RÉEL ; un match à venir ou en cours
    // porte le score PRÉDIT. Les confondre fausserait la mesure de précision,
    // qui compare justement les deux.
    const score = termine
      ? texte(d.score, 20)
      : d.predictedScore &&
          Number.isFinite(Number(d.predictedScore.team1Goals)) &&
          Number.isFinite(Number(d.predictedScore.team2Goals))
        ? `${d.predictedScore.team1Goals} - ${d.predictedScore.team2Goals}`
        : null;

    const { error } = await createAdminClient().from('analysis_history').insert({
      user_id: a.userId,
      team1_id: a.equipe1.id ?? '',
      team1_name: a.equipe1.name ?? '',
      team1_logo: a.equipe1.logo ?? '',
      team1_league: a.equipe1.league ?? '',
      team2_id: a.equipe2.id ?? '',
      team2_name: a.equipe2.name ?? '',
      team2_logo: a.equipe2.logo ?? '',
      team2_league: a.equipe2.league ?? '',
      competition: texte(d.competition, 120),
      score,
      // La confiance d'un match déjà joué n'a aucun sens : le résultat est
      // connu. La laisser à 100 gonflait artificiellement la confiance moyenne
      // affichée dans l'administration.
      confidence: termine ? null : entier(d.confidence),
      summary: texte(d.quickSummary ?? d.summary, 2000),
      is_finished: termine,
      win_prob: termine ? null : entier(d.winProb),
      draw_prob: termine ? null : entier(d.drawProb),
      lose_prob: termine ? null : entier(d.loseProb),
      analysis_data: d,
    });

    if (error) console.warn('[ANALYSE] Historique non enregistré :', error.message);
  } catch (erreur: any) {
    console.warn('[ANALYSE] Enregistrement impossible :', erreur?.message);
  }
}
