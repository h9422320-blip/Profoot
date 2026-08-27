/**
 * LE BANC D'ESSAI PAWAPAY, EXÉCUTÉ LÀ OÙ LE JETON SE TROUVE.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ───────────────────────────────────────────
 *
 * Le jeton vit dans les variables de Vercel. Le rapatrier sur un poste de
 * travail demande le CLI Vercel, qui demande PowerShell, qui refuse d'exécuter
 * des scripts par défaut sur Windows. Trois obstacles pour déplacer un secret
 * qui n'a aucune raison de bouger. Le serveur, lui, l'a déjà.
 *
 * ── POURQUOI EN DEUX TEMPS ────────────────────────────────────────────────
 *
 * Premier essai le 27 août 2026 : erreur 524. Le domaine passe par Cloudflare,
 * qui coupe TOUTE requête à cent secondes. Huit encaissements suivis chacun
 * jusqu'à son statut définitif en demandaient environ cent trente.
 *
 * On sépare donc ce qui est long de ce qui ne l'est pas :
 *
 *     ?action=lancer   huit encaissements partent, on rend la main aussitôt
 *     ?action=lire     on relit les huit statuts et on rend le verdict
 *
 * Entre les deux, une trentaine de secondes suffisent : PawaPay tranche vite
 * en bac à sable. Les identifiants sont gardés dans la réserve, pas renvoyés
 * à l'appelant — sinon il faudrait les recoller à la main.
 *
 * ── TROIS VERROUS ─────────────────────────────────────────────────────────
 *
 *   1. réservée à l'administration ;
 *   2. REFUSE de tourner ailleurs que sur le bac à sable — un banc d'essai qui
 *      déclenche de vrais encaissements ne se rattrape pas ;
 *   3. ne touche pas aux abonnements : aucun accès ne peut s'ouvrir par ici.
 *
 * Le jeton n'apparaît jamais dans la réponse, ni sa longueur, ni son début.
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { estAdmin } from '@/lib/admins';
import { baseUrl, estProduction, pawapayConfigure } from '@/lib/pawapay';
import { lireReserve, ecrireReserve } from '@/lib/api-football';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Où les identifiants attendent entre le lancement et la lecture. */
const CLE_RESERVE = 'pawapay:essai:encours';

/**
 * Numéros de test officiels PawaPay. La terminaison décide de l'issue :
 * …789 aboutit, …129 reste en cours, …049 et …019 échouent.
 */
const ESSAIS = [
  { nom: 'réussite 1', tel: '254703456789', attendu: 'COMPLETED', montant: '100' },
  { nom: 'réussite 2', tel: '254703456789', attendu: 'COMPLETED', montant: '250' },
  { nom: 'réussite 3', tel: '254703456789', attendu: 'COMPLETED', montant: '500' },
  { nom: 'réussite 4', tel: '254703456789', attendu: 'COMPLETED', montant: '750' },
  { nom: 'réussite 5', tel: '254703456789', attendu: 'COMPLETED', montant: '1000' },
  { nom: 'solde insuffisant', tel: '254703456049', attendu: 'FAILED', montant: '100' },
  { nom: 'plafond atteint', tel: '254703456019', attendu: 'FAILED', montant: '100' },
  { nom: 'reste en cours', tel: '254703456129', attendu: 'PENDING', montant: '100' },
];

