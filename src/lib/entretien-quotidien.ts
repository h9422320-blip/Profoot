/**
 * L'ENTRETIEN QUOTIDIEN, ET SA GARANTIE DE S'EXÉCUTER.
 *
 * CE QUI NE MARCHAIT PAS
 *
 * La chaîne était correcte — vérifier les pronostics, reconstruire le mur,
 * juger les rencontres, apprendre — mais elle ne partait jamais. Une seule
 * exécution enregistrée en base, le 20 août à 00 h 22, alors que la
 * planification annonce 5 h 37. Le mur de preuves restait donc figé jusqu'à ce
 * qu'on le reconstruise à la main, chaque jour.
 *
 * Le défaut est le pire de tous : la tâche refusait l'appel et rendait 401,
 * sans rien écrire nulle part. Aucune erreur, aucune alerte, aucune trace —
 * juste un mur qui ne bougeait plus.
 *
 * DEUX DÉCLENCHEURS PLUTÔT QU'UN
 *
 *   1. La planification quotidienne, quand elle veut bien partir.
 *   2. LE RÉVEIL PARESSEUX : la page publique du mur vérifie, en la servant,
 *      que l'entretien date de moins de vingt heures. Sinon elle le relance en
 *      arrière-plan, sans faire attendre le visiteur.
 *
 * Le second ne dépend d'aucun planificateur, d'aucun jeton, d'aucun réglage
 * dans une interface tierce. Tant qu'une personne ouvre le site une fois par
 * jour — et c'est le cas, il y a des centaines de visites quotidiennes —,
 * l'entretien a lieu.
 *
 * IL NE PEUT PAS TOURNER DEUX FOIS EN MÊME TEMPS
 *
 * Un verrou en base, posé avant de commencer. Deux visiteurs simultanés ne
 * lancent pas deux reconstructions concurrentes.
 */

import { createAdminClient } from './supabase-admin';
import { lireReserve, ecrireReserve } from './api-football';

/** Au-delà, l'entretien est considéré comme dû. */
const FRAICHEUR_MAX_MS = 20 * 60 * 60 * 1000;

/** Durée du verrou : au-delà, on considère que l'exécution précédente est morte. */
const VERROU_MS = 10 * 60 * 1000;

const CLE_DERNIER = 'entretien:dernier';
const CLE_VERROU = 'entretien:verrou';

export interface ResultatEntretien {
  lance: boolean;
  raison: string;
  etapes: { nom: string; ok: boolean; detail: string }[];
  dureeMs: number;
}

/**
 * Exécute une étape sans jamais laisser son échec arrêter les suivantes.
 *
 * C'est le point qui change tout : la chaîne était écrite en `try` unique, et
 * une seule étape en défaut emportait toutes celles d'après. Le mur ne se
 * reconstruisait pas parce que la vérification des paiements avait échoué —
 * deux choses qui n'ont rien à voir.
 */
async function etape(
  nom: string,
  travail: () => Promise<string>,
  journal: { nom: string; ok: boolean; detail: string }[]
): Promise<void> {
  const debut = Date.now();
  try {
    const detail = await travail();
    journal.push({ nom, ok: true, detail });
    console.log(`[ENTRETIEN] ${nom} : ${detail} (${Date.now() - debut} ms)`);
  } catch (e: any) {
    const detail = String(e?.message ?? e ?? 'erreur inconnue').slice(0, 200);
    journal.push({ nom, ok: false, detail });
    console.error(`[ENTRETIEN] ${nom} A ÉCHOUÉ : ${detail}`);
  }
}

/** Quand l'entretien a-t-il réellement tourné pour la dernière fois ? */
export async function dernierEntretien(): Promise<Date | null> {
  try {
    const r = await lireReserve<string>(CLE_DERNIER);
    const t = r?.contenu ? new Date(r.contenu) : null;
    return t && !isNaN(t.getTime()) ? t : null;
  } catch {
    return null;
  }
}

/**
 * Lance l'entretien complet s'il est dû.
 *
 * `forcer` court-circuite le contrôle de fraîcheur — utilisé par la
 * planification, qui sait pourquoi elle appelle.
 */
