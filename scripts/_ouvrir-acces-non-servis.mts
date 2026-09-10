/**
 * OUVRIR L'ACCÈS DE QUATRE ACHETEURS QUI N'ONT JAMAIS REÇU LEUR COMPTE.
 *
 * ── POURQUOI CET OUTIL EXISTE, ET POURQUOI IL EST EXCEPTIONNEL ───────────
 *
 * La livraison automatique n'ouvre PAS de compte à la place des gens : c'est
 * une décision du propriétaire du 1er septembre 2026, écrite dans
 * `livraison-sans-compte.ts` — « un compte appartient à celui qui l'ouvre ».
 * Elle envoie donc une invitation, et attend.
 *
 * Ces quatre-là ont été invités, une ou deux fois, et ne sont jamais venus.
 * Seize mille francs encaissés, rien délivré, du 2 au 9 septembre. Le
 * propriétaire les a joints un par un sur WhatsApp le 10 septembre et a
 * demandé d'ouvrir leurs accès directement : il peut leur transmettre lui-même
 * de quoi entrer.
 *
 * ── CE QU'IL FAIT, DANS L'ORDRE ─────────────────────────────────────────
 *
 *   1. le compte, s'il n'existe pas ;
 *   2. l'abonnement correspondant à CE QUI A ÉTÉ PAYÉ, une ligne par vente —
 *      qui a payé deux fois reçoit deux fois ;
 *   3. la vente marquée servie, pour qu'aucun balayage ne la reprenne ;
 *   4. un lien pour choisir son mot de passe ;
 *   5. le courriel d'accès, par la fonction de l'application elle-même.
 *
 * ── L'ADRESSE DE BABAOULARE ─────────────────────────────────────────────
 *
 * Il a payé deux fois en écrivant `@4gmail.com` — un domaine qui n'existe
 * pas, le `4` étant juste au-dessus du `g`. Ses deux invitations sont parties
 * dans le vide. Le compte est donc créé sur l'adresse corrigée par
 * `adresseJoignable`, la même règle que la livraison applique désormais.
 *
 * Sans argument : simulation, rien n'est écrit.
 * Avec --ecrire : les comptes et les accès sont créés.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const ECRIRE = process.argv.includes('--ecrire');

const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { adresseJoignable } = await import('../src/lib/livraison-sans-compte.js');
const { PLANS } = await import('../src/lib/subscription.js');
const { courrielDisponible, envoyerCourriel, messageAccesCree } = await import('../src/lib/courriel.js');

const sb = createAdminClient();
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com';

/**
 * Les adresses à servir sont passées en argument — celles du paiement, telles
 * qu'elles figurent sur la vente. L'outil retrouve seul l'adresse joignable
 * quand le domaine est fautif.
 *
 *   npx tsx scripts/_ouvrir-acces-non-servis.mts adresse@exemple.com --ecrire
 */
const CIBLES = process.argv.slice(2).filter((a) => a.includes('@')).map((a) => a.trim().toLowerCase());
if (!CIBLES.length) {
  console.log('\n  Aucune adresse fournie.');
  console.log('  npx tsx scripts/_ouvrir-acces-non-servis.mts adresse@exemple.com [--ecrire] [--par-whatsapp]\n');
  process.exit(1);
}

/**
 * ── ON N'OUVRE PAS UN ACCÈS QU'ON NE PEUT PAS ANNONCER ────────────────────
 *
 * Un abonnement ouvert en silence ne répare rien : la personne ne sait pas
 * qu'elle peut entrer, et garde le souvenir d'avoir payé pour rien.
 *
 * Le courriel est donc exigé — SAUF quand quelqu'un se charge de prévenir
 * autrement. C'est le cas ici : le propriétaire a joint ces quatre acheteurs
 * un par un sur WhatsApp le 10 septembre. La clé d'envoi vit sur le serveur
 * et non sur son poste, d'où ce passage explicite : les liens personnels sont
 * alors imprimés à la fin, pour qu'il les transmette lui-même.
 */
const PAR_WHATSAPP = process.argv.includes('--par-whatsapp');

console.log(ECRIRE ? '\nAPPLICATION\n' : '\nSIMULATION — rien ne sera écrit\n');
if (ECRIRE && !courrielDisponible() && !PAR_WHATSAPP) {
  console.log('  RESEND_API_KEY absente : on n’ouvre aucun accès sans pouvoir prévenir la personne.');
  console.log('  Ajouter --par-whatsapp si les liens sont transmis à la main.');
  process.exit(1);
}

