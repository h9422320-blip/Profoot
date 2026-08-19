import { NextResponse } from 'next/server';

/**
 * Répond immédiatement, sans rien lire ni calculer.
 *
 * Sert au diagnostic à distinguer deux pannes très différentes : « notre
 * serveur est injoignable depuis chez vous » et « notre serveur répond mais
 * une donnée met du temps à venir ». Les confondre enverrait chercher un
 * blocage réseau là où il n'y a qu'une requête lente — c'est exactement ce que
 * faisait une première version, qui interrogeait la route des compétitions et
 * déclarait le site injoignable au bout de huit secondes.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, horodatage: new Date().toISOString() });
}
