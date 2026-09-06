/**
 * OÙ ARRIVENT LES SIGNAUX DE LA MESURE MAISON.
 *
 * ── ELLE NE DOIT JAMAIS GÊNER UN VISITEUR ─────────────────────────────────
 *
 * Cette route est appelée à chaque page ouverte et à chaque page quittée, sur
 * un téléphone en 3G. Elle répond donc immédiatement, sans rien attendre, et
 * ne renvoie jamais d'erreur : une statistique perdue n'a aucune conséquence,
 * une page ralentie en a une.
 *
 * ── CE QU'ELLE ACCEPTE, ET RIEN D'AUTRE ───────────────────────────────────
 *
 * Le corps vient du navigateur : il ne mérite aucune confiance. Chaque champ
 * est borné avant d'atteindre la base — un chemin de deux cents caractères,
 * une durée plafonnée à quatre heures, un identifiant réduit à sa longueur
 * utile. Sans ces bornes, n'importe qui pourrait remplir la table.
 *
 * ── LE PAYS VIENT DE L'EN-TÊTE, PAS DU CLIENT ─────────────────────────────
 *
 * Comme pour le paiement : une valeur envoyée par le navigateur se falsifie en
 * trois secondes. Cloudflare pose le vrai pays dans `CF-IPCountry`.
 */

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { compterTentative } from '@/lib/limite-partagee';
import { clientIp, isRateLimited } from '@/lib/rateLimit';
import { createClient as createServerClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/** Au-delà, ce n'est plus une visite : c'est un onglet oublié ouvert. */
const DUREE_MAX_MS = 4 * 60 * 60 * 1000;

const borner = (v: unknown, max: number): string =>
  String(v ?? '').trim().slice(0, max);

export async function POST(req: Request) {
  // Répondre « reçu » quoi qu'il arrive : le navigateur n'attend pas, et un
  // code d'erreur ne servirait qu'à salir la console du visiteur.
  const recu = () => new Response(null, { status: 204 });

  try {
    const corps = await req.json().catch(() => null);
    if (!corps || typeof corps !== 'object') return recu();

    const vueId = borner(corps.vueId, 40);
    if (!vueId) return recu();

    // ── UNE MESURE NE DOIT PAS POUVOIR NOYER LA BASE ────────────────────────
    //
    // Cette route écrit sans rien demander : c'est nécessaire, puisqu'elle
    // enregistre le passage de visiteurs anonymes. Mais rien ne bornait le
    // NOMBRE d'appels. Un script pouvait insérer des millions de lignes dans
    // la table des visites, gonfler la base et fausser tous les chiffres — au
    // point de rendre la mesure inutilisable, donc de détruire précisément ce
    // qu'elle sert à voir.
    //
    // CENT VINGT PAR HEURE ET PAR VISITEUR. Une visite normale ouvre une
    // dizaine de pages, chacune comptant deux signaux — arrivée et départ.
    // Cent vingt laissent donc largement la place à quelqu'un qui navigue
    // beaucoup, et coupent net un automate.
    //
    // La clé est l'adresse IP. Elle se change, oui — mais en changer à chaque
    // requête coûte à l'attaquant, et le but n'est pas d'empêcher
    // l'entêtement : c'est d'empêcher qu'un simple script lancé depuis un
    // poste remplisse la base en une nuit.
    //
    // Le refus reste un 204, comme tout le reste ici : le navigateur d'un
    // visiteur ordinaire ne doit jamais voir d'erreur à cause de la mesure.
    const empreinte = clientIp(req) ?? 'inconnu';

    // ── DEUX PALIERS : LE VISITEUR NE COÛTE RIEN, LE SCRIPT EST COMPTÉ ────
    //
    // ── CE QUI A CÉDÉ LE 5 SEPTEMBRE 2026 ────────────────────────────────
    //
    // Cette limite comptait en base pour TOUT LE MONDE : une lecture PLUS une
    // écriture dans `cache_api` à chaque page ouverte, puis autant à chaque
    // page quittée. Quatre opérations par visite, sur une route qui part à
    // chaque page — robots compris. Et `cache_api` est exactement la table où
    // vivent la fiabilité apprise et la sélection du jour : le compteur de
    // visites martelait la table dont le produit dépend le plus. À 23 h 01, la
    // base a cessé de répondre pendant quarante et une minutes.
    //
    // ── POURQUOI DEUX PALIERS PLUTÔT QU'UN COMPTEUR EN MÉMOIRE ───────────
    //
    // Tout passer en mémoire aurait suffi à sauver la base, mais aurait rouvert
    // ce que le test « ★ ACQUIS — les écritures de mesure sont bornées »
    // protège : un compteur en mémoire repart de zéro à chaque instance neuve,
    // et Vercel en démarre sans arrêt. Un script décidé aurait retrouvé le
    // moyen d'insérer des millions de lignes.
    //
    // Alors on sépare les deux populations, parce qu'elles ne se ressemblent
    // pas :
    //
    //   — un visiteur ordinaire ouvre quelques pages par heure. Sous vingt, il
    //     est compté en mémoire et ne touche JAMAIS la base ;
    //   — un script en envoie des milliers. Il franchit les vingt en quelques
    //     secondes et bascule alors sur `compterTentative`, le compteur en
    //     base — durable, partagé entre toutes les instances, qui survit aux
    //     redémarrages. C'est lui qui l'arrête.
    //
    // Le coût en base devient donc proportionnel à l'abus, et non au trafic.
    // Presque personne ne l'atteint ; celui qui l'atteint est précisément
    // celui contre qui la limite existe.
    const PALIER_GRATUIT = 20;
    const FENETRE_MS = 60 * 60 * 1000;

    if (isRateLimited(empreinte, 'mesure-libre', PALIER_GRATUIT, FENETRE_MS)) {
      const limite = await compterTentative('mesure', empreinte, 120, FENETRE_MS);
      if (limite.bloque) return recu();
    }

    const admin = createAdminClient();

    // ── LE DÉPART : on complète la ligne posée à l'arrivée ──────────────────
    if (corps.type === 'depart') {
      const duree = Number(corps.dureeMs);
      if (!Number.isFinite(duree) || duree < 0) return recu();

      await admin
        .from('visites_pages')
        .update({ duree_ms: Math.round(Math.min(duree, DUREE_MAX_MS)) })
        .eq('vue_id', vueId);

      return recu();
    }

    // ── L'ARRIVÉE ──────────────────────────────────────────────────────────
    const chemin = borner(corps.chemin, 200);
    if (!chemin.startsWith('/')) return recu();

    // L'administration ne se mesure pas elle-même. Le contrôle est répété ici :
    // le navigateur pourrait envoyer n'importe quoi.
    if (chemin.startsWith('/admin')) return recu();

    const ordre = Math.min(200, Math.max(1, Number(corps.ordre) || 1));

    // Le compte, s'il y en a un. Une visite anonyme reste parfaitement valable :
    // c'est même la majorité, et c'est celle qu'on cherche à convertir.
    let compteId: string | null = null;
    try {
      // ── L'IDENTITÉ SE LIT SANS APPELER SUPABASE ─────────────────────────
      //
      // `getUser()` est un appel RÉSEAU : il envoie le jeton à Supabase pour
      // le faire valider. Sur une route qui part à chaque page ouverte, c'est
      // un aller-retour par visite, pour la seule colonne `compte_id`.
      //
      // `getClaims()` fait mieux SANS RIEN CÉDER sur la sûreté : les jetons de
      // ce projet sont signés en ES256 (vérifié le 5 septembre 2026 sur
      // `/auth/v1/.well-known/jwks.json`), donc asymétriques. La bibliothèque
      // récupère la clé publique une fois, la garde, et vérifie ensuite la
      // signature EN LOCAL. Un jeton forgé est refusé exactement comme avant ;
      // simplement, plus personne ne traverse le réseau pour l'apprendre.
      //
      // Si un jour ce projet repassait à des jetons symétriques (HS256),
      // `getClaims()` retomberait tout seul sur `getUser()` : on perdrait le
      // gain, jamais la vérification.
      const sb = await createServerClient();
      const { data } = await sb.auth.getClaims();
      const sub = data?.claims?.sub;
      compteId = typeof sub === 'string' ? sub : null;
    } catch {
      compteId = null;
    }

    const pays =
      (req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || '')
        .trim()
        .toUpperCase()
        .slice(0, 2) || null;

    await admin.from('visites_pages').insert({
      vue_id: vueId,
      visite_id: borner(corps.visiteId, 40) || vueId,
      chemin,
      ordre,
      pays: pays === 'XX' || pays === 'T1' ? null : pays,
      mobile: corps.mobile === true,
      compte_id: compteId,
    });

    // ── C'EST ICI QUE PARTENT LES COURRIELS DU JOUR ────────────────────────
    //
    // Pas par une tâche planifiée. Trois avaient été déclarées le 1er septembre
    // 2026 — 7 h 10, 11 h 10, 21 h 40 UTC — et le lendemain à 17 h 41, elles
    // n'avaient produit aucun message. Zéro. Pendant ce temps l'entretien
    // quotidien, lui, avait bien tourné : à 14 h 11, l'heure d'aucune tâche.
    // C'est une visite de page qui l'avait déclenché.
    //
    // Dans cette application, ce qui tourne vraiment, ce sont les visites. On
    // s'appuie donc dessus. Cette route est la plus fréquentée du site — elle
    // est appelée à chaque page ouverte — ce qui en fait le meilleur battement
    // de cœur disponible.
    //
    // `after()` est indispensable et non décoratif : une fonction serveur est
    // GELÉE dès la réponse envoyée. Un `void (async () => …)()` serait tué au
    // milieu de l'envoi, et laisserait la marque du jour posée sans que les
    // messages soient partis — donc rien jusqu'au lendemain.
    //
    // Le coût pour le visiteur est nul : il a déjà reçu sa réponse. Et hors des
    // trois fenêtres horaires — vingt heures sur vingt-quatre — le déclencheur
    // rend la main avant même de toucher la base.
    after(async () => {
      const { declencherCampagnesDuJour } = await import('@/lib/campagnes/declencheur');
      await declencherCampagnesDuJour();
    });

    // ── LE RELEVÉ DES OCCASIONS SE TIENT À JOUR PAR LA MÊME PORTE ────────
    //
    // Il devait l'être par une tâche planifiée. Découvert le 6 septembre 2026
    // au matin : cette tâche demandait deux cent trente secondes quand
    // l'hébergeur coupe à soixante. Elle était tuée avant d'écrire, et n'a donc
    // JAMAIS rien produit — le relevé servi ce matin-là n'existait que parce
    // qu'il avait été bâti à la main depuis un poste.
    //
    // Le raccrocher ici est le remède que ce dépôt applique déjà aux courriels,
    // pour la même raison : les visiteurs passent, les tâches planifiées non.
    //
    // Le coût pour le visiteur reste nul — il a sa réponse — et pour la base
    // presque nul : `rafraichirSiNecessaire` rend la main immédiatement tant
    // que le relevé a moins d'une heure et demie, ce qui est le cas vingt-trois
    // fois sur vingt-quatre.
    after(async () => {
      try {
        const { rafraichirSiNecessaire } = await import('@/lib/forme-occasions');
        const r = await rafraichirSiNecessaire();
        if (r.lance) console.log(`[OCCASIONS] Relevé repris par une visite : ${r.raison}.`);
      } catch {
        // Sans conséquence : le relevé précédent continue de servir.
      }
    });

    return recu();
  } catch {
    // Une table absente, une base injoignable : la visite continue comme si de
    // rien n'était. C'est le seul comportement acceptable pour une mesure.
    return new Response(null, { status: 204 });
  }
}
