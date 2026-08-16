/**
 * Audit automatique de ProFoot.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Chaque panne de cette application a été découverte de la même façon : par
 * hasard, en regardant un écran. Les paiements estampillés « États-Unis »
 * pendant des jours, le score 2-1 servi à 82 % des analyses, les équipes jugées
 * sur des matchs amicaux, un pronostic contredisant le tableau d'affichage en
 * plein match. Aucune de ces pannes n'a déclenché la moindre alerte : elles ne
 * produisaient pas d'erreur, elles produisaient des résultats faux.
 *
 * Ce script va chercher ces défauts-là. Il ne teste pas que « ça répond » —
 * il vérifie que ce qui est produit a du sens.
 *
 * Utilisation :   node scripts/audit.mjs
 * Sortie : 0 si tout va bien, 1 s'il faut intervenir.
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── Configuration ────────────────────────────────────────────────────────────

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
    })
);

const SITE = 'https://profootai.com';
/**
 * Ce que l'application ANNONCE. La boutique, elle, encaisse — et l'audit
 * compare les deux.
 *
 * Ce contrôle a prouvé son utilité le jour du lancement de la vente à l'unité :
 * le produit était à 600 FCFA quand le code affichait 500. Le paywall aurait
 * promis un prix et la page de paiement en aurait réclamé un autre, ce qui fait
 * abandonner l'achat au moment précis où l'on tenait enfin l'acheteur.
 */
const TARIFS = { Essentiel: 2000, Pro: 5000, 'VIP Annuel': 15000, 'Match à l\'unité': 600 };

/** Correspondance entre la clé d'une offre en base et son nom d'affichage. */
const NOM_OFFRE = {
  essential_monthly: 'Essentiel',
  pro_monthly: 'Pro',
  vip_yearly: 'VIP Annuel',
};

// ── Journal ──────────────────────────────────────────────────────────────────

const anomalies = [];
const avertissements = [];

const ok = (texte) => console.log(`  OK        ${texte}`);
const alerte = (texte) => {
  anomalies.push(texte);
  console.log(`  ANOMALIE  ${texte}`);
};
const attention = (texte) => {
  avertissements.push(texte);
  console.log(`  ATTENTION ${texte}`);
};
const titre = (t) => console.log(`\n${t}`);

/**
 * Un défaut dont la dernière occurrence est ancienne n'est pas une panne en
 * cours.
 *
 * Sans cette distinction, l'audit criait au loup pendant des heures après une
 * correction : le score 2-1 éteint à 21 h restait signalé parce que les lignes
 * fautives de la soirée étaient encore dans la fenêtre. Un signal qui se
 * déclenche à tort finit ignoré, et l'audit ne sert alors plus à rien.
 *
 * Au-delà de ce délai sans nouvelle occurrence, le défaut est présenté comme
 * résorbé — mentionné, mais sans réclamer d'intervention.
 */
const DELAI_RESORPTION_MS = 2 * 3600 * 1000;

const selonAnciennete = (derniereOccurrence, texte) => {
  const age = Date.now() - new Date(derniereOccurrence).getTime();
  if (age > DELAI_RESORPTION_MS) {
    const heures = Math.round(age / 3600000);
    ok(`${texte} — dernière occurrence il y a ${heures} h, défaut résorbé`);
  } else {
    alerte(texte);
  }
};

/** Le réseau lâche parfois ; une panne réseau n'est pas une anomalie applicative. */
const reessayer = async (f, essai = 1) => {
  try {
    return await f();
  } catch (e) {
    if (essai >= 4) throw e;
    await new Promise((r) => setTimeout(r, 2000 * essai));
    return reessayer(f, essai + 1);
  }
};

