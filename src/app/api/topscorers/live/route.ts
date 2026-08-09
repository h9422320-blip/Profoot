import { NextResponse } from 'next/server';
import { getSeasonLabel, getTopScorers } from '@/lib/api-football';
import { requireUser } from '@/lib/subscription';

export const maxDuration = 60;

const LIGUES = ['epl', 'laliga', 'seriea', 'ligue1'];

const TTL = 30 * 60 * 1000;
const cache = new Map<string, { data: any; at: number }>();

/**
 * Meilleurs buteurs réels des grands championnats.
 *
 * La page Statistiques affichait un classement écrit à la main — Haaland
 * 29 buts, Lewandowski 26 — figé sur une saison révolue et présenté comme
 * l'actualité. Ces chiffres viennent désormais d'API-Football, et restent vides
 * tant que la saison n'a pas commencé plutôt que d'afficher ceux d'avant.
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const enCache = cache.get('all');
  if (enCache && Date.now() - enCache.at < TTL) {
    return NextResponse.json(enCache.data);
  }

  try {
    const paires = await Promise.all(
      LIGUES.map(async (ligue) => [ligue, await getTopScorers(ligue)] as const)
    );

    const data = {
      buteurs: Object.fromEntries(paires),
      saison: getSeasonLabel('epl'),
    };
    cache.set('all', { data, at: Date.now() });
    return NextResponse.json(data);
  } catch (erreur: any) {
    console.error('[BUTEURS LIVE] Échec de lecture :', erreur?.message);
    return NextResponse.json({ buteurs: {}, saison: getSeasonLabel('epl') });
  }
}
