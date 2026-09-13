/**
 * ★ ACQUIS — L'ANALYSE RÉPOND AVANT QUE CLOUDFLARE NE RACCROCHE.
 *
 * ── CE QUI S'EST PASSÉ ───────────────────────────────────────────────────
 *
 * Le 12 septembre 2026, le propriétaire lance une analyse. La barre monte,
 * atteint 93 puis 95 %, et l'écran affiche « ANALYSE INTERROMPUE » avec un
 * bouton « Réessayer ».
 *
 * Côté administration : RIEN. Zéro échec enregistré. La table des pannes ne
 * contenait aucune ligne `servi_quand_meme = false` depuis des jours, et les
 * analyses lentes y figuraient toutes comme « servies ».
 *
 * ── LA CAUSE ─────────────────────────────────────────────────────────────
 *
 * Ce n'est pas Vercel qui coupait le premier, c'est CLOUDFLARE. Le domaine
 * passe par Cloudflare depuis le 19 août ; Cloudflare abandonne une réponse
 * dont l'origine met plus de cent secondes, et sert une 524 à sa place. Le
 * plafond de 300 secondes de Vercel n'était jamais atteint.
 *
 * Or le budget du serveur valait exactement 100 000 ms. Il visait donc la
 * seconde précise où Cloudflare renonce. Les 161 analyses chronométrées
 * depuis le 25 août avaient une médiane de 90,1 s et un maximum de 95,5 s :
 * elles s'écrasaient contre ce plafond. Le serveur croyait répondre, la
 * réponse n'arrivait jamais, et la panne était invisible des deux côtés.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * Le budget total du serveur reste franchement sous la limite de Cloudflare,
 * avec de quoi couvrir le trajet réseau et l'envoi de la réponse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * La limite de Cloudflare, en millisecondes.
 *
 * Elle ne se règle pas depuis ce dépôt : c'est le comportement du proxy, et il
 * s'applique quoi que fasse l'application. La seule variable qui nous
 * appartient est le temps que le serveur s'autorise en dessous.
 */
const COUPERET_CLOUDFLARE_MS = 100_000;

/** La marge minimale : trajet Cloudflare → Vercel, TLS, envoi de la réponse. */
const MARGE_MINIMALE_MS = 10_000;

const source = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');

const constante = (nom: string): number => {
  const m = source.match(new RegExp(`const ${nom} = (\\d+);`));
  assert.ok(m, `La constante ${nom} doit exister dans la route d'analyse.`);
  return Number(m![1]);
};

test('★ ACQUIS — le serveur répond avant les cent secondes de Cloudflare', () => {
  const budget = constante('LIMITE_PLATEFORME_MS');

  assert.ok(
    budget + MARGE_MINIMALE_MS <= COUPERET_CLOUDFLARE_MS,
    `Le budget du serveur est de ${budget} ms. Cloudflare raccroche à ${COUPERET_CLOUDFLARE_MS} ms ` +
      `et sert une 524 : il faut au moins ${MARGE_MINIMALE_MS} ms de marge pour le trajet réseau et ` +
      `l'envoi de la réponse. Le 12 septembre 2026, un budget de 100 000 ms a fait voir ` +
      `« ANALYSE INTERROMPUE » à 95 % au propriétaire — sans qu'aucun échec ne soit enregistré, ` +
      `puisque du point de vue du serveur la réponse était partie.`
  );

  // Et il doit rester assez de temps pour que le modèle travaille : un budget
  // ramené trop bas transformerait toutes les analyses en textes de repli.
  assert.ok(budget >= 60_000, `Le budget de ${budget} ms est trop court pour que le modèle rédige.`);
});

test('★ ACQUIS — la réserve de mise en forme reste prise SUR le budget, pas en plus', () => {
  const reserve = constante('RESERVE_MISE_EN_FORME_MS');
  assert.ok(reserve > 0 && reserve < 15_000);
  // Le budget du modèle se calcule en retranchant la réserve du budget total :
  // si la soustraction disparaissait, le modèle pourrait rendre sa réponse à
  // l'instant même où le budget expire, sans temps pour la mettre en forme.
  assert.match(
    source,
    /LIMITE_PLATEFORME_MS - \(Date\.now\(\) - debutRequete\) - RESERVE_MISE_EN_FORME_MS/,
    'Le budget du modèle doit rester borné par le budget total moins la réserve.'
  );
});
