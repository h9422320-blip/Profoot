/**
 * LA PASSERELLE RÉPOND-ELLE, OUI OU NON — ET SINON, POURQUOI EXACTEMENT.
 *
 * POURQUOI CETTE ROUTE EXISTE
 *
 * L'Agent VIP affichait « le réseau semble instable » sans qu'on puisse savoir
 * ce que le fournisseur avait réellement répondu. Ce message est écrit par le
 * navigateur quand l'appel échoue : il ne dit rien de la cause, et il a masqué
 * trois pannes différentes en une nuit — crédit épuisé, paramètre refusé,
 * modèle inconnu.
 *
 * Cette route fait le plus petit appel possible à chaque passerelle et rend le
 * verdict brut. Elle transforme une soirée de suppositions en une réponse.
 *
 * CE QU'ELLE NE DIVULGUE JAMAIS
 *
 * Aucune clé, aucun secret, aucune donnée d'abonné. Seulement : le nom de la
 * passerelle, si elle répond, et le message d'erreur du fournisseur.
 *
 * CE QU'ELLE COÛTE
 *
 * Cinq jetons par passerelle, soit une fraction de centime — et le résultat est
 * conservé une minute, pour qu'un rafraîchissement répété ne se transforme pas
 * en dépense.
 */

import { passerellesDisponibles, soldeOpenRouter } from '@/lib/passerelle-claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

let dernier: { quand: number; resultat: any } | null = null;
const FRAICHEUR = 60_000;

export async function GET() {
  if (dernier && Date.now() - dernier.quand < FRAICHEUR) {
    return Response.json({ ...dernier.resultat, enReserve: true });
  }

  const passerelles = passerellesDisponibles();
  const solde = await soldeOpenRouter();

  const essais = [];
  for (const p of passerelles) {
    const debut = Date.now();
    try {
      const reponse = await p.client().messages.create({
        model: p.modele,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'dis ok' }],
      });
      const texte = reponse.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');
      essais.push({
        passerelle: p.nom,
        modele: p.modele,
        etat: 'RÉPOND',
        ms: Date.now() - debut,
        texte: texte.slice(0, 40),
      });
    } catch (e: any) {
      essais.push({
        passerelle: p.nom,
        modele: p.modele,
        etat: 'ÉCHEC',
        ms: Date.now() - debut,
        // Le message du fournisseur, tel quel : c'est lui qui dit la vérité.
        code: e?.status ?? null,
        type: e?.error?.error?.type ?? e?.name ?? null,
        message: String(e?.message ?? e).slice(0, 400),
      });
    }
  }

  const resultat = {
    configurees: passerelles.length,
    soldeOpenRouter: solde ? `${solde.restant.toFixed(2)} $` : 'illisible',
    essais,
    quand: new Date().toISOString(),
  };

  dernier = { quand: Date.now(), resultat };
  return Response.json(resultat);
}
