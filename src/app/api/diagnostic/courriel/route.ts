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

/**
 * CONSTATER SANS RIEN ENVOYER.
 *
 * ── POURQUOI CETTE LECTURE EXISTE ─────────────────────────────────────────
 *
 * La question « la clé est-elle bien dans Vercel ? » ne se répond pas depuis
 * un poste de développement : `.env.local` et l'environnement de production
 * sont deux choses différentes, et les confondre a produit le 24 août 2026 un
 * « l'envoi d'e-mail n'est pas configuré du tout » qui ne décrivait que la
 * machine locale.
 *
 * Seul le serveur de production sait ce que le serveur de production a. Cette
 * lecture le lui demande, depuis un navigateur connecté en administrateur.
 *
 * ── CE QU'ELLE NE DIT JAMAIS ──────────────────────────────────────────────
 *
 * La valeur de la clé. Ni son début, ni sa fin, ni sa longueur exacte. Une
 * clé qui apparaît dans une réponse HTTP finit dans un historique de
 * navigateur, un journal, une capture d'écran. On répond par oui ou par non.
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    return Response.json({ erreur: 'Réservé à l\'administration.' }, { status: 403 });
  }

  const presente = courrielDisponible();

  return Response.json({
    // Le nom EXACT que le code lit. Une variable nommée RESEND_KEY ou
    // RESEND_API dans Vercel ne serait jamais vue.
    variableAttendue: 'RESEND_API_KEY',
    presenteSurCeServeur: presente,
    expediteur: process.env.COURRIEL_EXPEDITEUR || 'ProFoot AI <noreply@profootai.com>',
    repondreA: process.env.COURRIEL_REPONSE || 'm09997818@gmail.com',
    // Ces deux-là ont une valeur de repli : leur absence n'empêche rien.
    expediteurPersonnalise: !!process.env.COURRIEL_EXPEDITEUR,
    reponsePersonnalisee: !!process.env.COURRIEL_REPONSE,
    verdict: presente
      ? 'La clé est en place sur ce serveur. Les courriels peuvent partir.'
      : 'Aucune clé RESEND_API_KEY sur ce serveur. Ajoutez-la dans Vercel ' +
        '(Settings → Environment Variables), cochez Production, puis redéployez.',
  });
}

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