const apiFoot = (chemin) =>
  reessayer(async () => {
    const r = await fetch(`https://v3.football.api-sports.io${chemin}`, {
      headers: {
        'x-apisports-key': env.API_FOOTBALL_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    });
    return r.json();
  });

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const sbPublic = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// ── 1. Fournisseur de données ────────────────────────────────────────────────

async function verifierApiFootball() {
  titre('1. FOURNISSEUR DE DONNÉES');
  const st = (await apiFoot('/status'))?.response;
  if (!st) return alerte("l'API football ne répond pas — plus aucune analyse possible");

  const utilise = st.requests?.current ?? 0;
  const plafond = st.requests?.limit_day ?? 0;
  const part = plafond ? (utilise / plafond) * 100 : 0;

  if (!st.subscription?.active) alerte('abonnement API football INACTIF');
  else ok(`abonnement ${st.subscription.plan} actif`);

  const finDans = Math.round((new Date(st.subscription?.end) - Date.now()) / 86400000);
  if (finDans <= 7) alerte(`abonnement API football expire dans ${finDans} jour(s)`);
  else if (finDans <= 21) attention(`abonnement API football à renouveler dans ${finDans} jours`);
  else ok(`renouvellement dans ${finDans} jours`);

  if (part >= 90) alerte(`quota quasi épuisé : ${utilise}/${plafond}`);
  else if (part >= 70) attention(`quota consommé à ${part.toFixed(0)} % : ${utilise}/${plafond}`);
  else ok(`quota : ${utilise}/${plafond} (${part.toFixed(0)} %)`);
}

// ── 2. Boutique ──────────────────────────────────────────────────────────────

async function verifierBoutique() {
  titre('2. BOUTIQUE ET TARIFS');

  // Les prix se règlent depuis l'administration : ce sont donc CEUX-LÀ que
  // l'application annonce, et non ceux écrits plus haut. Sans cette relecture,
  // un changement de prix depuis l'administration ferait crier l'audit alors
  // que la boutique est juste — ou, bien pire, le laisserait muet le jour où
  // les deux ont réellement divergé.
  const { data: offresReglees } = await sb.from('offres').select('cle, prix_xof');
  for (const o of offresReglees ?? []) {
    const nom = NOM_OFFRE[o.cle];
    if (nom && Number(o.prix_xof) > 0) TARIFS[nom] = Number(o.prix_xof);
  }

  const produits = [
    ['Essentiel', env.CHARIOW_PRODUCT_ID_ESSENTIAL],
    ['Pro', env.CHARIOW_PRODUCT_ID_PRO],
    ['VIP Annuel', env.CHARIOW_PRODUCT_ID_VIP],
    ["Match à l'unité", env.CHARIOW_PRODUCT_ID_MATCH],
  ];

  for (const [nom, id] of produits) {
    if (!id) {
      // La vente à l'unité est facultative : sans produit configuré, le paywall
      // se replie sur l'abonnement seul. Ce n'est pas une panne, seulement une
      // offre encore éteinte.
      if (nom === "Match à l'unité") {
        attention("vente à l'unité inactive — CHARIOW_PRODUCT_ID_MATCH n'est pas configuré");
        continue;
      }
      // Rien à signaler ici : ce cas est traité juste après la boucle.
      alerte(`aucun produit configuré pour l'offre ${nom} — elle n'est pas payable`);
      continue;
    }
    const corps = await reessayer(async () => {
      const r = await fetch(`https://api.chariow.com/v1/products/${id}`, {
        headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' },
      });
      return r.json();
    });
    const p = corps?.data;
    if (!p) {
      alerte(`produit ${nom} introuvable dans la boutique`);
      continue;
    }
    const facture = Number(p.pricing?.effective?.value);
    if (p.status !== 'published') alerte(`${nom} n'est pas publié (${p.status})`);
    else if (facture !== TARIFS[nom])
      alerte(`${nom} : la boutique facture ${facture} alors que l'application annonce ${TARIFS[nom]}`);
    else ok(`${nom} : ${facture} FCFA, publié`);
  }

  // L'offre à l'unité est volontairement éteinte tant que le parcours de retour
  // après paiement n'a pas été éprouvé sur un vrai paiement. Le dire ici évite
  // qu'on la croie active parce que le produit existe et que son prix est juste.
  if (env.CHARIOW_PRODUCT_ID_MATCH && env.ACHAT_MATCH_ACTIF !== 'true')
    ok("vente à l'unité éteinte volontairement (ACHAT_MATCH_ACTIF absent) — invisible pour les utilisateurs");

  await verifierPulse(produits);
}

/**
 * Le pulse couvre-t-il TOUS les produits ?
 *
 * C'est la panne silencieuse par excellence. Un pulse configuré pour les
 * abonnements ne couvre pas automatiquement un nouveau produit : la vente est
 * encaissée, aucune notification n'arrive, et le client n'obtient rien. Aucune
 * erreur nulle part — ni dans les journaux, ni à l'écran. On ne s'en aperçoit
 * qu'en lisant un tableau de ventes à la main, des jours plus tard.
 *
 * Ce contrôle est né de la mise en vente du match à l'unité : le produit
 * existait, la variable était en place, et il ne restait que cette case à
 * cocher pour que l'argent rentre sans que rien ne soit livré.
 */
async function verifierPulse(produits) {
  const corps = await reessayer(async () => {
    const r = await fetch('https://api.chariow.com/v1/pulses', {
      headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' },
    });
    return r.json();
  });

  const pulses = (corps?.data ?? []).filter(
    (p) => p.is_enabled && String(p.url ?? '').includes('/api/payments/chariow/webhook')
  );

  if (pulses.length === 0)
    return alerte('aucun pulse actif vers notre webhook — les paiements ne seront jamais livrés');

  const surVente = pulses.filter((p) =>
    (p.triggers ?? []).some((t) => String(t.value ?? '').includes('successful'))
  );
  if (surVente.length === 0)
    return alerte("le pulse n'écoute pas l'événement de vente réussie — rien ne sera livré");

  const couverts = new Set(surVente.flatMap((p) => (p.products ?? []).map((x) => x.id)));
  const manquants = produits.filter(([, id]) => id && !couverts.has(id)).map(([nom]) => nom);

  if (manquants.length > 0)
    alerte(
      `le pulse ne couvre pas ${manquants.join(', ')} — ces ventes seront encaissées sans rien livrer`
    );
  else ok(`pulse actif, ${couverts.size} produit(s) couvert(s), aucune offre oubliée`);
}

// ── 3. Base de données et étanchéité ─────────────────────────────────────────

async function verifierBase() {
  titre('3. BASE DE DONNÉES');
  const tables = [
    ['subscriptions', 'id'],
    ['payment_intents', 'sale_id, pays'],
    ['analysis_history', 'id, score, confidence'],
    ['analysis_failures', 'id, cause'],
    ['vip_conversations', 'id, recherches_web'],
    ['webhook_events', 'delivery_id'],
  ];
  for (const [table, colonnes] of tables) {
    const { error } = await sb.from(table).select(colonnes).limit(1);
    if (error) alerte(`table ${table} illisible : ${error.message}`);
    else ok(`${table} lisible`);
  }

  // Ces tables contiennent des données d'abonnés : le navigateur ne doit jamais
  // pouvoir les lire.
  for (const table of ['payment_intents', 'vip_conversations', 'analysis_failures', 'webhook_events']) {
    const { data } = await sbPublic.from(table).select('*').limit(1);
    if ((data ?? []).length > 0) alerte(`FUITE : ${table} est lisible depuis un navigateur`);
    else ok(`${table} inaccessible depuis un navigateur`);
  }
}

// ── 4. Ce que l'analyseur produit réellement ─────────────────────────────────

/**
 * Nombre de prédictions récentes examinées.
 *
 * On raisonne sur un NOMBRE d'analyses et non sur une durée. Une fenêtre en
 * heures traîne l'historique : le score 2-1, éteint depuis 21 h, restait signalé
 * à 85 % parce que la fenêtre de 48 heures contenait encore les 143 analyses
 * fautives de la veille. Un signal qui se déclenche à tort finit ignoré.
 *
 * En prenant les dernières analyses, le contrôle décrit ce que l'application
 * produit MAINTENANT, quel que soit le trafic.
 */
const ANALYSES_EXAMINEES = 40;
const MINIMUM_POUR_JUGER = 15;

/**
 * Vingt-quatre heures, et non six.
 *
 * La fenêtre de six heures était vidée par la nuit. Mesuré sur quarante-huit
 * heures réelles : elle tombait sous les quinze analyses requises 52 % DU
 * TEMPS — et sous ce seuil, la fonction abandonnait TOUS les contrôles de
 * qualité. Le défaut du « 2-1 » pouvait donc revenir et passer inaperçu la
 * moitié de chaque journée, pendant que l'audit affichait une ligne rassurante
 * sur le manque de volume.
 *
 * Vingt-quatre heures couvrent un cycle complet de fréquentation : creux de
 * 3 h à 7 h, pics à 10 h et 21 h. Le même instant qui ne donnait que 12
 * analyses en six heures en donne 46 sur vingt-quatre.
 *
 * Élargir la fenêtre ne dilue pas les défauts récents : `selonAnciennete()`
 * date la ligne fautive la PLUS RÉCENTE, si bien qu'un défaut éteint depuis
 * deux heures est annoncé comme résorbé, quelle que soit la fenêtre.
 */
const AGE_MAX_HEURES = 24;

/**
 * En dessous, l'application ne tourne plus : ce n'est pas un creux de trafic.
 * Sur les journées observées, le minimum sur vingt-quatre heures reste très
 * au-dessus — descendre ici signale une panne, pas une nuit calme.
 */
const ACTIVITE_MINIMALE_24H = 5;

async function verifierAnalyses() {
  titre(`4. QUALITÉ DES ANALYSES (${ANALYSES_EXAMINEES} dernières prédictions)`);

  const { data, error } = await sb
    .from('analysis_history')
    .select('score, confidence, win_prob, is_finished, created_at, team1_name, team2_name')
    .eq('is_finished', false)
    .gte('created_at', new Date(Date.now() - AGE_MAX_HEURES * 3600 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(ANALYSES_EXAMINEES);
  if (error) return alerte(`analyses illisibles : ${error.message}`);

  const predictions = data ?? [];

  // Aucune analyse du tout : c'est une panne, et elle prime sur le reste.
  if (predictions.length < ACTIVITE_MINIMALE_24H)
    return alerte(
      `seulement ${predictions.length} prédiction(s) sur ${AGE_MAX_HEURES} h — le moteur d'analyse est probablement à l'arrêt`
    );

  // Volume faible mais réel : on contrôle quand même. Un défaut visible sur
  // huit analyses reste un défaut ; renoncer à regarder était le vrai risque.
  if (predictions.length < MINIMUM_POUR_JUGER)
    console.log(
      `            (${predictions.length} prédictions seulement — contrôles menés, conclusions à nuancer)`
    );

  const plusAncienne = predictions[predictions.length - 1]?.created_at;
  if (plusAncienne) console.log(`            (depuis ${new Date(plusAncienne).toLocaleString('fr-FR')})`);

  // Un score qui domine, c'est le défaut historique : 82 % des analyses
  // annonçaient 2-1 parce que le score était demandé au modèle au lieu d'être
  // calculé.
  //
  // UNE AFFICHE COMPTE POUR UNE, PAS POUR VINGT.
  //
  // Le contrôle comptait les analyses. Or le même match est analysé en boucle :
  // vingt personnes ont demandé FC Barcelone — Elche dans la même journée, et
  // le calcul rend évidemment vingt fois le même score. Ce n'est pas un défaut,
  // c'est un match populaire — mais cela suffisait à faire franchir le seuil et
  // à crier à la panne. Le vrai défaut du « 2-1 », lui, dominait sur des
  // affiches DIFFÉRENTES : c'est cela qu'il faut mesurer.
  const parMatch = new Map();
  for (const a of predictions) {
    if (!a.score) continue;
    const cle = [a.team1_name, a.team2_name].map((n) => String(n ?? '').toLowerCase()).sort().join('|');
    if (!parMatch.has(cle)) parMatch.set(cle, new Map());
    const m = parMatch.get(cle);
    m.set(a.score, (m.get(a.score) ?? 0) + 1);
  }

  const parScore = new Map();
  for (const scores of parMatch.values()) {
    // Le score retenu pour une affiche est celui qui y revient le plus.
    const majoritaire = [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
    parScore.set(majoritaire, (parScore.get(majoritaire) ?? 0) + 1);
  }
  const avecScore = parMatch.size;
  const dominant = [...parScore.entries()].sort((a, b) => b[1] - a[1])[0];

  // `predictions` est trié du plus récent au plus ancien : la première ligne
  // fautive rencontrée est donc la plus récente, celle qui dit si le défaut
  // sévit encore.
  const derniere = (predicat) => predictions.find(predicat)?.created_at ?? null;

  if (avecScore === 0) alerte('aucune prédiction ne porte de score');
  else {
    const part = (dominant[1] / avecScore) * 100;
    // En dessous de dix affiches distinctes, un pourcentage ne veut rien dire :
    // sur six matchs, deux fois le même score font déjà 33 %. On le montre sans
    // en tirer d'alarme.
    if (avecScore < 10)
      ok(`score le plus fréquent : ${dominant[0]} sur ${dominant[1]} des ${avecScore} affiches — trop peu pour juger`);
    else if (part > 45)
      selonAnciennete(
        derniere((a) => a.score === dominant[0]),
        `le score ${dominant[0]} revient sur ${dominant[1]} des ${avecScore} affiches distinctes (${part.toFixed(0)} %) — un score qui domine signale un calcul en panne`
      );
    else
      ok(
        `score le plus fréquent : ${dominant[0]} à ${part.toFixed(0)} % ` +
        `(${parScore.size} scores distincts sur ${avecScore} affiches)`
      );
  }

  const sansScore = predictions.filter((a) => !a.score).length;
  const partSansScore = (sansScore / predictions.length) * 100;
  if (partSansScore > 20)
    selonAnciennete(
      derniere((a) => !a.score),
      `${partSansScore.toFixed(0)} % des prédictions n'ont pas de score enregistré`
    );
  else ok(`${sansScore} prédiction(s) sans score sur ${predictions.length}`);

  // Une confiance qui se répète à l'identique révèle une valeur par défaut, pas
  // une mesure.
  const parConfiance = new Map();
  for (const a of predictions) if (a.confidence != null) parConfiance.set(a.confidence, (parConfiance.get(a.confidence) ?? 0) + 1);
  const avecConfiance = [...parConfiance.values()].reduce((t, n) => t + n, 0);
  if (avecConfiance > 0) {
    const conf = [...parConfiance.entries()].sort((a, b) => b[1] - a[1])[0];
    const part = (conf[1] / avecConfiance) * 100;
    if (part > 50)
      selonAnciennete(
        derniere((a) => a.confidence === conf[0]),
        `la confiance vaut ${conf[0]} % dans ${part.toFixed(0)} % des cas — valeur par défaut probable`
      );
    else ok(`confiance la plus fréquente : ${conf[0]} % à ${part.toFixed(0)} %`);

    const extremes = predictions.filter((a) => a.confidence != null && (a.confidence >= 100 || a.confidence < 40));
    if (extremes.length > 0)
      selonAnciennete(
        derniere((a) => a.confidence != null && (a.confidence >= 100 || a.confidence < 40)),
        `${extremes.length} prédiction(s) affichent une confiance de 100 % ou inférieure à 40 %`
      );
    else ok('aucune confiance aberrante');
  }

  const recentes = predictions.filter((a) => Date.now() - new Date(a.created_at) < 6 * 3600 * 1000).length;
  ok(`${recentes} analyse(s) sur les six dernières heures`);
}

// ── 5. Échecs du moteur ──────────────────────────────────────────────────────

async function verifierEchecs() {
  titre("5. ÉCHECS DU MOTEUR D'ANALYSE");
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ data: echecs }, { count: total }] = await Promise.all([
    sb.from('analysis_failures').select('cause, servi_quand_meme').gte('created_at', depuis),
    sb.from('analysis_history').select('id', { count: 'exact', head: true }).gte('created_at', depuis),
  ]);

  const n = echecs?.length ?? 0;
  const analyses = total ?? 0;
  const taux = analyses + n > 0 ? (n / (analyses + n)) * 100 : 0;

  if (taux > 20) alerte(`${taux.toFixed(0)} % d'échecs sur 24 h (${n} échecs pour ${analyses} analyses)`);
  else if (n > 0) ok(`${n} échec(s) sur 24 h, soit ${taux.toFixed(0)} %`);
  else ok('aucun échec sur 24 h');

  const perdus = (echecs ?? []).filter((e) => !e.servi_quand_meme).length;
  if (perdus > 0) alerte(`${perdus} abonné(s) sont restés SANS réponse`);

  const causes = new Map();
  for (const e of echecs ?? []) causes.set(e.cause, (causes.get(e.cause) ?? 0) + 1);
  for (const [c, k] of causes) console.log(`            cause « ${c} » : ${k}`);
}

// ── 6. Paiements ─────────────────────────────────────────────────────────────

async function verifierPaiements() {
  titre('6. PAIEMENTS');
  const { data } = await sb
    .from('payment_intents')
    .select('pays, pays_source, consumed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const avecOrigine = (data ?? []).filter((p) => p.pays);
  if (avecOrigine.length === 0) return attention('aucune demande de paiement avec origine enregistrée');

  const enEchec = avecOrigine.filter((p) => p.pays_source === 'defaut').length;
  if (enEchec > 0) alerte(`${enEchec} paiement(s) sans pays détecté — moyens de paiement possiblement inadaptés`);
  else ok(`${avecOrigine.length} demandes situées, aucune détection en échec`);

  const paysUS = avecOrigine.filter((p) => p.pays === 'US').length;
  if (paysUS / avecOrigine.length > 0.5)
    alerte(`${paysUS} demandes sur ${avecOrigine.length} sont rattachées aux États-Unis — la détection est probablement retombée en panne`);

  // Le taux d'aboutissement est un chiffre commercial, pas un défaut : il est
  // bas parce que la plupart des gens repartent sans essayer de payer. Une
  // alerte qu'aucune correction de code ne peut éteindre finit par apprendre à
  // ne plus lire l'audit — donc on l'affiche, on n'alerte pas dessus.
  const recentes = avecOrigine.filter((p) => Date.now() - new Date(p.created_at) < 7 * 86400000);
  if (recentes.length >= 5) {
    const part = (recentes.filter((p) => p.consumed_at).length / recentes.length) * 100;
    ok(`${part.toFixed(0)} % des demandes de la semaine ont été payées (${recentes.length} demandes)`);
  }

  await verifierClientsLeses();
}

/**
 * La seule question de paiement qui mérite une alerte : quelqu'un a-t-il payé
 * sans rien recevoir ? Deux façons — la boutique dit « payé » et la
 * notification n'est jamais arrivée, ou elle est arrivée sans produire
 * d'abonnement.
 */
async function verifierClientsLeses() {
  const champs = 'sale_id, user_id, email, consumed_at, created_at, match_key';
  // Le statut déjà relevé évite un appel réseau. La colonne peut ne pas exister
  // si la migration n'a pas encore été appliquée : on retombe alors sur le
  // relevé en direct plutôt que d'abandonner la vérification.
  let { data } = await sb
    .from('payment_intents')
    .select(`${champs}, statut_boutique`)
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (!data) {
    ({ data } = await sb
      .from('payment_intents')
      .select(champs)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(200));
  }

  if (!data?.length) return;

  const leses = [];
  let payees = 0;
  let appels = 0;
  let partiel = false;
  let nonVerifiees = 0;

  for (const i of data) {
    if (!i.consumed_at) {
      let statut = i.statut_boutique ?? null;

      if (!statut) {
        // Interroger la boutique coûte un appel réseau : plafonné, car l'audit
        // ne doit jamais devenir la chose la plus lente de la journée.
        if (appels >= 60) { partiel = true; nonVerifiees++; continue; }
        appels++;
        try {
          const r = await fetch(`https://api.chariow.com/v1/sales/${i.sale_id}`, {
            headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' },
          });
          statut = (await r.json())?.data?.status ?? null;

          // LE STATUT RELEVÉ EST CONSERVÉ.
          //
          // Sans cela, les mêmes paniers abandonnés étaient réinterrogés à
          // chaque passage. Ils s'accumulent : à soixante-trois ventes pour un
          // plafond de soixante appels, une part croissante n'était plus
          // vérifiée du tout — et c'est précisément ce contrôle qui attrape le
          // client débité dont la notification n'est jamais arrivée. Le trou
          // grandissait en silence, sans jamais rien casser.
          //
          // Un statut définitif ne change plus : le relever une fois suffit.
          if (['completed', 'settled', 'abandoned', 'failed'].includes(statut)) {
            await sb.from('payment_intents').update({ statut_boutique: statut }).eq('sale_id', i.sale_id);
          }
        } catch {
          // Boutique injoignable : on ne conclut pas à un client lésé.
          continue;
        }
      }

      {
        if (statut === 'completed' || statut === 'settled') {
          payees++;
          leses.push(`${i.email} — payé chez la boutique, la notification n'est jamais arrivée`);
        }
      }
      continue;
    }

    payees++;

    // Un match acheté à l'unité est honoré par `matchs_debloques`, pas par un
    // abonnement. Sans ce cas, la toute première vente réussie a été signalée
    // comme un client volé — alors qu'il avait reçu exactement ce qu'il avait
    // payé, 76 secondes après son paiement. Une alerte qui se déclenche à
    // chaque vente réussie finit ignorée, et c'est justement celle qui doit
    // attraper les vrais cas.
    if (i.match_key) {
      const { data: dbq } = await sb
        .from('matchs_debloques')
        .select('id')
        .eq('user_id', i.user_id)
        .eq('match_key', i.match_key)
        .limit(1);
      if ((dbq?.length ?? 0) === 0)
        leses.push(`${i.email} — match payé mais jamais débloqué`);
      continue;
    }

    if (!i.user_id) {
      leses.push(`${i.email} — paiement encaissé sans compte rattaché`);
      continue;
    }

    const { data: abos, error: erreurAbo } = await sb
      .from('subscriptions')
      .select('status')
      .eq('user_id', i.user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    // NE JAMAIS CONFONDRE « PAS D'ABONNEMENT » AVEC « JE N'AI PAS PU LIRE ».
    //
    // Sans ce contrôle, une lecture qui échoue rend `abos` indéfini, et le code
    // en concluait qu'aucun abonnement n'existait : l'alerte la plus grave du
    // système — « un client a payé sans rien recevoir » — se déclenchait sur un
    // simple hoquet réseau. C'est arrivé le 16 août sur deux comptes dont les
    // abonnements étaient parfaitement actifs, et l'alerte a disparu au passage
    // suivant. Une alerte qui crie au vol pour une lecture ratée finit ignorée
    // le jour où le vol est réel.
    if (erreurAbo) {
      partiel = true;
      nonVerifiees++;
      continue;
    }

    const statut = abos?.[0]?.status;
    if (statut !== 'active' && statut !== 'trialing')
      leses.push(`${i.email} — ${statut ? `abonnement en statut « ${statut} »` : 'aucun abonnement créé'}`);
  }

  if (leses.length) leses.forEach((l) => alerte(`a payé sans recevoir son abonnement : ${l}`));
  else if (payees > 0) ok(`${payees} paiement(s) encaissé(s), tous ont reçu leur abonnement`);

  // Le message dit COMBIEN et POURQUOI.
  //
  // « toutes les demandes n'ont pas pu être vérifiées » ne disait ni l'ampleur
  // ni la cause, et accusait la boutique alors que l'échec pouvait venir d'une
  // lecture en base. Un avertissement qu'on ne sait pas interpréter finit
  // ignoré.
  if (partiel)
    attention(
      `${nonVerifiees} demande(s) non vérifiée(s) : plafond de 60 relevés atteint — ` +
        `elles le seront au prochain passage`
    );
}

// ── 7. Agent VIP ─────────────────────────────────────────────────────────────

async function verifierAgentVip() {
  titre('7. AGENT VIP');
  const { data } = await sb
    .from('vip_conversations')
    .select('recherches_web, motif_arret, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!data?.length) return ok('aucun échange enregistré pour le moment');

  const sansRecherche = data.filter((e) => e.recherches_web === 0).length;
  const part = (sansRecherche / data.length) * 100;
  if (part > 20) alerte(`${part.toFixed(0)} % des réponses sans aucune recherche web — informations potentiellement périmées`);
  else ok(`${sansRecherche} réponse(s) sans recherche sur ${data.length}`);

  const tronquees = data.filter((e) => e.motif_arret === 'max_tokens').length;
  if (tronquees > data.length * 0.15) attention(`${tronquees} réponse(s) coupées avant la fin`);
}

// ── 8. Site public ───────────────────────────────────────────────────────────

async function verifierSitePublic() {
  titre('8. SITE PUBLIC');
  const html = await reessayer(async () => {
    const r = await fetch(SITE, { headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }).catch((e) => {
    alerte(`la page d'accueil ne répond pas : ${e.message}`);
    return null;
  });
  if (!html) return;
  ok("page d'accueil accessible");

  // Les prix publiés pour les moteurs de recherche doivent suivre les tarifs
  // réels : sinon le visiteur arrive sur un montant différent de celui annoncé.
  const publies = [...html.matchAll(/"name":"([^"]+)","price":"(\d+)"/g)];
  for (const [, nom, prix] of publies) {
    const attendu = TARIFS[nom];
    if (attendu && Number(prix) !== attendu) alerte(`prix publié pour ${nom} : ${prix} au lieu de ${attendu}`);
  }
  if (publies.length === 0) attention('aucun prix publié pour les moteurs de recherche');
  else if (publies.every(([, n, p]) => !TARIFS[n] || Number(p) === TARIFS[n])) ok('prix publiés conformes aux tarifs');

  const apercu = await reessayer(async () => fetch(`${SITE}/opengraph-image`));
  if (!apercu.ok) alerte(`l'image d'aperçu des liens partagés est en panne (HTTP ${apercu.status})`);
  else ok("image d'aperçu des liens partagés opérationnelle");
}

// ── 9. Accès offerts ─────────────────────────────────────────────────────────

async function verifierPartenaires() {
  titre('9. ACCÈS PARTENAIRES');
  const source = fs.readFileSync('src/lib/subscription.ts', 'utf8');
  const bloc = source.slice(source.indexOf('const PERMANENT_VIP_EMAILS'), source.indexOf('/**', source.indexOf('const PERMANENT_VIP_EMAILS')));
  const emails = [...bloc.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]);
  ok(`${emails.length} accès VIP offerts : ${emails.join(', ')}`);

  // ── Qui a les clés de l'administration ──────────────────────────────────
  //
  // La liste vit désormais dans un module unique, et non plus dans le module
  // d'abonnement. L'audit doit lire LÀ où la décision est prise : la lire
  // ailleurs le laisserait muet le jour où quelqu'un s'ajoute.
  //
  // Deux dangers opposés, tous deux silencieux :
  //  – le fondateur disparaît de la liste et se retrouve dehors ;
  //  – une adresse s'ajoute sans qu'on l'ait décidé.
  const ATTENDUS = ['h9422320@gmail.com', 'traoreismaela753@gmail.com'];

  const sourceAdmins = fs.readFileSync('src/lib/admins.ts', 'utf8');
  const blocAdmins = sourceAdmins.slice(
    sourceAdmins.indexOf('ADMIN_EMAILS'),
    sourceAdmins.indexOf('];', sourceAdmins.indexOf('ADMIN_EMAILS'))
  );
  const admins = [...blocAdmins.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1].toLowerCase());

  if (!admins.includes('h9422320@gmail.com'))
    alerte("le compte fondateur n'est plus administrateur — accès perdu au prochain déploiement");

  const inattendus = admins.filter((e) => !ATTENDUS.includes(e));
  if (inattendus.length) alerte(`administrateur(s) non prévu(s) : ${inattendus.join(', ')}`);

  const manquants = ATTENDUS.filter((e) => !admins.includes(e));
  if (manquants.length) attention(`administrateur(s) attendu(s) mais absent(s) : ${manquants.join(', ')}`);

  if (!inattendus.length && !manquants.length)
    ok(`${admins.length} administrateur(s), conformes : ${admins.join(', ')}`);

  // Une adresse écrite avec une majuscule ne serait jamais reconnue, puisque la
  // comparaison se fait en minuscules.
  const casse = [...blocAdmins.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]).filter((e) => e !== e.toLowerCase());
  if (casse.length) alerte(`adresse(s) administrateur avec une majuscule, donc jamais reconnue(s) : ${casse.join(', ')}`);
}

// ── 10. Équipes sélectionnables ──────────────────────────────────────────────

/**
 * Un sélecteur d'équipes en panne ne produit AUCUNE erreur.
 *
 * L'abonné cherche son club, ne le trouve pas, et en conclut que
 * l'application ne connaît pas son match. Il ne se plaint pas : il ne
 * revient pas. C'est arrivé au FC Bâle le 16/08/2026, le jour de
 * Bâle–Barcelone, et rien ne l'a signalé — c'est un utilisateur qui l'a vu.
 *
 * Les trois pannes possibles sont silencieuses :
 *   – la réserve se vide ou vieillit, et le sélecteur ne propose plus rien ;
 *   – un championnat disparaît de la relecture, et tout un pays s'évapore ;
 *   – deux clubs partagent un identifiant, et on analyse le mauvais.
 */
async function verifierEquipes() {
  titre('10. ÉQUIPES SÉLECTIONNABLES');

  const { data, error } = await sb
    .from('equipes')
    .select('id, api_id, nom, championnat, mise_a_jour_le');

  if (error) {
    // Sans la réserve l'application interroge le fournisseur : elle fonctionne,
    // mais chaque démarrage à froid coûte cinquante-huit appels.
    attention(`réserve d'équipes illisible (${error.message}) — le fournisseur est interrogé à chaque fois`);
    return;
  }
  if (!data?.length) {
    alerte("aucune équipe en réserve — le sélecteur dépend entièrement du fournisseur");
    return;
  }

  const heures = (Date.now() - Math.max(...data.map((e) => new Date(e.mise_a_jour_le).getTime()))) / 3600000;
  if (heures > 48) alerte(`réserve d'équipes vieille de ${Math.round(heures)} h — la tâche quotidienne ne tourne plus`);
  else if (heures > 26) attention(`réserve d'équipes vieille de ${Math.round(heures)} h`);
  else ok(`${data.length} équipes en réserve, relues il y a ${heures < 1 ? 'moins d’une heure' : Math.round(heures) + ' h'}`);

  // Un même identifiant pour deux clubs fait analyser le mauvais, sans rien
  // signaler. Arsenal (Angleterre) et Arsenal (Biélorussie) l'ont déjà fait.
  const doublons = data.length - new Set(data.map((e) => e.id)).size;
  if (doublons > 0) alerte(`${doublons} identifiant(s) d'équipe en double — un club peut en analyser un autre`);
  else ok('aucun identifiant d’équipe en double');

  // Un championnat qui fond signale une relecture partielle : une première
  // division compte rarement moins de huit clubs.
  const parLigue = {};
  for (const e of data) parLigue[e.championnat] = (parLigue[e.championnat] || 0) + 1;
  const maigres = Object.entries(parLigue).filter(([, n]) => n < 8);
  if (maigres.length)
    alerte(`championnat(s) incomplet(s) : ${maigres.map(([l, n]) => `${l} (${n} équipes)`).join(', ')}`);
  else ok(`${Object.keys(parLigue).length} championnats couverts, tous complets`);

  // Témoins : des clubs qui DOIVENT être sélectionnables. Choisis hors des
  // cinq grands championnats, là où les trous se forment sans qu'on les voie.
  // Numéros relevés dans la réserve, jamais devinés : écrits de mémoire, deux
  // d'entre eux étaient faux et l'audit accusait l'application à tort.
  const TEMOINS = [
    [551, 'FC Bâle'], [257, 'Rangers'], [42, 'Arsenal'],
    [556, 'Qarabag'], [566, 'Ludogorets'], [568, 'Sheriff Tiraspol'],
  ];
  const absents = TEMOINS.filter(([id]) => !data.some((e) => e.api_id === id));
  if (absents.length) alerte(`club(s) introuvable(s) dans le sélecteur : ${absents.map(([, n]) => n).join(', ')}`);
  else ok(`clubs témoins tous sélectionnables (${TEMOINS.map(([, n]) => n).join(', ')})`);
}

// ── Exécution ────────────────────────────────────────────────────────────────

console.log(`AUDIT PROFOOT — ${new Date().toLocaleString('fr-FR')}`);

for (const [nom, verification] of [
  ['fournisseur', verifierApiFootball],
  ['boutique', verifierBoutique],
  ['base', verifierBase],
  ['analyses', verifierAnalyses],
  ['échecs', verifierEchecs],
  ['paiements', verifierPaiements],
  ['agent', verifierAgentVip],
  ['site', verifierSitePublic],
  ['partenaires', verifierPartenaires],
  ['équipes', verifierEquipes],
]) {
  try {
    await verification();
  } catch (e) {
    alerte(`la vérification « ${nom} » a planté : ${e?.message}`);
  }
}

console.log('\n' + '═'.repeat(70));
if (anomalies.length === 0 && avertissements.length === 0) {
  console.log('AUCUN PROBLÈME DÉTECTÉ');
} else {
  if (anomalies.length) {
    console.log(`${anomalies.length} ANOMALIE(S) — intervention nécessaire :`);
    anomalies.forEach((a) => console.log(`  • ${a}`));
  }
  if (avertissements.length) {
    console.log(`${avertissements.length} point(s) à surveiller :`);
    avertissements.forEach((a) => console.log(`  • ${a}`));
  }
}
console.log('═'.repeat(70));

process.exit(anomalies.length > 0 ? 1 : 0);
