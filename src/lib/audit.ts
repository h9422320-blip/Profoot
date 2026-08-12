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

/** Fenêtre glissante d'observation des analyses. */
const FENETRE_HEURES = 48;

const CHARIOW = 'https://api.chariow.com/v1';
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
  const produits: [string, string | undefined, number][] = [
    ['Essentiel', process.env.CHARIOW_PRODUCT_ID_ESSENTIAL, PLANS.essential_monthly.amountXof],
    ['Pro', process.env.CHARIOW_PRODUCT_ID_PRO ?? process.env.CHARIOW_PRODUCT_ID_MONTHLY, PLANS.pro_monthly.amountXof],
    ['VIP Annuel', process.env.CHARIOW_PRODUCT_ID_VIP ?? process.env.CHARIOW_PRODUCT_ID_YEARLY, PLANS.vip_yearly.amountXof],
  ];
  for (const [nom, id, attendu] of produits) {
    if (!id) {
      noter('Boutique', 'anomalie', `aucun produit configuré pour l'offre ${nom} — elle n'est pas payable`);
      continue;
    }
    try {
      const p = (
        await reessayer(async () => {
          const r = await fetch(`${CHARIOW}/products/${id}`, {
            headers: { Authorization: `Bearer ${process.env.CHARIOW_API_KEY}`, Accept: 'application/json' },
          });
          return r.json();
        })
      )?.data;

      if (!p) noter('Boutique', 'anomalie', `produit ${nom} introuvable dans la boutique`);
      else if (p.status !== 'published') noter('Boutique', 'anomalie', `${nom} n'est pas publié (${p.status})`);
      else if (Number(p.pricing?.effective?.value) !== attendu)
        noter(
          'Boutique',
          'anomalie',
          `${nom} : la boutique facture ${p.pricing?.effective?.value} alors que l'application annonce ${attendu}`
        );
      else noter('Boutique', 'ok', `${nom} à ${attendu} FCFA, publié`);
    } catch (e: any) {
      noter('Boutique', 'attention', `${nom} : vérification impossible (${e?.message})`);
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
      .select('score, confidence, is_finished, created_at')
      .gte('created_at', depuis)
      .order('created_at', { ascending: false })
      .limit(500);

    const predictions = (data ?? []).filter((a: any) => !a.is_finished);
    if (predictions.length < 15) {
      noter('Analyses', 'ok', `${predictions.length} prédiction(s) sur ${FENETRE_HEURES} h — trop peu pour juger`);
    } else {
      const parScore = new Map<string, number>();
      for (const a of predictions) if (a.score) parScore.set(a.score, (parScore.get(a.score) ?? 0) + 1);
      const avecScore = [...parScore.values()].reduce((t, n) => t + n, 0);
      const dominant = [...parScore.entries()].sort((a, b) => b[1] - a[1])[0];

      if (avecScore === 0) noter('Analyses', 'anomalie', 'aucune prédiction ne porte de score');
      else {
        const part = (dominant[1] / avecScore) * 100;
        // Un score qui domine signale un calcul en panne : c'est ainsi que le
        // 2-1 servi à 82 % des analyses est passé inaperçu pendant des jours.
        if (part > 45)
          noter('Analyses', 'anomalie', `le score ${dominant[0]} représente ${Math.round(part)} % des prédictions`);
        else noter('Analyses', 'ok', `${parScore.size} scores distincts, le plus fréquent à ${Math.round(part)} %`);
      }

      const sansScore = predictions.filter((a: any) => !a.score).length;
      if (sansScore / predictions.length > 0.2)
        noter('Analyses', 'anomalie', `${Math.round((sansScore / predictions.length) * 100)} % des prédictions sans score`);

      const parConfiance = new Map<number, number>();
      for (const a of predictions) if (a.confidence != null) parConfiance.set(a.confidence, (parConfiance.get(a.confidence) ?? 0) + 1);
      const totalConf = [...parConfiance.values()].reduce((t, n) => t + n, 0);
      if (totalConf > 0) {
        const conf = [...parConfiance.entries()].sort((a, b) => b[1] - a[1])[0];
        const part = (conf[1] / totalConf) * 100;
        // Une confiance qui se répète à l'identique est une valeur par défaut,
        // pas une mesure.
        if (part > 50)
          noter('Analyses', 'anomalie', `la confiance vaut ${conf[0]} % dans ${Math.round(part)} % des cas`);
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

      const semaine = avecOrigine.filter((p: any) => Date.now() - new Date(p.created_at).getTime() < 7 * 86400000);
      if (semaine.length >= 5) {
        const part = (semaine.filter((p: any) => p.consumed_at).length / semaine.length) * 100;
        if (part < 30)
          noter('Paiements', 'attention', `${Math.round(part)} % des demandes de la semaine ont abouti à un abonnement`);
      }
    }
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
      // Une réponse sans recherche vient de la mémoire du modèle, qui a des mois
      // de retard.
      if (part > 20) noter('Agent VIP', 'anomalie', `${Math.round(part)} % des réponses sans aucune recherche web`);
      else noter('Agent VIP', 'ok', `${sans} réponse(s) sans recherche sur ${data.length}`);
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