export async function entretenirSiNecessaire(forcer = false): Promise<ResultatEntretien> {
  const debut = Date.now();
  const etapes: { nom: string; ok: boolean; detail: string }[] = [];

  if (!forcer) {
    const dernier = await dernierEntretien();
    if (dernier && Date.now() - dernier.getTime() < FRAICHEUR_MAX_MS)
      return {
        lance: false,
        raison: `déjà fait il y a ${Math.round((Date.now() - dernier.getTime()) / 60000)} min`,
        etapes,
        dureeMs: Date.now() - debut,
      };
  }

  // ── LE VERROU ─────────────────────────────────────────────────────────────
  const verrou = await lireReserve<string>(CLE_VERROU).catch(() => null);
  if (verrou?.contenu && !verrou.expiree)
    return { lance: false, raison: 'déjà en cours', etapes, dureeMs: Date.now() - debut };

  await ecrireReserve(CLE_VERROU, new Date().toISOString(), VERROU_MS);

  // ── LA CHAÎNE, ÉTAPE PAR ÉTAPE, CHACUNE ISOLÉE ────────────────────────────

  // ── EN PREMIER : CEUX QUI ONT PAYÉ SANS RECEVOIR LEUR ACCÈS ─────────────
  //
  // Placé avant tout le reste parce que c'est la seule étape où quelqu'un
  // attend. Un mur de preuves reconstruit une heure plus tard ne coûte rien ;
  // un client qui a payé et qui ne peut pas entrer demande un remboursement.
  //
  // Le 22 août 2026, trois personnes étaient dans ce cas — l'une depuis deux
  // jours — et la seule alerte a été un client assez patient pour écrire un
  // mail. Compter sur la plainte comme détection, c'est ne détecter que les
  // clients qui se plaignent.
  await etape(
    'Rouvrir les accès payés mais non reçus',
    async () => {
      const { rattraperAccesManquants } = await import('./acces-manquants');
      const r = await rattraperAccesManquants(true);
      const morceaux = [`${r.repares} accès rouvert(s) sur ${r.ventesEncaissees} vente(s)`];
      if (r.repares) morceaux.push(`${r.prevenus} personne(s) prévenue(s)`);
      if (r.enAttenteInscription.length)
        morceaux.push(`${r.enAttenteInscription.length} en attente d'inscription`);
      if (r.echecs.length) morceaux.push(`${r.echecs.length} ÉCHEC(S)`);
      return morceaux.join(' — ');
    },
    etapes
  );

  await etape(
    'Vérifier les pronostics',
    async () => {
      const { verifierPronostics } = await import('./precision-reelle');
      const r: any = await verifierPronostics(300);
      return `${r?.verifiees ?? 0} analyse(s) vérifiée(s)`;
    },
    etapes
  );

  await etape(
    'Juger les rencontres terminées',
    async () => {
      const { jugerRencontresTerminees } = await import('./calibrage');
      const r = await jugerRencontresTerminees();
      return `${r.jugees} nouvelle(s) sur ${r.examinees} examinée(s)`;
    },
    etapes
  );

  await etape(
    'Reconstruire le mur de preuves',
    async () => {
      const { construirePreuves } = await import('./preuves');
      const r = await construirePreuves();
      if (r.erreur) throw new Error(r.erreur);
      return `${r.matchs} match(s), ${r.reussites} réussite(s), ${r.creees} nouvelle(s)`;
    },
    etapes
  );

  // ── LA COURBE DE PRÉCISION S'ÉTAIT ARRÊTÉE LE 24 AOÛT ────────────────────
  //
  // Cet entretien reconstruisait le mur sans jamais enregistrer le relevé du
  // jour. Le seul endroit qui l'écrivait était la tâche planifiée de minuit —
  // celle-là même dont le fichier prévient qu'elle se fait couper avant la
  // fin, faute de temps d'exécution. Résultat mesuré le 29 août 2026 :
  // `precision_quotidienne` s'arrêtait au 24, avec des trous les 15 à 18 et
  // les 21 et 22.
  //
  // Rien ne le signalait. La courbe ne disparaît pas quand elle cesse d'être
  // alimentée : elle continue d'afficher son dernier point, et c'est le
  // chiffre de précision qu'on montre aux visiteurs.
  //
  // Le relevé se fait donc ici, juste après le mur dont il se déduit, dans un
  // entretien porté par les visites plutôt que par une horloge qui n'a pas le
  // temps d'arriver au bout.
  // ── LE FILET REPASSE SUR CEUX QUI ATTENDENT EN SILENCE ──────────────────
  //
  // Le pulse invite l'acheteur sans compte au moment où sa vente arrive. Il ne
  // peut rien pour les ventes traitées avant qu'il sache le faire, ni pour
  // celles où l'envoi a échoué. Un filet qui ne rattrape que ce qui tombe
  // pendant qu'il est tendu n'est pas un filet.
  // ── ON LIVRE, ON N'INVITE PLUS ──────────────────────────────────────────
  //
  // L'étape précédente envoyait « créez votre compte, votre accès s'ouvrira
  // ensuite ». Le 29 août 2026, deux acheteurs attendaient ainsi depuis un et
  // deux jours : aucun n'avait créé son compte. Une solution qui dépend d'un
  // geste du client n'est pas une solution — c'est un report du problème sur
  // celui qui a payé.
  //
  // On crée donc le compte à sa place, on crédite l'accès, et on n'envoie que
  // ce que personne ne peut faire pour lui : un lien pour choisir son mot de
  // passe.
  await etape(
    'Livrer les ventes sans compte',
    async () => {
      const { livrerVentesSansCompte } = await import('./livraison-sans-compte');
      const r = await livrerVentesSansCompte();
      return (
        `${r.livrees} accès ouvert(s) sur ${r.examinees} vente(s) sans compte ` +
        `— ${r.dejaLivrees} déjà livrée(s), ${r.comptesExistants} compte(s) déjà là` +
        (r.echecs ? `, ${r.echecs} échec(s)` : '') +
        (r.details.length ? ` · ${r.details.join(' ; ')}` : '')
      );
    },
    etapes
  );

  // ── OUVRIR L'ACCÈS NE SUFFIT PAS : ENCORE FAUT-IL QU'IL SERVE ───────────
  //
  // Placé juste après la livraison, parce que c'est elle qui fabrique le cas :
  // un compte créé par nous appartient à quelqu'un qui n'a jamais choisi de
  // mot de passe. Si le message contenant le lien se perd, l'accès est ouvert
  // et la personne reste dehors — sans que rien ne le signale.
  //
  // Le 29 août 2026, on ne l'a appris que parce qu'un client a filmé son
  // téléphone. Celui qui ne filme pas pose un avis d'une étoile, ou se tait.
  await etape(
    'Repérer les abonnés qui ne sont jamais entrés',
    async () => {
      const { signalerAbonnesJamaisEntres } = await import('./abonnes-jamais-entres');
      const r = await signalerAbonnesJamaisEntres();
      if (!r.bloques.length) return 'aucun abonné bloqué dehors';
      return (
        `${r.bloques.length} abonné(s) jamais connecté(s), ${r.aSignaler.length} signalé(s)` +
        (r.aSignaler.length && !r.alerteEnvoyee ? ' — ALERTE NON PARTIE' : '')
      );
    },
    etapes
  );

  // ── PRÉVENIR LE PROPRIÉTAIRE NE SUFFIT PAS ─────────────────────────────
  //
  // L'étape précédente signale ces personnes à l'administration. Entre
  // l'alerte et le message au client, il faut qu'un humain lise, comprenne,
  // retrouve l'adresse et écrive — la nuit, le week-end, un jour chargé.
  //
  // Le 30 août 2026, un acheteur a payé 5 000 FCFA à 00 h 38, n'a pas réussi
  // à entrer, et a REPAYÉ 2 000 FCFA à 09 h 08. Il ne s'est pas plaint : il a
  // payé une deuxième fois. Cinq des six mauvais avis de la boutique ne
  // parlaient pas du produit, mais d'un accès qu'on n'arrivait pas à ouvrir.
  //
  // L'application écrit donc elle-même au client, avec le lien qui le fait
  // entrer. Deux messages au maximum : passé deux, on n'aide plus, on harcèle
  // quelqu'un qui nous a déjà payés.
  await etape(
    'Relancer les abonnés qui ne sont jamais entrés',
    async () => {
      const { relancerAbonnesJamaisEntres } = await import('./relance-jamais-entres');
      const r = await relancerAbonnesJamaisEntres();
      if (!r.examines) return 'personne à relancer';
      return `${r.relances} relance(s) sur ${r.examines} examiné(s)` + (r.details.length ? ` · ${r.details.join(' ; ')}` : '');
    },
    etapes
  );

  await etape(
    'Relever la précision du jour',
    async () => {
      const { enregistrerPrecisionDuJour } = await import('./precision-quotidienne');
      const r = await enregistrerPrecisionDuJour();
      if (!r.ok) throw new Error(r.raison ?? 'relevé impossible');
      return `${r.matchs ?? 0} match(s) du jour`;
    },
    etapes
  );

  await etape(
    'Apprendre des résultats',
    async () => {
      const { recalculerCalibrages } = await import('./calibrage');
      const r = await recalculerCalibrages();
      return `${r.ligues} championnat(s), ${r.matchs} rencontre(s)`;
    },
    etapes
  );

  await etape(
    'Réconcilier les ventes',
    async () => {
      const { reconcilierVentes } = await import('./reconciliation-ventes');
      const r = await reconcilierVentes(7);
      return `${r.reparees.length} accès réparé(s) sur ${r.ventesExaminees} vente(s)`;
    },
    etapes
  );

  // ── LA SURVEILLANCE QUI PRÉVIENT AVANT LE CLIENT ─────────────────────────
  //
  // Le 21 août, trois pannes distinctes ont été découvertes de la même façon :
  // le propriétaire lançait une analyse et voyait « ANALYSE INTERROMPUE ». Les
  // journaux disaient tout, mais personne ne les regardait — il n'y avait
  // aucune raison de le faire tant que rien ne semblait cassé.
  //
  // Le cadenas empêche les régressions du code. Il ne peut rien contre une
  // panne extérieure : un modèle saturé chez le fournisseur, une règle de
  // routage modifiée sans préavis, un quota atteint. Le seul remède est de
  // MESURER, et de le dire.
  //
  // Le seuil : un échec sur vingt. En dessous, c'est le bruit normal d'un
  // service qui dépend de fournisseurs. Au-dessus, quelque chose de nouveau est
  // en train de casser, et cela doit se voir dans l'administration avant de se
  // voir sur l'écran d'un abonné.
  await etape(
    'Surveiller le taux d’échec',
    async () => {
      const sb = createAdminClient();
      const depuis = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      const [{ count: analyses }, { count: echecs }] = await Promise.all([
        sb.from('analysis_history').select('*', { count: 'exact', head: true }).gte('created_at', depuis),
        sb.from('analysis_failures').select('*', { count: 'exact', head: true }).gte('created_at', depuis),
      ]);

      const total = analyses ?? 0;
      const rates = echecs ?? 0;
      if (total < 10) return `trop peu d'analyses (${total}) pour conclure`;

      const taux = Math.round((100 * rates) / total);
      const SEUIL = 5;

      if (taux >= SEUIL) {
        // Les causes sont jointes au message : sans elles, l'alerte dit qu'il
        // y a un problème sans dire lequel, et il faut tout reprendre à zéro.
        const { data } = await sb
          .from('analysis_failures')
          .select('message')
          .gte('created_at', depuis)
          .limit(200);

        const causes = new Map<string, number>();
        for (const e of data ?? []) {
          const m = String((e as any).message ?? '');
          const cause = /aborted/i.test(m)
            ? 'délai dépassé'
            : /403/.test(m)
              ? 'modèle refusé (403)'
              : /JSON/i.test(m)
                ? 'JSON illisible'
                : /402|credit/i.test(m)
                  ? 'crédit épuisé'
                  : /429/.test(m)
                    ? 'limite de débit'
                    : 'autre';
          causes.set(cause, (causes.get(cause) ?? 0) + 1);
        }

        const detail = [...causes]
          .sort((a, b) => b[1] - a[1])
          .map(([c, n]) => `${n} × ${c}`)
          .join(', ');

        // Volontairement une ERREUR, pas un avertissement : cette ligne doit
        // ressortir dans les journaux de la plateforme et compter comme une
        // anomalie dans l'audit.
        throw new Error(
          `${taux} % d'analyses en échec sur 6 h (${rates} sur ${total}) — ${detail}`
        );
      }

      return `${taux} % d'échec sur 6 h (${rates} sur ${total}) — sous le seuil de ${SEUIL} %`;
    },
    etapes
  );

  // ── LA TRACE, ÉCRITE MÊME EN CAS D'ÉCHEC PARTIEL ──────────────────────────
  //
  // Sans elle, une chaîne qui ne part pas est indiscernable d'une chaîne qui
  // part et ne trouve rien à faire. C'est exactement ce qui a permis au défaut
  // de durer.
  const echecs = etapes.filter((e) => !e.ok);
  await ecrireReserve(CLE_DERNIER, new Date().toISOString(), 7 * 24 * 60 * 60 * 1000);
  await ecrireReserve(CLE_VERROU, '', 1);

  try {
    await createAdminClient()
      .from('audits')
      .insert({
        anomalies: echecs.length,
        avertissements: 0,
        points: etapes.map((e) => `${e.ok ? 'OK' : 'ÉCHEC'} — ${e.nom} : ${e.detail}`),
        duree_ms: Date.now() - debut,
      });
  } catch (e: any) {
    console.warn('[ENTRETIEN] Trace non enregistrée :', e?.message);
  }

  if (echecs.length)
    console.error(
      `[ENTRETIEN] ${echecs.length} étape(s) en échec : ${echecs.map((e) => e.nom).join(', ')}`
    );

  return {
    lance: true,
    raison: forcer ? 'demandé' : 'entretien dû',
    etapes,
    dureeMs: Date.now() - debut,
  };
}
