/**
 * Audit de santé de ProFoot, exécuté par la tâche planifiée.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Chaque panne de cette application a été découverte par hasard, en regardant
 * un écran : les paiements estampillés « États-Unis » pendant des jours, le
 * score 2-1 servi à 82 % des analyses, les équipes jugées sur des matchs
 * amicaux, un pronostic contredisant le tableau d'affichage en plein match.
 * Aucune n'a déclenché d'alerte, parce qu'aucune ne produisait d'erreur : elles
 * produisaient des résultats faux.
 *
 * Ce module cherche exactement ces défauts-là. Il ne vérifie pas que « ça
 * répond » — il vérifie que ce qui est produit a du sens.
 */

import { createAdminClient } from './supabase-admin';
import { clientsLeses } from './echecs-paiement';
import { PLANS, ACCES_OFFERTS } from './subscription';

export type Gravite = 'anomalie' | 'attention' | 'ok';

export interface PointAudit {
  domaine: string;
  gravite: Gravite;
  message: string;
}

export interface ResultatAudit {
  execute_le: string;
  duree_ms: number;
  anomalies: number;
  avertissements: number;
  points: PointAudit[];
}

/**
 * Fenêtre d'observation des analyses.
 *
 * Elle est volontairement courte. Sur 48 heures, un défaut corrigé continue de
 * peser : le score 2-1, éteint à 21 h, restait signalé à 85 % parce que la
 * fenêtre contenait encore les 143 analyses fautives de la journée. Un signal
 * qui se déclenche à tort finit ignoré, et l'audit ne sert plus à rien.
 *
 * MAIS SIX HEURES ÉTAIENT TROP COURTES.
 *
 * La nuit vidait la fenêtre. Mesuré sur quarante-huit heures réelles : elle
 * tombait sous les quinze analyses requises 52 % DU TEMPS — et sous ce seuil,
 * le contrôle s'arrêtait entièrement. Le défaut du « 2-1 » pouvait revenir et
 * passer inaperçu la moitié de chaque journée.
 *
 * Vingt-quatre heures couvrent un cycle complet de fréquentation. Cela ne
 * dilue pas les défauts récents : `selonAnciennete()` date la ligne fautive la
 * PLUS RÉCENTE, donc un défaut éteint depuis deux heures est annoncé comme
 * résorbé quelle que soit la fenêtre.
 */
const FENETRE_HEURES = 24;
const MINIMUM_POUR_JUGER = 15;

/**
 * ── QUARANTE ANALYSES NE SUFFISAIENT PAS À JUGER ──────────────────────────
 *
 * Le contrôle lisait les quarante analyses les plus récentes. L'application en
 * produit environ mille quatre cents par jour : il jugeait donc la qualité du
 * moteur sur trois pour cent de sa production.
 *
 * Mesuré le 1er septembre 2026, au même instant :
 *
 *     sur 40 analyses  ->  27 affiches, « 2-1 » à 48 %   ANOMALIE
 *     sur la journée   -> 126 affiches, « 2-1 » à 33 %   normal
 *
 * Le seuil d'alerte est à 45 %. L'audit annonçait donc un moteur en panne
 * alors qu'il tournait juste — et « 2-1 » est le score le plus fréquent du
 * football réel, il DOIT arriver en tête.
 *
 * Un signal qui se déclenche à tort finit ignoré, et c'est précisément celui-là
 * qui doit attraper le vrai défaut : le « 2-1 » servi à 82 % des analyses est
 * passé inaperçu pendant des jours faute d'être mesuré.
 *
 * Mille : une page de lecture, une seule requête, et de quoi couvrir une
 * journée entière d'affiches distinctes.
 */
const ANALYSES_EXAMINEES = 1000;

/** En dessous, le moteur est à l'arrêt — ce n'est plus un creux de trafic. */
const ACTIVITE_MINIMALE = 5;

/**
 * Un défaut dont la dernière occurrence est ancienne n est pas une panne en
 * cours. Sans cette distinction, l audit criait au loup pendant des heures
 * après une correction, et un signal qui se déclenche à tort finit ignoré.
 */
const DELAI_RESORPTION_MS = 2 * 3600 * 1000;

const FOOT = 'https://v3.football.api-sports.io';

async function reessayer<T>(f: () => Promise<T>, essai = 1): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (essai >= 3) throw e;
    await new Promise((r) => setTimeout(r, 1200 * essai));
    return reessayer(f, essai + 1);
  }
}

