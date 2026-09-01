import { NextRequest, NextResponse } from 'next/server';
import { desabonner, signerDesabonnement } from '@/lib/campagnes/diffusion';

/**
 * SE DÉSINSCRIRE, EN UN CLIC, SANS COMPTE ET SANS FORMULAIRE.
 *
 * ── POURQUOI CETTE PAGE EST LA PLUS IMPORTANTE DES CAMPAGNES ──────────────
 *
 * Une personne qui veut ne plus rien recevoir et ne trouve pas comment faire
 * ne se résigne pas : elle clique sur « courrier indésirable ». Ce clic ne la
 * retire pas seulement de la campagne — il apprend à Gmail que
 * `profootai.com` envoie du courrier non désiré.
 *
 * Or c'est la même adresse qui envoie les liens de mot de passe et les
 * ouvertures d'accès après paiement. Un signal de spam de trop, et ce sont les
 * clients qui ont payé qui cessent de recevoir leurs accès.
 *
 * Le bouton de désinscription ne protège donc pas la personne qui part. Il
 * protège les 437 qui restent.
 *
 * ── POURQUOI IL FAUT UNE SIGNATURE ────────────────────────────────────────
 *
 * Sans elle, `?e=quelquun@gmail.com` désabonnerait n'importe qui : il
 * suffirait de deviner une adresse. La signature est calculée avec la clé de
 * service, qui ne quitte jamais le serveur.
 *
 * ── POURQUOI UN SEUL CLIC, SANS CONFIRMATION ──────────────────────────────
 *
 * Demander « êtes-vous sûr ? » à quelqu'un qui a déjà décidé de partir, sur un
 * téléphone, c'est le renvoyer vers le bouton « spam » qui, lui, ne demande
 * rien. La désinscription est immédiate, et la page dit comment revenir.
 */

export const dynamic = 'force-dynamic';

function page(titre: string, corps: string, ton: 'ok' | 'erreur' = 'ok') {
  const accent = ton === 'ok' ? '#10B981' : '#F87171';
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre} — ProFoot AI</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0b1418;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}
  .b{max-width:440px;text-align:center}
  h1{font-size:22px;margin:0 0 14px;line-height:1.25}
  p{font-size:15px;line-height:1.6;color:rgba(255,255,255,.62);margin:0 0 22px}
  .p{display:inline-block;width:44px;height:44px;border-radius:50%;background:${accent}1f;
     color:${accent};line-height:44px;font-size:22px;margin-bottom:18px}
  a{display:inline-block;min-height:48px;line-height:48px;padding:0 26px;border-radius:999px;
    background:linear-gradient(135deg,#2DD4BF,#10B981);color:#101c24;font-weight:800;
    text-decoration:none;font-size:14px}
</style></head><body><div class="b">
<div class="p">${ton === 'ok' ? '✓' : '!'}</div>
<h1>${titre}</h1><p>${corps}</p>
<a href="https://profootai.com">Retour à ProFoot AI</a>
</div></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') ?? '').trim().toLowerCase();
  const signature = url.searchParams.get('s') ?? '';

  if (!email || !signature) {
    return page(
      'Lien incomplet',
      "Ce lien ne porte pas toutes les informations nécessaires. Répondez simplement au message que vous avez reçu et nous vous retirerons de la liste à la main.",
      'erreur'
    );
  }

  // ── COMPARAISON À DURÉE CONSTANTE ─────────────────────────────────────────
  //
  // Une comparaison ordinaire s'arrête au premier caractère différent, et le
  // temps de réponse trahit alors combien de caractères étaient justes. Sur un
  // lien de désinscription l'enjeu est modeste, mais le réflexe ne doit pas
  // dépendre de l'enjeu : c'est en le relâchant « quand ce n'est pas grave »
  // qu'on le relâche ailleurs.
  const attendue = await signerDesabonnement(email);
  const { timingSafeEqual } = await import('node:crypto');
  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  const valide = a.length === b.length && timingSafeEqual(a, b);

  if (!valide) {
    return page(
      'Lien invalide',
      "Ce lien de désinscription n'est pas reconnu. Il a peut-être été tronqué par votre messagerie. Répondez au message reçu et nous nous en occuperons.",
      'erreur'
    );
  }

  const fait = await desabonner(email);

  if (!fait) {
    return page(
      'Nous n’avons pas pu enregistrer',
      "Une erreur technique nous a empêchés d'enregistrer votre demande. Répondez au message que vous avez reçu : nous vous retirerons de la liste nous-mêmes.",
      'erreur'
    );
  }

  return page(
    'C’est fait',
    `Nous n'écrirons plus à ${email}. Votre compte et votre accès ne changent pas — seuls les messages s'arrêtent. Les courriels indispensables (mot de passe oublié, confirmation d'un achat) continueront de vous parvenir.`
  );
}
