import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/subscription';
import { getLiveTeams } from '@/lib/teams-live';

// Jusqu'à 10 appels API-Football en parallèle au premier chargement.
export const maxDuration = 60;

/**
 * Équipes sélectionnables, saison en cours, chargées depuis API-Football.
 * Remplace le référentiel écrit à la main, qui datait de 2025-2026 et ne
 * contenait aucune équipe hors des cinq grands championnats.
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  try {
    const teams = await getLiveTeams();
    return NextResponse.json(
      { teams, count: teams.length },
      // Le résultat est identique pour tous : on autorise la mise en cache.
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    );
  } catch (error) {
    console.error('[TEAMS] Erreur de chargement:', error);
    return NextResponse.json({ teams: [], count: 0 }, { status: 200 });
  }
}
