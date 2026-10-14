/**
 * LES HORAIRES DES TÂCHES AUTOMATIQUES.
 *
 * Ce fichier n'importe rien, et c'est voulu : le worker Cloudflare s'en sert
 * pour déclencher les tâches, et l'épreuve `tests/taches-planifiees.test.ts`
 * le compare à `vercel.json`. Les deux doivent décrire exactement le même
 * calendrier ; sans ce fichier commun, le jour où quelqu'un déplace une tâche
 * d'un côté, l'autre côté continuerait en silence.
 *
 * `heures` est en UTC, comme chez Vercel. `minute` est la minute de l'heure.
 */
export const TACHES = [
  { chemin: '/api/cron/refresh', minute: 0, heures: [0] },
  { chemin: '/api/cron/occasions', minute: 20, heures: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] },
  { chemin: '/api/cron/audit', minute: 37, heures: [5] },
  { chemin: '/api/cron/bilan-du-soir', minute: 59, heures: [23] },
  { chemin: '/api/cron/apprendre', minute: 35, heures: [1, 9, 17] },
  { chemin: '/api/cron/courriels', minute: 10, heures: [7, 11] },
  { chemin: '/api/cron/courriels', minute: 40, heures: [21] },
  { chemin: '/api/cron/cotes', minute: 15, heures: [13] },
  { chemin: '/api/cron/preparer', minute: 20, heures: [6] },
  { chemin: '/api/cron/preparer', minute: 40, heures: [15] },
];

/** Les chemins à appeler à cette heure et cette minute UTC. */
export function tachesDuMoment(heure, minute) {
  return TACHES.filter((t) => t.minute === minute && t.heures.includes(heure)).map((t) => t.chemin);
}

/**
 * Les minutes où le worker doit se réveiller : l'union des minutes utilisées.
 * `wrangler.jsonc` doit déclarer exactement celles-là, et l'épreuve le vérifie.
 */
export const MINUTES_DE_REVEIL = [...new Set(TACHES.map((t) => t.minute))].sort((a, b) => a - b);
