/**
 * QUI EST DANS L'APPLICATION, MAINTENANT.
 *
 * POURQUOI PAS CLARITY POUR ÇA
 *
 * Clarity agrège avec du retard et plafonne à dix appels par jour : il sait
 * dire « trois cents sessions hier, dont douze au Maroc », jamais « quatorze
 * personnes sont en train d'analyser un match ».
 *
 * Or cette réponse-là, l'application l'a déjà. Chaque analyse lancée laisse une
 * ligne horodatée dans `analysis_history`, chaque paiement dans
 * `payment_intents`, chaque connexion dans le compte lui-même. Il suffit de les
 * lire — c'est instantané, gratuit, et sans plafond.
 *
 * CE QU'ON APPELLE « PRÉSENT »
 *
 * Quelqu'un qui a lancé une analyse dans les quinze dernières minutes. Ce n'est
 * pas une présence au sens strict — on ne suit pas les pages ouvertes — mais
 * c'est la seule mesure honnête à partir de ce qu'on enregistre, et c'est celle
 * qui compte : un abonné qui analyse est un abonné qui se sert du produit.
 */

import { createAdminClient } from '@/lib/supabase-admin';
import { lireReserve, ecrireReserve } from '@/lib/api-football';

/**
 * Une minute de fraîcheur.
 *
 * Le calcul complet demande huit secondes : il faut parcourir les onze cents
 * comptes pour connaître leur pays. Faire attendre huit secondes à chaque
 * ouverture de l'administration serait absurde pour un chiffre qui bouge de
 * quelques unités par minute.
 *
 * Soixante secondes : assez court pour qu'« en ce moment » veuille encore dire
 * quelque chose, assez long pour que la page s'ouvre instantanément.
 */
const TTL = 60 * 1000;
const CLE = 'presence:live';

export interface PresenceLive {
  /** Comptes ayant lancé une analyse dans les 15 dernières minutes. */
  maintenant: number;
  /** Sur la dernière heure. */
  derniereHeure: number;
  /** Depuis minuit. */
  aujourdhui: number;
  /** Analyses lancées aujourd'hui, toutes personnes confondues. */
  analysesAujourdhui: number;
  /** Comptes créés aujourd'hui. */
  inscritsAujourdhui: number;
  /** Paiements aboutis aujourd'hui, et montant encaissé. */
  paiementsAujourdhui: number;
  encaisseAujourdhui: number;
  /** Répartition par pays des comptes vus aujourd'hui, quand elle est connue. */
  parPays: { pays: string; comptes: number }[];
}

export async function lirePresenceLive(): Promise<PresenceLive> {
  const vide: PresenceLive = {
    maintenant: 0,
    derniereHeure: 0,
    aujourdhui: 0,
    analysesAujourdhui: 0,
    inscritsAujourdhui: 0,
    paiementsAujourdhui: 0,
    encaisseAujourdhui: 0,
    parPays: [],
  };

  try {
    const enBase = await lireReserve<PresenceLive>(CLE);
    if (enBase && !enBase.expiree && enBase.contenu) return enBase.contenu;
  } catch {
    /* réserve illisible : on recalcule */
  }

  try {
    const sb = createAdminClient();
    const maintenant = Date.now();
    const minuit = new Date();
    minuit.setHours(0, 0, 0, 0);

    const { data: analyses } = await sb
      .from('analysis_history')
      .select('user_id, created_at')
      .gte('created_at', minuit.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000);

    const depuis = (minutes: number) =>
      new Set(
        (analyses ?? [])
          .filter((a) => maintenant - new Date(a.created_at).getTime() <= minutes * 60_000)
          .map((a) => a.user_id)
      ).size;

    const { data: intents } = await sb
      .from('payment_intents')
      .select('amount, created_at, consumed_at')
      .gte('created_at', minuit.toISOString());
    const payes = (intents ?? []).filter((i) => i.consumed_at);

    // Le pays n'est connu que des comptes relevés depuis le 18 août : on ne
    // montre donc que ce qu'on sait, sans extrapoler sur le reste.
    const parPays = new Map<string, Set<string>>();
    let inscritsAujourdhui = 0;
    try {
      const actifs = new Set((analyses ?? []).map((a) => a.user_id));
      for (let page = 1; page <= 30; page++) {
        const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        const lot = data?.users ?? [];
        for (const u of lot) {
          if (new Date(u.created_at).getTime() >= minuit.getTime()) inscritsAujourdhui++;
          const pays = (u.user_metadata as any)?.pays;
          if (pays && actifs.has(u.id)) {
            if (!parPays.has(pays)) parPays.set(pays, new Set());
            parPays.get(pays)!.add(u.id);
          }
        }
        if (lot.length < 200) break;
      }
    } catch {
      /* la présence reste affichée, sans la ventilation par pays */
    }

    const resultat: PresenceLive = {
      maintenant: depuis(15),
      derniereHeure: depuis(60),
      aujourdhui: new Set((analyses ?? []).map((a) => a.user_id)).size,
      analysesAujourdhui: analyses?.length ?? 0,
      inscritsAujourdhui,
      paiementsAujourdhui: payes.length,
      encaisseAujourdhui: payes.reduce((a, i) => a + (i.amount ?? 0), 0),
      parPays: [...parPays]
        .map(([pays, comptes]) => ({ pays, comptes: comptes.size }))
        .sort((a, b) => b.comptes - a.comptes),
    };

    void ecrireReserve(CLE, resultat, TTL);
    return resultat;
  } catch {
    return vide;
  }
}
