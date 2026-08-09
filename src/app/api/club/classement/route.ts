import { NextResponse } from 'next/server';
import { getClassementClub, getSeasonLabel } from '@/lib/api-football';
import { requireUser } from '@/lib/subscription';

export const maxDuration = 30;

/**
 * Rang, points et forme réels d'un club dans son championnat.
 *
 * La fiche de club lisait ces valeurs dans le référentiel statique, où elles
 * sont figées depuis leur saisie. Elles viennent maintenant du classement en
 * cours.
 */
export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const nom = params.get('nom')?.trim();
  const ligue = params.get('ligue')?.trim();
  if (!nom || !ligue) {
    return NextResponse.json({ error: 'Club ou compétition manquant.' }, { status: 400 });
  }

  try {
    const classement = await getClassementClub(ligue, nom);
    return NextResponse.json({ classement, saison: getSeasonLabel(ligue) });
  } catch (erreur: any) {
    console.error('[CLASSEMENT CLUB] Échec de lecture :', erreur?.message);
    return NextResponse.json({ classement: null, saison: getSeasonLabel(ligue) });
  }
}