// ── LES VENTES ──────────────────────────────────────────────────────────────
const intentions: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('*').range(de, de + 999);
  intentions.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

// ── LES COMPTES EXISTANTS, LUS EN ENTIER — OU ON S'ARRÊTE ──────────────────
//
// Une coupure réseau pendant ce parcours n'a rendu que 7 000 comptes sur
// 10 389 au premier essai. Sur une liste incomplète, « cette adresse n'a pas
// de compte » devient faux, et l'outil créerait un DOUBLON à quelqu'un qui
// possède déjà le sien — avec son accès payé posé sur le mauvais des deux.
//
// Chaque page est donc réessayée, et si la lecture ne peut pas aboutir, on
// n'écrit rien du tout. Mieux vaut ne rien faire que servir à côté.
const parAdresse = new Map<string, any>();
let lectureComplete = false;
for (let page = 1; page <= 200 && !lectureComplete; page++) {
  let lot: any[] | null = null;
  for (let essai = 1; essai <= 4 && lot === null; essai++) {
    try {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      lot = data?.users ?? [];
    } catch (e: any) {
      console.log(`   (page ${page}, essai ${essai} : ${e?.message ?? e})`);
      if (essai === 4) break;
      await new Promise((r) => setTimeout(r, 1500 * essai));
    }
  }
  if (lot === null) {
    console.log('\n  LECTURE DES COMPTES INCOMPLÈTE — rien ne sera écrit.\n');
    process.exit(1);
  }
  for (const u of lot) parAdresse.set(String(u.email ?? '').toLowerCase(), u);
  if (lot.length < 1000) lectureComplete = true;
}
console.log(`${parAdresse.size} comptes lus, liste complète.\n`);

// ── LES QUOTAS RÉGLÉS, LUS UNE SEULE FOIS ──────────────────────────────────
//
// Ils étaient relus à chaque vente. Une lecture qui échoue retombait alors
// sur la valeur écrite dans le code, sans rien dire : le même plan Pro
// affichait 50 analyses pour l'un et 60 pour l'autre, dans la même passe.
const { data: offres, error: erreurOffres } = await sb.from('offres').select('cle, limite_analyses');
if (erreurOffres || !offres?.length) {
  console.log(`  QUOTAS ILLISIBLES (${erreurOffres?.message ?? 'aucune offre'}) — rien ne sera écrit.\n`);
  process.exit(1);
}
const quotaRegle = new Map<string, number>(offres.map((o: any) => [String(o.cle), Number(o.limite_analyses)]));
console.log('quotas en vigueur : ' + [...quotaRegle].map(([k, v]) => `${k}=${v}`).join(', ') + '\n');

const recapitulatif: {
  adressePayee: string;
  adresseCompte: string;
  analyses: number;
  echeance: string;
  lien: string;
  courriel: boolean;
  paye: number;
}[] = [];

