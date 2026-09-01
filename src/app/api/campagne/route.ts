import { NextRequest, NextResponse } from 'next/server';
import { CAMPAGNES, lancerCampagne, type NomCampagne } from '@/lib/campagnes';

/**
 * DÉCLENCHER UNE CAMPAGNE À LA MAIN.
 *
 * ── POURQUOI CETTE PORTE EXISTE ───────────────────────────────────────────
 *
 * Trois campagnes tournent toutes seules par tâche planifiée. Les deux de
 * rattrapage — 5 052 non-payeurs, 1 711 jamais-essayé — ne le peuvent pas :
 * elles s'adressent une fois à des milliers de personnes, et un envoi de cette
 * taille se pilote, palier par palier, en regardant ce qui arrive entre deux.
 *
 * ── POURQUOI SEULEMENT EN POST, ET AVEC LA CLÉ DANS L'EN-TÊTE ─────────────
 *
 * En GET, l'adresse partirait dans les journaux du serveur, dans l'historique
 * du navigateur, et dans l'en-tête de provenance de la première page visitée
 * ensuite — clé comprise. Un explorateur de moteur de recherche qui tomberait
 * sur ce lien déclencherait un envoi de masse en le suivant.
 *
 * ── LE MODE SIMULATION EST LE MODE PAR DÉFAUT DU BON SENS ─────────────────
 *
 * `simulation: true` compte qui serait écrit, montre les vingt-cinq premiers,
 * et n'envoie rien. C'est le seul moyen honnête de vérifier une sélection avant
 * de la lancer sur cinq mille personnes — et une erreur de sélection ne se
 * rattrape pas : un courriel parti est parti.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function cleValide(fournie: string): boolean {
  const attendue = process.env.ADMIN_ACCESS_KEY ?? '';
  if (!attendue || fournie.length !== attendue.length) return false;
  // Comparaison à durée constante : une comparaison ordinaire s'arrête au
  // premier caractère faux, et le temps de réponse révèle alors combien de
  // caractères étaient justes.
  let ecart = 0;
  for (let i = 0; i < attendue.length; i++) {
    ecart |= fournie.charCodeAt(i) ^ attendue.charCodeAt(i);
  }
  return ecart === 0;
}

export async function POST(req: NextRequest) {
  const entete = req.headers.get('authorization') ?? '';
  const cle = entete.startsWith('Bearer ') ? entete.slice(7) : '';

  if (!cleValide(cle)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let corps: { campagne?: string; limite?: number; simulation?: boolean } = {};
  try {
    corps = await req.json();
  } catch {
    /* Un corps vide est traité comme une demande sans campagne : la réponse
       ci-dessous dit alors quelles campagnes existent. */
  }

  const nom = String(corps.campagne ?? '') as NomCampagne;
  if (!CAMPAGNES.includes(nom)) {
    return NextResponse.json(
      { error: 'Campagne inconnue', campagnes: CAMPAGNES },
      { status: 400 }
    );
  }

  // ── LE PLAFOND EST PLAFONNÉ ─────────────────────────────────────────────
  //
  // Cinq cents messages à deux par seconde font déjà quatre minutes, et la
  // fonction serveur est coupée à cinq. Au-delà, on ne gagnerait rien : on
  // perdrait le bilan du passage, qui est la seule chose permettant de savoir
  // où reprendre.
  const limite = Math.min(Math.max(1, Number(corps.limite) || 100), 500);
  const simulation = corps.simulation !== false;

  try {
    const bilan = await lancerCampagne(nom, { limite, simulation });
    return NextResponse.json({ ok: true, simulation, ...bilan });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message ?? 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
