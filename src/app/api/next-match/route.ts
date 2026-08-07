import { NextResponse } from 'next/server';
import { clubs } from '@/lib/data';
import { requireUser } from '@/lib/subscription';
import { findLiveTeam, getLiveTeams, slugify } from '@/lib/teams-live';

export const maxDuration = 30;

/**
 * Prochain adversaire d'une équipe.
 *
 * Cette route interrogeait auparavant Gemini avec la recherche Google pour
 * « deviner » l'adversaire : lent, approximatif, et surtout dépendant d'un
 * quota Google épuisé — la sélection automatique ne fonctionnait donc jamais.
 * API-Football connaît le calendrier officiel : c'est une simple requête,
 * fiable et instantanée.
 */
export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');
  if (!teamId) {
    return NextResponse.json({ error: 'Missing teamId' }, { status: 400 });
  }

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return NextResponse.json({ nextTeamId: null });

  try {
    // L'identifiant peut venir du référentiel statique (héritage) ou de la
    // liste chargée en direct : on résout l'identifiant API dans les deux cas.
    const liveTeam = await findLiveTeam(teamId);
    let apiId: number | null = liveTeam?.apiId ?? null;

    if (!apiId && Object.prototype.hasOwnProperty.call(clubs, teamId)) {
      const legacy: any = clubs[teamId];
      const match = String(legacy.logo || '').match(/teams\/(\d+)\.png/);
      if (match) apiId = Number(match[1]);
    }
    if (!apiId) return NextResponse.json({ nextTeamId: null });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${apiId}&next=8`,
      { headers: { 'x-apisports-key': key }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return NextResponse.json({ nextTeamId: null });

    const data = await res.json();
    const upcoming: any[] = data.response || [];

    // Un match amical n'a pas d'intérêt pour un pronostic : on privilégie la
    // prochaine rencontre officielle (championnat, coupe, compétition
    // européenne) et on ne retombe sur un amical que s'il n'y a rien d'autre.
    const isFriendly = (f: any) => /friendl|amic/i.test(f?.league?.name || '');
    const fixture = upcoming.find((f) => !isFriendly(f)) || upcoming[0];

    // Aucun match programmé (trêve, équipe éliminée) : on laisse l'utilisateur
    // choisir librement son second club plutôt que d'imposer un choix faux.
    if (!fixture) return NextResponse.json({ nextTeamId: null });

    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const opponent = home.id === apiId ? away : home;

    // On renvoie l'identifiant utilisable par le sélecteur : le slug de la
    // liste en direct si l'équipe y figure, sinon celui du référentiel.
    const teams = await getLiveTeams();
    const liveOpponent = teams.find((t) => t.apiId === opponent.id);
    const legacyId = Object.keys(clubs).find((k) =>
      String((clubs as any)[k].logo || '').includes(`/teams/${opponent.id}.png`)
    );

    return NextResponse.json({
      nextTeamId: liveOpponent?.id || legacyId || slugify(opponent.name),
      opponentName: opponent.name,
      opponentApiId: opponent.id,
      competition: fixture.league?.name || null,
      date: fixture.fixture?.date || null,
      venue: fixture.fixture?.venue?.name || null,
      isHome: home.id === apiId,
    });
  } catch (error) {
    console.error('[NEXT_MATCH] Erreur:', error);
    return NextResponse.json({ nextTeamId: null });
  }
}