for (const payee of CIBLES) {
  const ventes = intentions.filter((p) => String(p.email ?? '').toLowerCase() === payee);
  const adresse = adresseJoignable(payee).toLowerCase();
  console.log(`── ${payee}${adresse !== payee ? `  →  ${adresse}` : ''}`);

  if (!ventes.length) {
    console.log('   AUCUNE VENTE trouvée — rien fait.\n');
    continue;
  }

  // ── 1. LE COMPTE ──────────────────────────────────────────────────────────
  let compte = parAdresse.get(adresse) ?? null;
  if (compte) {
    console.log(`   compte : existe déjà (${compte.id.slice(0, 8)})`);
  } else if (!ECRIRE) {
    console.log('   compte : SERAIT CRÉÉ');
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: adresse,
      email_confirm: true,
      user_metadata: { cree_par: 'ouverture-acces-non-servis-2026-09-10' },
    });
    if (error || !data?.user) {
      console.log(`   compte : ÉCHEC — ${error?.message}\n`);
      continue;
    }
    compte = data.user;
    console.log(`   compte : créé (${compte.id.slice(0, 8)})`);
  }

  // ── 2. L'ACCÈS, UNE LIGNE PAR VENTE ──────────────────────────────────────
  let analyses = 0;
  let echeance = '';
  let totalPaye = 0;
  for (const v of ventes) {
    const plan = String(v.plan) as keyof typeof PLANS;
    const config = (PLANS as any)[plan];
    if (!config) {
      console.log(`   vente ${String(v.sale_id).slice(0, 8)} : offre « ${plan} » inconnue, ignorée`);
      continue;
    }
    totalPaye += Number(v.amount ?? 0);
    const expireLe = new Date(Date.now() + config.durationDays * 86_400_000).toISOString();
    echeance = expireLe;

    // Le quota affiché suit la valeur RÉGLÉE dans l'administration, pas celle
    // écrite dans le code : c'est elle que voit l'abonné.
    const limite = quotaRegle.get(plan) ?? config.analysisLimit;
    analyses += limite < 0 ? Infinity : limite;

    if (!ECRIRE) {
      console.log(`   accès  : SERAIT OUVERT — ${plan} (${limite} analyses), vente ${String(v.sale_id).slice(0, 8)}`);
      continue;
    }

    // La contrainte d'unicité porte sur la référence de vente : relancer cet
    // outil ne peut pas offrir un second abonnement pour le même paiement.
    const { error } = await sb.from('subscriptions').upsert(
      {
        user_id: compte.id,
        plan,
        status: 'active',
        provider: 'maketou',
        chariow_sale_id: String(v.sale_id),
        amount: config.amountXof,
        currency: 'XOF',
        expires_at: expireLe,
      },
      { onConflict: 'chariow_sale_id', ignoreDuplicates: true }
    );
    if (error) {
      console.log(`   accès  : ÉCHEC sur ${String(v.sale_id).slice(0, 8)} — ${error.message}`);
      continue;
    }
    console.log(`   accès  : ouvert — ${plan} (${limite} analyses), vente ${String(v.sale_id).slice(0, 8)}`);

    // ── 3. LA VENTE EST SERVIE ─────────────────────────────────────────────
    await sb
      .from('payment_intents')
      .update({ user_id: compte.id, consumed_at: new Date().toISOString() })
      .eq('sale_id', String(v.sale_id));

    // La trace, pour qu'aucun balayage ne reprenne cette vente.
    await sb.from('webhook_events').insert({
      provider: 'livraison',
      delivery_id: `livraison-${v.sale_id}`,
      event: 'compte_cree_et_acces_ouvert',
      payload: {
        plan,
        email: adresse,
        email_paye: payee,
        user_id: compte.id,
        livre_le: new Date().toISOString(),
        expire_le: expireLe,
        motif: 'ouverture demandee par le proprietaire le 2026-09-10',
      },
    });
  }

  // ── 4. LE LIEN POUR CHOISIR SON MOT DE PASSE ─────────────────────────────
  let lien = `${SITE}/mot-de-passe-oublie`;
  let courrielParti = false;
  if (ECRIRE && compte) {
    const { data: gen, error: erreurLien } = await sb.auth.admin.generateLink({
      type: 'recovery',
      email: adresse,
    });
    const jeton = gen?.properties?.hashed_token;
    if (jeton) lien = `${SITE}/reinitialiser-mot-de-passe?token_hash=${jeton}&type=recovery`;
    else console.log(`   lien   : non généré — ${erreurLien?.message ?? 'jeton absent'}`);

    // ── 5. LE MESSAGE ──────────────────────────────────────────────────────
    const libelle = ventes.length > 1 ? 'Essentiel (×2)' : (PLANS as any)[String(ventes[0].plan)]?.label ?? 'Essentiel';
    if (courrielDisponible()) {
      try {
        courrielParti = await envoyerCourriel({
          a: adresse,
          ...messageAccesCree(lien, libelle, echeance),
        });
      } catch (e: any) {
        console.log(`   courriel : ÉCHEC — ${e?.message}`);
      }
      console.log(`   courriel : ${courrielParti ? 'parti' : 'NON parti'} vers ${adresse}`);
    } else {
      console.log('   courriel : non envoyé d’ici — lien à transmettre à la main');
    }
  }

  recapitulatif.push({
    adressePayee: payee,
    adresseCompte: adresse,
    analyses,
    echeance,
    lien,
    courriel: courrielParti,
    paye: totalPaye,
  });
  console.log('');
}

console.log('\n=== RÉCAPITULATIF ===');
for (const r of recapitulatif)
  console.log(
    `  ${r.adresseCompte.padEnd(38)} ${String(r.analyses).padStart(3)} analyses  ${r.paye} F payés  ` +
      `échéance ${r.echeance.slice(0, 10)}  courriel ${r.courriel ? 'oui' : 'non'}`
  );

if (ECRIRE) {
  console.log('\n=== LIENS PERSONNELS (à transmettre sur WhatsApp) ===');
  for (const r of recapitulatif) console.log(`\n  ${r.adresseCompte}\n  ${r.lien}`);
}