const OPERATEUR = 'MPESA_KEN';
const DEVISE = 'KES';

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!estAdmin(user?.email)) {
    return NextResponse.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }

  if (!pawapayConfigure()) {
    return NextResponse.json({
      erreur: 'PAWAPAY_API_TOKEN absent du serveur.',
      aFaire: "Ajoutez la variable dans Vercel puis redéployez : les variables sont lues au démarrage.",
    }, { status: 503 });
  }

  // ── LE VERROU QUI COMPTE ────────────────────────────────────────────────
  if (estProduction()) {
    return NextResponse.json({
      erreur: 'REFUS : PAWAPAY_BASE_URL pointe vers la production.',
      base: baseUrl(),
      aFaire: 'Ce banc d’essai ne tourne que sur https://api.sandbox.pawapay.io',
    }, { status: 400 });
  }

  const jeton = process.env.PAWAPAY_API_TOKEN!;
  const appel = async (chemin: string, methode: 'GET' | 'POST' = 'GET', corps?: unknown) => {
    const r = await fetch(baseUrl() + chemin, {
      method: methode,
      headers: {
        Authorization: `Bearer ${jeton}`,
        Accept: 'application/json',
        ...(corps ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      cache: 'no-store',
    });
    const texte = await r.text();
    let json: any = null;
    try { json = texte ? JSON.parse(texte) : null; } catch { /* réponse non JSON */ }
    return { http: r.status, json, texte: texte.slice(0, 300) };
  };

  const action = new URL(request.url).searchParams.get('action') ?? 'lancer';

  // ══ LIRE ════════════════════════════════════════════════════════════════
  if (action === 'lire') {
    const garde = await lireReserve<any[]>(CLE_RESERVE);
    if (!garde?.contenu?.length) {
      return NextResponse.json({
        erreur: 'Aucun essai en cours.',
        aFaire: 'Ouvrez d’abord /api/pawapay/essai?action=lancer',
      }, { status: 404 });
    }

    const resultats: any[] = [];
    for (const e of garde.contenu) {
      if (e.obtenu === 'REFUS_A_L_INITIATION') { resultats.push({ ...e, conforme: false }); continue; }
      const s = await appel(`/v2/deposits/${e.depositId}`);
      const statut = s.json?.status === 'FOUND' ? s.json.data?.status ?? null : null;
      const code = s.json?.data?.failureReason?.failureCode ?? null;
      const conforme =
        e.attendu === 'PENDING'
          ? statut !== 'COMPLETED' && statut !== 'FAILED'
          : statut === e.attendu;
      resultats.push({ essai: e.nom, depositId: e.depositId, attendu: e.attendu, obtenu: statut, code, conforme });
    }

    const conformes = resultats.filter((r) => r.conforme).length;
    const aboutis = resultats.filter((r) => r.obtenu === 'COMPLETED').length;
    const enCours = resultats.filter((r) => r.obtenu === 'ACCEPTED' || r.obtenu === 'PROCESSING').length;

    return NextResponse.json({
      environnement: 'SANDBOX',
      essais: resultats,
      bilan: {
        total: resultats.length,
        conformes,
        encaissementsAboutis: aboutis,
        encoreEnCours: enCours,
        verdict:
          conformes === resultats.length
            ? 'TOUT EST CONFORME'
            : enCours > 0
              ? 'ENCORE EN COURS — rechargez dans 20 secondes'
              : 'DES ÉCARTS À REGARDER',
      },
    });
  }

  // ══ LANCER ══════════════════════════════════════════════════════════════
  const conf = await appel('/v2/active-conf');
  if (conf.http !== 200) {
    return NextResponse.json({
      etape: 'configuration',
      erreur: `La passerelle a répondu ${conf.http}.`,
      detail: conf.texte,
    }, { status: 502 });
  }

  const pays = (conf.json?.countries ?? []).map((p: any) => ({
    pays: p.country,
    operateurs: (p.providers ?? []).map((x: any) => x.provider),
  }));

  const lances: any[] = [];
  for (const e of ESSAIS) {
    const depositId = crypto.randomUUID();
    const init = await appel('/v2/deposits', 'POST', {
      depositId,
      amount: e.montant,
      currency: DEVISE,
      payer: { type: 'MMO', accountDetails: { phoneNumber: e.tel, provider: OPERATEUR } },
      clientReferenceId: `ESSAI-${depositId.slice(0, 8)}`,
      customerMessage: 'ProFoot AI',
    });
    const accepte = init.json?.status;
    lances.push({
      nom: e.nom,
      attendu: e.attendu,
      depositId,
      obtenu:
        accepte === 'ACCEPTED' || accepte === 'DUPLICATE_IGNORED'
          ? null
          : 'REFUS_A_L_INITIATION',
      detail:
        accepte === 'ACCEPTED' || accepte === 'DUPLICATE_IGNORED'
          ? undefined
          : init.json?.failureReason?.failureCode ?? `HTTP ${init.http}`,
    });
  }

  // Une heure suffit largement : personne ne relit un essai le lendemain.
  await ecrireReserve(CLE_RESERVE, lances, 3600_000);

  const partis = lances.filter((l) => l.obtenu === null).length;
  return NextResponse.json({
    environnement: 'SANDBOX',
    base: baseUrl(),
    societe: conf.json?.companyName ?? null,
    paysOuverts: pays.length,
    pays,
    encaissementsLances: partis,
    refusesAuDepart: lances.length - partis,
    aFaire: 'Attendez 30 secondes puis ouvrez /api/pawapay/essai?action=lire',
  });
}
