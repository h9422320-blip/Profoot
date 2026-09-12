import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireUser } from '@/lib/subscription';
import { afficheAutorisee, donneesAffiche } from '@/lib/affiche-du-jour';

/**
 * L'AFFICHE DU JOUR EST-ELLE DISPONIBLE, ET QUE RACONTE-T-ELLE ?
 *
 * Le navigateur appelle cette route pour savoir s'il doit montrer le bouton.
 * Hors essai privé, elle rend `{ disponible: false }` et RIEN d'autre : aucune
 * donnée, aucun indice qu'une fonctionnalité existe ailleurs.
 *
 * Elle ne rend jamais de score, de pronostic ni de taux — seulement des
 * nombres d'activité, comme l'affiche elle-même.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireUser();
  // Pas d'erreur bruyante pour un visiteur non connecté : le bouton n'apparaît
  // simplement pas.
  if (!guard.ok) return NextResponse.json({ disponible: false });

  if (!afficheAutorisee(guard.user.email, guard.entitlements.premium))
    return NextResponse.json({ disponible: false });

  try {
    const sb = await createClient();
    const jour = new Date().toISOString().slice(0, 10);
    const d = await donneesAffiche(sb as any, guard.user as any, jour);
    return NextResponse.json({
      disponible: true,
      jour: d.jour,
      prenom: d.prenom,
      analysesDuJour: d.analysesDuJour,
      analysesDuMois: d.analysesDuMois,
      serie: d.serie,
      matchs: d.matchs.length,
    });
  } catch (e: any) {
    // Une lecture qui échoue ne doit pas casser la page d'analyse : le bouton
    // s'efface, l'abonné continue son travail.
    console.warn('[AFFICHE] état indisponible :', e?.message);
    return NextResponse.json({ disponible: false });
  }
}