export async function executerAudit(): Promise<ResultatAudit> {
  const debut = Date.now();
  const points: PointAudit[] = [];
  const noter = (domaine: string, gravite: Gravite, message: string) =>
    points.push({ domaine, gravite, message });

  /** Signale une anomalie, ou la déclare résorbée si elle ne survient plus. */
  const noterSelonAnciennete = (domaine: string, derniere: string | null, message: string) => {
    const age = derniere ? Date.now() - new Date(derniere).getTime() : Infinity;
    if (age > DELAI_RESORPTION_MS)
      noter(domaine, 'ok', `${message} — dernière occurrence il y a ${Math.round(age / 3600000)} h, défaut résorbé`);
    else noter(domaine, 'anomalie', message);
  };

  const sb = createAdminClient();

  // ── Fournisseur de données ────────────────────────────────────────────────
  try {
    const st = (
      await reessayer(async () => {
        const r = await fetch(`${FOOT}/status`, {
          headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY ?? '' },
        });
        return r.json();
      })
    )?.response;

    if (!st) noter('Données', 'anomalie', "l'API football ne répond pas — plus aucune analyse possible");
    else {
      if (!st.subscription?.active) noter('Données', 'anomalie', 'abonnement API football INACTIF');
      const jours = Math.round((new Date(st.subscription?.end).getTime() - Date.now()) / 86400000);
      if (jours <= 7) noter('Données', 'anomalie', `abonnement API football expire dans ${jours} jour(s)`);
      else if (jours <= 21) noter('Données', 'attention', `abonnement API football à renouveler dans ${jours} jours`);

      const utilise = st.requests?.current ?? 0;
      const plafond = st.requests?.limit_day ?? 0;
      const part = plafond ? (utilise / plafond) * 100 : 0;
      if (part >= 90) noter('Données', 'anomalie', `quota API quasi épuisé : ${utilise}/${plafond}`);
      else if (part >= 70) noter('Données', 'attention', `quota API à ${Math.round(part)} % : ${utilise}/${plafond}`);
      else noter('Données', 'ok', `quota API ${utilise}/${plafond} (${Math.round(part)} %)`);
    }
  } catch (e: any) {
    noter('Données', 'anomalie', `vérification du fournisseur impossible : ${e?.message}`);
  }

  // ── Boutique ──────────────────────────────────────────────────────────────
  // Le prix attendu est celui que l'application ANNONCE réellement, donc celui
  // de l'administration — pas celui du code. Sans cela, changer un prix depuis
  // l'administration ferait crier l'audit alors que la boutique est juste, ou
  // pire : le laisserait muet alors que les deux ont divergé.
  const { lireOffres } = await import('./offres');
  const offresBoutique = await lireOffres().catch(() => null);
  const prixAnnonce = (cle: keyof typeof PLANS) =>
    offresBoutique?.[cle]?.prixXof ?? PLANS[cle].amountXof;

  // ── LE CONTRÔLE SUIT LA BOUTIQUE, PAS L'INVERSE ─────────────────────────
  //
  // Ce bloc interrogeait Chariow. Cette boutique a fermé le 27 août 2026 et
  // l'application vend depuis sur MakeTou : le contrôle rendait donc TROIS
  // anomalies tous les matins — « produit Essentiel introuvable », « produit
  // Pro introuvable », « produit VIP introuvable » — pour des offres qui se
  // vendaient parfaitement. Le 30 août, elles formaient un tiers des anomalies
  // du diagnostic.
  //
  // Un diagnostic qui se trompe tous les jours au même endroit apprend à son
  // lecteur à sauter ce paragraphe. Le jour où la ligne devient vraie, elle est
  // sautée comme les autres.
  //
  // MakeTou n'expose pas d'interface de programmation pour ses produits. La
  // question qu'on peut poser, et qui est celle qui compte, devient donc :
  // « la page où l'on paie cette offre répond-elle ? » Une adresse morte, et
  // l'acheteur arrive sur une erreur au moment de payer.
  const { lienMaketou } = await import('./maketou-boutique');
  const offres: [string, keyof typeof PLANS][] = [
    ['Essentiel', 'essential_monthly'],
    ['Pro', 'pro_monthly'],
    ['VIP Annuel', 'vip_yearly'],
  ];
  for (const [nom, cle] of offres) {
    const lien = lienMaketou(cle);
    if (!lien) {
      noter('Boutique', 'anomalie', `aucune page de paiement pour l'offre ${nom} — elle n'est pas payable`);
      continue;
    }
    try {
      const r = await reessayer(async () =>
        fetch(lien, { method: 'GET', headers: { 'User-Agent': 'ProFootAI-Audit' } })
      );
      if (!r.ok) {
        noter('Boutique', 'anomalie', `la page de paiement ${nom} répond ${r.status} — l'offre n'est pas payable`);
      } else {
        noter('Boutique', 'ok', `${nom} à ${prixAnnonce(cle)} FCFA, page de paiement joignable`);
      }
    } catch (e: any) {
      // Boutique injoignable depuis notre serveur : on le signale sans conclure
      // qu'elle est en panne. Un incident réseau n'est pas une offre morte.
      noter('Boutique', 'attention', `${nom} : page de paiement non vérifiable (${e?.message})`);
    }
  }

  // ── Étanchéité des données d'abonnés ──────────────────────────────────────
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const pub = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    for (const table of ['payment_intents', 'vip_conversations', 'analysis_failures', 'webhook_events']) {
      const { data } = await pub.from(table).select('*').limit(1);
      if ((data ?? []).length > 0)
        noter('Sécurité', 'anomalie', `FUITE : ${table} est lisible depuis un navigateur`);
    }
    noter('Sécurité', 'ok', 'aucune table sensible accessible depuis un navigateur');
  } catch (e: any) {
    noter('Sécurité', 'attention', `contrôle d'étanchéité impossible : ${e?.message}`);
  }

  // ── Qualité de ce que l'analyseur produit ─────────────────────────────────
  try {
    const depuis = new Date(Date.now() - FENETRE_HEURES * 3600 * 1000).toISOString();
    const { data } = await sb
      .from('analysis_history')
      .select('score, confidence, is_finished, created_at, team1_name, team2_name')
      .eq('is_finished', false)
      .gte('created_at', depuis)
      .order('created_at', { ascending: false })
      .limit(ANALYSES_EXAMINEES);

    const predictions = data ?? [];
    if (predictions.length < ACTIVITE_MINIMALE) {
      // Plus rien ne sort du moteur : c'est une panne, pas un creux.
      noter(
        'Analyses',
        'anomalie',
        `${predictions.length} prédiction(s) sur ${FENETRE_HEURES} h — le moteur d'analyse est probablement à l'arrêt`
      );
    } else {
      if (predictions.length < MINIMUM_POUR_JUGER)
        noter(
          'Analyses',
          'ok',
          `${predictions.length} prédictions seulement — contrôles menés, conclusions à nuancer`
        );

      // UNE AFFICHE COMPTE POUR UNE, PAS POUR VINGT.
      //
      // Le contrôle comptait les analyses. Or le même match est analysé en
      // boucle : vingt personnes demandent FC Barcelone — Elche dans la même
      // journée, et le calcul rend évidemment vingt fois le même score. Ce
      // n'est pas un défaut, c'est un match populaire. Le vrai défaut du
      // « 2-1 » dominait sur des affiches DIFFÉRENTES — c'est cela qu'on mesure.
      const parMatch = new Map<string, Map<string, number>>();
      for (const a of predictions) {
        if (!a.score) continue;
        const cle = [a.team1_name, a.team2_name].map((n: any) => String(n ?? '').toLowerCase()).sort().join('|');
        if (!parMatch.has(cle)) parMatch.set(cle, new Map());
        const m = parMatch.get(cle)!;
        m.set(a.score, (m.get(a.score) ?? 0) + 1);
      }

      const parScore = new Map<string, number>();
      for (const scores of parMatch.values()) {
        const majoritaire = [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
        parScore.set(majoritaire, (parScore.get(majoritaire) ?? 0) + 1);
      }
      const avecScore = parMatch.size;
      const dominant = [...parScore.entries()].sort((a, b) => b[1] - a[1])[0];

      // Les prédictions sont triées du plus récent au plus ancien : la première
      // ligne fautive est donc la plus récente, celle qui dit si le défaut
      // sévit encore.
      const derniere = (p: (a: any) => boolean) => predictions.find(p)?.created_at ?? null;

      if (avecScore === 0) noter('Analyses', 'anomalie', 'aucune prédiction ne porte de score');
      else {
        const part = (dominant[1] / avecScore) * 100;
        // En dessous de dix affiches distinctes, un pourcentage ne veut rien
        // dire : sur six matchs, deux fois le même score font déjà 33 %.
        if (avecScore < 10)
          noter('Analyses', 'ok', `${dominant[0]} sur ${dominant[1]} des ${avecScore} affiches — trop peu pour juger`);
        // Un score qui domine signale un calcul en panne : c'est ainsi que le
        // 2-1 servi à 82 % des analyses est passé inaperçu pendant des jours.
        else if (part > 45)
          noterSelonAnciennete(
            'Analyses',
            derniere((a: any) => a.score === dominant[0]),
            `le score ${dominant[0]} représente ${Math.round(part)} % des prédictions`
          );
        else noter('Analyses', 'ok', `${parScore.size} scores distincts, le plus fréquent à ${Math.round(part)} %`);
      }

      const sansScore = predictions.filter((a: any) => !a.score).length;
      if (sansScore / predictions.length > 0.2)
        noterSelonAnciennete(
          'Analyses',
          derniere((a: any) => !a.score),
          `${Math.round((sansScore / predictions.length) * 100)} % des prédictions sans score`
        );

      const parConfiance = new Map<number, number>();
      for (const a of predictions) if (a.confidence != null) parConfiance.set(a.confidence, (parConfiance.get(a.confidence) ?? 0) + 1);
      const totalConf = [...parConfiance.values()].reduce((t, n) => t + n, 0);
      if (totalConf > 0) {
        const conf = [...parConfiance.entries()].sort((a, b) => b[1] - a[1])[0];
        const part = (conf[1] / totalConf) * 100;
        // Une confiance qui se répète à l'identique est une valeur par défaut,
        // pas une mesure.
        if (part > 50)
          noterSelonAnciennete(
            'Analyses',
            derniere((a: any) => a.confidence === conf[0]),
            `la confiance vaut ${conf[0]} % dans ${Math.round(part)} % des cas`
          );
        const aberrantes = predictions.filter((a: any) => a.confidence != null && (a.confidence >= 100 || a.confidence < 40)).length;
        if (aberrantes > 0) noter('Analyses', 'anomalie', `${aberrantes} confiance(s) à 100 % ou sous 40 %`);
      }
    }
  } catch (e: any) {
    noter('Analyses', 'anomalie', `qualité des analyses non vérifiable : ${e?.message}`);
  }

  // ── Échecs du moteur ──────────────────────────────────────────────────────
  try {
    const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ data: echecs }, { count }] = await Promise.all([
      sb.from('analysis_failures').select('cause, servi_quand_meme').gte('created_at', depuis),
      sb.from('analysis_history').select('id', { count: 'exact', head: true }).gte('created_at', depuis),
    ]);
    const n = echecs?.length ?? 0;
    const analyses = count ?? 0;
    const taux = analyses + n > 0 ? (n / (analyses + n)) * 100 : 0;

    if (taux > 20) noter('Moteur', 'anomalie', `${Math.round(taux)} % d'échecs sur 24 h (${n} pour ${analyses} analyses)`);
    else if (n > 0) noter('Moteur', 'ok', `${n} échec(s) sur 24 h, soit ${Math.round(taux)} %`);
    else noter('Moteur', 'ok', 'aucun échec sur 24 h');

    const perdus = (echecs ?? []).filter((e: any) => !e.servi_quand_meme).length;
    if (perdus > 0) noter('Moteur', 'anomalie', `${perdus} abonné(s) restés SANS réponse`);
  } catch (e: any) {
    noter('Moteur', 'attention', `échecs non vérifiables : ${e?.message}`);
  }

  // ── Paiements ─────────────────────────────────────────────────────────────
  try {
    const { data } = await sb
      .from('payment_intents')
      .select('pays, pays_source, consumed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    const avecOrigine = (data ?? []).filter((p: any) => p.pays);
    if (avecOrigine.length > 0) {
      const enEchec = avecOrigine.filter((p: any) => p.pays_source === 'defaut').length;
      if (enEchec > 0)
        noter('Paiements', 'anomalie', `${enEchec} paiement(s) sans pays détecté — moyens de paiement inadaptés`);

      const us = avecOrigine.filter((p: any) => p.pays === 'US').length;
      // La panne d'origine : tout le monde rattaché aux États-Unis parce que le
      // prestataire géolocalisait notre serveur.
      if (us / avecOrigine.length > 0.5)
        noter('Paiements', 'anomalie', `${us}/${avecOrigine.length} demandes rattachées aux États-Unis`);

      if (enEchec === 0 && us / avecOrigine.length <= 0.5)
        noter('Paiements', 'ok', `${avecOrigine.length} demandes situées correctement`);

      // Le taux d'aboutissement est un chiffre commercial : il est bas parce
      // que la plupart des gens repartent sans essayer de payer, pas parce que
      // l'application casse. Signalé, jamais alerté — une alerte qu'aucune
      // correction ne peut éteindre finit par masquer les vraies.
      const semaine = avecOrigine.filter((p: any) => Date.now() - new Date(p.created_at).getTime() < 7 * 86400000);
      if (semaine.length >= 5) {
        const part = (semaine.filter((p: any) => p.consumed_at).length / semaine.length) * 100;
        noter('Paiements', 'ok', `${Math.round(part)} % des demandes de la semaine ont été payées (${semaine.length} demandes)`);
      }
    }

    // La seule question de paiement qui mérite une alerte.
    const { leses, ventesPayees, examenPartiel } = await clientsLeses();
    if (leses.length > 0) {
      for (const c of leses)
        noter('Paiements', 'anomalie', `${c.email ?? c.saleId} a payé sans recevoir son abonnement — ${c.raison}`);
    } else if (ventesPayees > 0) {
      noter('Paiements', 'ok', `${ventesPayees} paiement(s) encaissé(s), tous ont reçu leur abonnement`);
    }
    if (examenPartiel)
      noter('Paiements', 'attention', "toutes les demandes n'ont pas pu être vérifiées auprès de la boutique");
  } catch (e: any) {
    noter('Paiements', 'attention', `paiements non vérifiables : ${e?.message}`);
  }

  // ── Agent VIP ─────────────────────────────────────────────────────────────
  try {
    const { data } = await sb
      .from('vip_conversations')
      .select('recherches_web')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data?.length) {
      const sans = data.filter((e: any) => e.recherches_web === 0).length;
      const part = (sans / data.length) * 100;

      // ── « ÉTEINT EXPRÈS » N'EST PAS « EN PANNE » ────────────────────────
      //
      // La recherche web est un outil des serveurs d'Anthropic : une
      // passerelle tierce ne peut pas la fournir. Depuis le 20 août 2026 tout
      // passe par OpenRouter — un seul crédit à recharger au lieu de deux —
      // et l'agent n'a donc AUCUN accès au web.
      //
      // Le contrôle l'annonçait comme une anomalie tous les matins : « 100 %
      // des réponses sans aucune recherche web ». C'est exact, et c'est sans
      // objet — rien dans le code ne peut le corriger, seule une variable
      // d'environnement le peut. Une anomalie qu'aucune correction ne peut
      // éteindre apprend à son lecteur à ne plus lire ce paragraphe.
      //
      // On dit donc ce qui est vrai : l'agent tourne sans le web, voici
      // pourquoi, et voici comment le rebrancher.
      const { passerellesDisponibles } = await import('./passerelle-claude');
      const webPossible = passerellesDisponibles().some((p) => p.rechercheWeb);

      if (!webPossible) {
        noter(
          'Agent VIP',
          'attention',
          `agent sans accès au web : la passerelle en service ne le permet pas. ` +
            `Il garde toutes ses données football, il perd la presse et le mercato. ` +
            `Pour le rebrancher : ANTHROPIC_DIRECT=1 dans Vercel.`
        );
      } else if (part > 20) {
        // Une réponse sans recherche vient alors de la mémoire du modèle, qui
        // a des mois de retard — et là, c'est une vraie anomalie.
        noter('Agent VIP', 'anomalie', `${Math.round(part)} % des réponses sans aucune recherche web`);
      } else {
        noter('Agent VIP', 'ok', `${sans} réponse(s) sans recherche sur ${data.length}`);
      }
    }
  } catch (e: any) {
    noter('Agent VIP', 'attention', `agent non vérifiable : ${e?.message}`);
  }

  // ── Accès offerts ─────────────────────────────────────────────────────────
  noter('Partenaires', 'ok', `${ACCES_OFFERTS.length} accès offerts actifs`);

  const anomalies = points.filter((p) => p.gravite === 'anomalie').length;
  const avertissements = points.filter((p) => p.gravite === 'attention').length;

  return {
    execute_le: new Date().toISOString(),
    duree_ms: Date.now() - debut,
    anomalies,
    avertissements,
    points,
  };
}
