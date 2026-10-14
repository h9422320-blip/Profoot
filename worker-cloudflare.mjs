/**
 * LE POINT D'ENTRÉE DU SITE CHEZ CLOUDFLARE.
 *
 * Il fait deux choses : il sert les pages (c'est le worker fabriqué par
 * l'adaptateur, repris tel quel), et il déclenche les tâches planifiées.
 *
 * ── POURQUOI UNE SEULE TÂCHE AU LIEU DE TREIZE ────────────────────────────
 *
 * Cloudflare n'accorde que cinq tâches planifiées par compte sur le plan
 * gratuit. `wrangler.jsonc` n'en déclare donc qu'une, qui se réveille aux
 * minutes utiles, et c'est le tableau ci-dessous qui décide quoi lancer. Les
 * horaires sont ceux de `vercel.json`, à la minute près — l'épreuve
 * `tests/taches-planifiees.test.ts` compare les deux et refuse toute dérive.
 *
 * ── L'APPEL PASSE PAR LA PORTE D'ENTRÉE, PAS PAR LA FENÊTRE ───────────────
 *
 * Les routes sont appelées par le `fetch` du worker, avec le même jeton que
 * Vercel envoyait (`Authorization: Bearer <CRON_SECRET>`). Aucune route n'est
 * importée directement : elles gardent leur garde-barrière, et une tâche
 * déclenchée à la main depuis l'extérieur reste refusée.
 *
 * ── UNE TÂCHE QUI ÉCHOUE N'EMPORTE PAS LES AUTRES ─────────────────────────
 *
 * Chaque appel est isolé. Si le fournisseur de données répond mal à une
 * tâche, les suivantes partent quand même — c'est le contraire du comportement
 * d'une liste d'appels enchaînés, où la première panne annule tout le reste.
 */
import worker from './.open-next/worker.js';
import { tachesDuMoment } from './taches-planifiees.mjs';

export { DOQueueHandler } from './.open-next/worker.js';
export { DOShardedTagCache } from './.open-next/worker.js';
export { BucketCachePurge } from './.open-next/worker.js';

export default {
  fetch: worker.fetch,

  async scheduled(controller, env, ctx) {
    const quand = new Date(controller.scheduledTime);
    const chemins = tachesDuMoment(quand.getUTCHours(), quand.getUTCMinutes());
    if (chemins.length === 0) return;

    const base = env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com';
    const secret = env.CRON_SECRET;
    if (!secret) {
      console.error('[CRON] CRON_SECRET absent : aucune tâche ne partira.');
      return;
    }

    // `waitUntil` : Cloudflare garde le worker en vie jusqu'au bout, même si
    // la réponse de `scheduled` est déjà rendue.
    ctx.waitUntil(
      Promise.allSettled(
        chemins.map(async (chemin) => {
          const debut = Date.now();
          try {
            const reponse = await worker.fetch(
              new Request(new URL(chemin, base), {
                headers: { authorization: `Bearer ${secret}` },
              }),
              env,
              ctx
            );
            const duree = Math.round((Date.now() - debut) / 1000);
            console.log(`[CRON] ${chemin} → ${reponse.status} en ${duree} s`);
          } catch (erreur) {
            console.error(`[CRON] ${chemin} a échoué :`, erreur);
          }
        })
      )
    );
  },
};
