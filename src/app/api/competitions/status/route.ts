import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/subscription';
import { getAllCompetitionStatuses } from '@/lib/competition-status';
import { LEAGUE_IDS } from '@/lib/api-football';

export const maxDuration = 60;

/**
 * État réel de chaque compétition (début de saison, leader, champion),
 * calculé depuis API-Football. Remplace les statuts écrits à la main qui
 * dataient de la saison passée.
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  try {
    const statuses = await getAllCompetitionStatuses(Object.keys(LEAGUE_IDS));
    return NextResponse.json(
      { statuses },
      { headers: { 'Cache-Control': 'private, max-age=1800' } }
    );
  } catch (error) {
    console.error('[COMPETITIONS_STATUS] Erreur:', error);
    return NextResponse.json({ statuses: {} });
  }
}
