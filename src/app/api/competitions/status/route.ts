import { NextResponse } from 'next/server';
import { getAllCompetitionStatuses } from '@/lib/competition-status';
import { LEAGUE_IDS } from '@/lib/api-football';

export const maxDuration = 60;

/**
 * État réel de chaque compétition (début de saison, leader, champion),
 * calculé depuis API-Football. Remplace les statuts écrits à la main qui
 * dataient de la saison passée.
 */
export async function GET() {
  // Lecture publique : cette route ne renvoie que des données de football
  // librement consultables — classements, leaders, matchs joués. Aucun contenu
  // payant, aucune donnée de compte. Elle alimente une page désormais indexée
  // par Google, et exiger un compte y rendait la page vide pour un visiteur.

  try {
    const statuses = await getAllCompetitionStatuses(Object.keys(LEAGUE_IDS));
    return NextResponse.json(
      { statuses },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
  } catch (error) {
    console.error('[COMPETITIONS_STATUS] Erreur:', error);
    return NextResponse.json({ statuses: {} });
  }
}
