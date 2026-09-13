import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { confirmerRattachement } from '@/lib/reclamation-paiement';

export const dynamic = 'force-dynamic';

/**
 * LE CLIC DANS LA BOÎTE DU PAYEUR.
 *
 * ── POURQUOI CETTE ROUTE N'EXIGE PAS D'ÊTRE CONNECTÉ ─────────────────────
 *
 * Le lien est ouvert depuis une boîte de courriels, souvent sur un autre
 * appareil que celui où la demande a été faite — le téléphone plutôt que
 * l'ordinateur. Exiger une session ferait tomber le payeur sur un écran de
 * connexion, c'est-à-dire exactement l'obstacle que ce filet doit supprimer.
 *
 * La sécurité ne vient pas de la session : elle vient du jeton, qui n'a été
 * envoyé qu'à l'adresse de paiement. Le compte bénéficiaire a été fixé au
 * moment de la demande et ne peut pas être changé ici — ce n'est donc pas
 * celui qui clique qui décide, c'est celui qui relève la boîte qui autorise.
 *
 * ── ET ELLE NE FAIT RIEN D'AUTRE ─────────────────────────────────────────
 *
 * Un lien inconnu, expiré, déjà utilisé, ou dont la vente a été servie
 * entre-temps ne provoque aucune écriture. Chaque cas a son message : quelqu'un
 * qui a payé et qui clique doit comprendre ce qui se passe, pas voir « erreur ».
 */
export async function GET(req: Request) {
  const jeton = new URL(req.url).searchParams.get('jeton') ?? '';
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  let issue;
  try {
    issue = await confirmerRattachement(createAdminClient(), jeton);
  } catch (e: any) {
    console.error('[RECLAMATION] Confirmation impossible :', e?.message ?? e);
    issue = { ok: false as const, raison: 'echec' as const };
  }

  // Une page, et non du JSON : ce lien s'ouvre dans un navigateur, depuis une
  // application de courriel.
  const page = (titre: string, corps: string, couleur: string, bouton: string, lien: string) =>
    new NextResponse(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<meta name="robots" content="noindex">` +
        `<title>${titre} — ProFoot AI</title><style>` +
        `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
        `background:#0b1c24;color:#fff;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}` +
        `.c{max-width:440px;text-align:center;background:#12242e;border:1px solid rgba(255,255,255,.07);` +
        `border-radius:28px;padding:36px 28px}` +
        `h1{font-size:22px;margin:0 0 14px;color:${couleur}}p{color:rgba(255,255,255,.72);margin:0 0 26px}` +
        `a{display:inline-block;background:linear-gradient(135deg,#10B981,#059669);color:#fff;` +
        `text-decoration:none;font-weight:800;padding:14px 28px;border-radius:16px}` +
        `</style></head><body><div class="c"><h1>${titre}</h1><p>${corps}</p>` +
        `<a href="${lien}">${bouton}</a></div></body></html>`,
      { status: issue.ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );

  if (issue.ok)
    return page(
      'Votre accès est ouvert',
      'Votre paiement a bien été rattaché à votre compte. Vous pouvez analyser dès maintenant.',
      '#34D399',
      'Ouvrir ProFoot AI',
      `${base}/analyze`
    );

  const messages: Record<string, string> = {
    lien_inconnu: "Ce lien n'est pas valable. Refaites la demande depuis l'application pour en recevoir un nouveau.",
    lien_expire: 'Ce lien a plus de trente minutes et ne fonctionne plus. Refaites la demande, vous en recevrez un nouveau aussitôt.',
    lien_deja_utilise: 'Ce lien a déjà servi. Si votre accès ne s’est pas ouvert, écrivez-nous — nous le ferons à la main.',
    vente_deja_servie: 'Ce paiement a déjà été rattaché à un compte entre-temps. Connectez-vous : votre accès vous attend.',
    echec: "L'accès n'a pas pu être ouvert. Écrivez-nous, nous le ferons à la main — votre paiement n'est pas perdu.",
  };

  return page(
    'Ce lien n’a pas fonctionné',
    messages[issue.raison] ?? messages.echec,
    '#FBBF24',
    "Retour à l'application",
    `${base}/analyze`
  );
}
