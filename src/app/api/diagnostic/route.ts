import { NextResponse } from 'next/server';

/**
 * REÇOIT LES RELEVÉS DE LA PAGE DE DIAGNOSTIC.
 *
 * POURQUOI ILS SONT ÉCRITS DANS LES JOURNAUX ET NON EN BASE
 *
 * Une table demanderait une migration à exécuter à la main avant que le premier
 * relevé n'arrive — or on attend celui d'un contact au Maroc qui essaiera
 * peut-être une seule fois. Les journaux Vercel sont lisibles immédiatement,
 * conservés, et ne demandent rien.
 *
 * AUCUNE DONNÉE PERSONNELLE
 *
 * Le pays, le navigateur, et l'issue de chaque contrôle. Ni adresse e-mail, ni
 * compte, ni adresse IP : cette page est publique et ne demande aucune
 * identification. C'est d'ailleurs tout son intérêt — quelqu'un qui n'arrive
 * pas à se connecter doit pouvoir s'en servir.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const corps = await req.json().catch(() => null);
    if (!corps || typeof corps !== 'object') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const pays = String(corps.pays ?? '?').slice(0, 4);
    const navigateur = String(corps.navigateur ?? '?').slice(0, 60);
    const systeme = String(corps.systeme ?? '?').slice(0, 20);
    const integre = corps.integre ? String(corps.integre).slice(0, 20) : null;
    const resultats = Array.isArray(corps.resultats) ? corps.resultats.slice(0, 20) : [];

    const echecs = resultats.filter((r: any) => r?.etat === 'echec');
    const detail = resultats
      .map((r: any) => `${r?.cle}=${r?.etat}${r?.detail ? `(${String(r.detail).slice(0, 60)})` : ''}`)
      .join(' ');

    // Un échec sort en erreur pour être repérable d'un coup d'œil dans les
    // journaux, au milieu du bruit ordinaire.
    const entete = `[DIAGNOSTIC] ${pays} ${systeme} ${navigateur}${integre ? ` [${integre}]` : ''}`;
    if (echecs.length > 0) {
      console.error(`${entete} — ${echecs.length} ÉCHEC(S) : ${detail}`);
    } else {
      console.log(`${entete} — tout fonctionne : ${detail}`);
    }

    return NextResponse.json({ ok: true, echecs: echecs.length });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
