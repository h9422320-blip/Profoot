import { NextResponse } from 'next/server';
import { cleAdminAttendue, cleValide } from '@/lib/admin-access';
import { livrerVentesSansCompte } from '@/lib/livraison-sans-compte';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * LIVRER LES VENTES PAYÉES SANS COMPTE, SANS PASSER PAR UN ÉCRAN.
 *
 * ── POURQUOI CETTE PORTE EXISTE À CÔTÉ DU BOUTON ──────────────────────────
 *
 * Le 29 août 2026, deux personnes avaient payé sans recevoir leur accès. Le
 * moyen de les servir était un bouton dans l'administration — donc un écran à
 * trouver, sur un téléphone, par quelqu'un qui n'a pas à chercher où réparer
 * une panne qui n'est pas la sienne. Il ne l'a pas trouvé, et les deux clients
 * ont attendu une nuit de plus.
 *
 * Une réparation qui exige qu'un humain trouve le bon écran n'est pas une
 * réparation : c'est une consigne. Cette porte permet de la déclencher depuis
 * n'importe où, en une commande, sans être connecté à l'administration.
 *
 * ── CE QUI LA PROTÈGE ─────────────────────────────────────────────────────
 *
 * La même clé que le lien d'accès personnel à l'administration, celle qui vaut
 * déjà tous les droits. Cette porte n'ouvre donc rien de plus que ce que la
 * clé ouvrait déjà — elle évite seulement le détour par l'écran.
 *
 * Elle voyage dans un en-tête, jamais dans l'adresse : une adresse s'écrit
 * dans les journaux du serveur, dans l'historique du navigateur et dans
 * l'en-tête `Referer` de la page suivante. Un secret qui traverse trois
 * endroits qu'on ne contrôle pas n'en est plus un.
 *
 * En POST, jamais en GET : un aperçu de lien, un antivirus ou un robot
 * d'indexation suivent les GET tout seuls. Créer des comptes et envoyer des
 * courriels ne doit pas pouvoir arriver parce qu'un lien a été collé quelque
 * part.
 *
 * ── CE QU'ELLE NE PEUT PAS CASSER ─────────────────────────────────────────
 *
 * Elle appelle la même fonction que le pulse, l'entretien et le bouton. Une
 * vente déjà livrée laisse une trace et se saute : l'appeler dix fois de suite
 * ne crée pas dix comptes et n'envoie pas dix courriels.
 */
export async function POST(requete: Request) {
  const attendue = cleAdminAttendue();
  if (!attendue) {
    // Dire que la porte est fermée, plutôt que de l'ouvrir : c'est la leçon
    // écrite dans `garde-cron.ts` après le repli par `user-agent`.
    console.error(
      "[LIVRAISON] REFUSÉ : ADMIN_ACCESS_KEY n'est pas configurée sur le serveur."
    );
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 });
  }

  const entete = requete.headers.get('authorization') ?? '';
  const fournie = entete.startsWith('Bearer ') ? entete.slice(7) : '';
  if (!cleValide(fournie, attendue)) {
    console.warn('[LIVRAISON] Appel refusé : clé absente ou invalide.');
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 });
  }

  // ── LA REMISE EN ORDRE PASSE PAR LA MÊME PORTE ──────────────────────────
  //
  // Elle défait ce que la livraison a fait de travers : les abonnements
  // ouverts le 29 août 2026 sur des ventes fabriquées par les scripts de test.
  // Elle n'efface rien — elle annule, ce qui se relit et se défait.
  //
  // Même porte, même clé : une seconde porte, c'est un second verrou à tenir
  // à jour, et celui qu'on oublie est toujours le bon.
  let action = '';
  try {
    const corps = await requete.clone().json();
    action = String(corps?.action ?? '');
  } catch {
    // Pas de corps, ou corps illisible : c'est une livraison ordinaire.
  }

  // La surveillance passe par la même porte, pour la même raison : pouvoir la
  // déclencher tout de suite plutôt qu'attendre l'horloge. Une alerte qu'on
  // n'a jamais vue partir n'est pas une alerte, c'est une intention.
  if (action === 'blocages') {
    const { signalerAbonnesJamaisEntres } = await import('@/lib/abonnes-jamais-entres');
    const b = await signalerAbonnesJamaisEntres();
    return NextResponse.json(b);
  }

  if (action === 'menage') {
    const { neutraliserAbonnementsDeTest } = await import('@/lib/menage-comptes-test');
    const m = await neutraliserAbonnementsDeTest();
    console.log(`[MÉNAGE] ${m.neutralises} abonnement(s) de test annulé(s).`);
    return NextResponse.json(m);
  }

  const bilan = await livrerVentesSansCompte();
  console.log(
    `[LIVRAISON] Déclenchée par la porte de service : ${bilan.livrees} livraison(s) ` +
      `sur ${bilan.examinees} vente(s) examinée(s).`
  );
  return NextResponse.json(bilan);
}
