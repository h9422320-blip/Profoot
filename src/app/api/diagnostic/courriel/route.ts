/**
 * L'APPLICATION SAIT-ELLE ENVOYER UN COURRIEL, OUI OU NON.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ───────────────────────────────────────────
 *
 * Le rattrapage quotidien prévient les clients dont l'accès vient d'être
 * rouvert. Mais il ne s'exécute que lorsqu'il y a quelqu'un à rattraper —
 * c'est-à-dire, si tout va bien, jamais.
 *
 * Sans cette route, la seule façon de découvrir que l'envoi ne marche pas
 * serait le jour où il devait servir : un client attend, l'accès est rouvert,
 * et le message qui devait le lui dire ne part pas. On aurait remplacé une
 * panne silencieuse par une autre.
 *
 * Elle répond donc à la question tout de suite, et sans attendre l'incident.
 *
 * ── CE QU'ELLE NE PEUT PAS DEVENIR ────────────────────────────────────────
 *
 * Une route qui envoie du courrier est une arme si on peut choisir le
 * destinataire. Celle-ci n'accepte aucune adresse : elle écrit à l'adresse du
 * compte administrateur connecté, et à elle seule. Il n'y a pas de paramètre à
 * détourner, parce qu'il n'y a pas de paramètre.
 *
 * Elle exige d'ailleurs d'être administrateur — le même contrôle que le reste
 * de l'administration, répété ici parce qu'une route ne traverse pas le
 * gabarit et n'hérite d'aucune de ses protections.
 */

import { createClient as createServerClient } from '@/utils/supabase/server';
import { estAdmin } from '@/lib/admins';
import { courrielDisponible, envoyerCourriel } from '@/lib/courriel';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    return Response.json({ erreur: 'Réservé à l\'administration.' }, { status: 403 });
  }

  if (!courrielDisponible()) {
    return Response.json({
      ok: false,
      // Le diagnostic doit dire quoi faire, pas seulement que ça ne va pas.
      cause: 'RESEND_API_KEY absente du serveur',
      quoiFaire:
        'Ajoutez la variable RESEND_API_KEY dans Vercel (Settings → Environment ' +
        'Variables), cochez Production, puis redéployez.',
    });
  }

  const destinataire = user!.email!;
  const envoye = await envoyerCourriel({
    a: destinataire,
    sujet: 'Test d\'envoi ProFoot AI',
    texte: [
      'Ce message confirme que ProFoot AI sait envoyer des courriels.',
      '',
      'C\'est ce même canal qui prévient un client lorsque son accès, payé mais ' +
        'non reçu, vient d\'être rouvert automatiquement.',
      '',
      'Si vous lisez ceci, le canal fonctionne. Aucune action n\'est requise.',
      '',
      'ProFoot AI — profootai.com',
    ].join('\n'),
  });

  return Response.json({
    ok: envoye,
    destinataire,
    // On ne renvoie jamais la clé, ni même sa longueur : un diagnostic ne doit
    // pas devenir une fuite.
    ...(envoye
      ? { message: `Message envoyé à ${destinataire}. Vérifiez la boîte de réception.` }
      : {
          cause: 'Resend a refusé l\'envoi',
          quoiFaire:
            'Regardez les journaux du serveur : la réponse de Resend y est écrite ' +
            'en entier. Cause la plus fréquente : la clé n\'a pas accès au domaine ' +
            'de l\'adresse d\'expédition.',
        }),
  });
}
