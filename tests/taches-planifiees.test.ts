/**
 * ★ ACQUIS — LES TÂCHES AUTOMATIQUES PARTENT AUX MÊMES HEURES QU'AVANT.
 *
 * ── CE QUI S'EST PASSÉ LE 14 OCTOBRE 2026 ─────────────────────────────────
 *
 * Vercel a mis le compte en pause et réclamé 93 dollars. L'application a
 * déménagé chez Cloudflare, qui facture le temps de calcul et non le temps
 * d'attente — la bonne forme pour une application qui attend l'IA.
 *
 * Mais Cloudflare n'accorde que CINQ tâches planifiées par compte sur le plan
 * gratuit, contre treize chez Vercel. Une seule déclaration les remplace donc
 * toutes : elle se réveille aux minutes utiles, et un tableau décide quoi
 * lancer selon l'heure.
 *
 * ── CE QUE CETTE ÉPREUVE PROTÈGE ──────────────────────────────────────────
 *
 * Un calendrier dupliqué finit toujours par diverger. Le jour où quelqu'un
 * déplace une tâche d'un seul côté, rien ne casserait : la tâche cesserait
 * simplement de partir, en silence, et personne ne le verrait avant qu'un
 * client ne signale un bilan du soir manquant.
 *
 * On compare donc, une par une, chaque tâche de `vercel.json` à celle que
 * déclencherait le worker Cloudflare, sur les 1 440 minutes d'une journée.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TACHES, tachesDuMoment, MINUTES_DE_REVEIL } from '../taches-planifiees.mjs';

const racine = process.cwd();
const lire = (p: string) => fs.readFileSync(path.join(racine, p), 'utf8');

type Cron = { path: string; schedule: string };

/** Les minutes/heures d'une expression cron, pour les champs utilisés ici. */
function momentsCron(expression: string): { minute: number; heures: number[] } {
  const [min, heure] = expression.split(/\s+/);
  const minute = Number(min);
  assert.ok(Number.isInteger(minute), `Minute non gérée : « ${expression} ».`);

  // `*/2` : toutes les deux heures. `1,9,17` : liste. `5` : une seule.
  let heures: number[];
  if (heure.startsWith('*/')) {
    const pas = Number(heure.slice(2));
    heures = [];
    for (let h = 0; h < 24; h += pas) heures.push(h);
  } else if (heure === '*') {
    heures = Array.from({ length: 24 }, (_, h) => h);
  } else {
    heures = heure.split(',').map(Number);
  }
  assert.ok(heures.every(Number.isInteger), `Heure non gérée : « ${expression} ».`);
  return { minute, heures };
}

test('★ ACQUIS — chaque tâche de Vercel part à la même heure chez Cloudflare', () => {
  const crons: Cron[] = JSON.parse(lire('vercel.json')).crons;
  assert.ok(crons.length > 0, 'vercel.json ne déclare plus aucune tâche.');

  for (const { path: chemin, schedule } of crons) {
    const { minute, heures } = momentsCron(schedule);
    for (const h of heures) {
      const prevues = tachesDuMoment(h, minute);
      assert.ok(
        prevues.includes(chemin),
        `À ${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC, ` +
          `Vercel lançait ${chemin} et Cloudflare ne le lance pas (il lance : ${prevues.join(', ') || 'rien'}).`
      );
    }
  }
});

test('★ ACQUIS — Cloudflare ne lance RIEN que Vercel ne lançait', () => {
  // Le sens inverse compte autant : une tâche lancée deux fois trop souvent
  // épuise le quota du fournisseur de données et coûte des appels à l'IA.
  const crons: Cron[] = JSON.parse(lire('vercel.json')).crons;
  const attendu = new Set<string>();
  for (const { path: chemin, schedule } of crons) {
    const { minute, heures } = momentsCron(schedule);
    for (const h of heures) attendu.add(`${h}:${minute}:${chemin}`);
  }

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      for (const chemin of tachesDuMoment(h, m)) {
        assert.ok(
          attendu.has(`${h}:${m}:${chemin}`),
          `Cloudflare lance ${chemin} à ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} UTC, ` +
            `ce que Vercel ne faisait pas.`
        );
      }
    }
  }
});

test('★ ACQUIS — le réveil déclaré couvre toutes les minutes utiles', () => {
  // Une tâche prévue à une minute où le worker ne se réveille jamais ne part
  // pas : le tableau serait juste, et la tâche muette.
  const config = lire('wrangler.jsonc');
  const crons = config.match(/"crons"\s*:\s*\[([^\]]*)\]/)?.[1] ?? '';
  const minutesDeclarees = (crons.match(/"([^"]+)"/)?.[1] ?? '').split(/\s+/)[0].split(',').map(Number);

  for (const minute of MINUTES_DE_REVEIL as number[]) {
    assert.ok(
      minutesDeclarees.includes(minute),
      `Des tâches sont prévues à la minute ${minute}, mais wrangler.jsonc ne réveille pas le worker alors ` +
        `(il se réveille à : ${minutesDeclarees.join(', ')}).`
    );
  }
});

test('★ ACQUIS — Cloudflare tient dans ses cinq tâches planifiées gratuites', () => {
  const config = lire('wrangler.jsonc');
  const crons = JSON.parse(`[${config.match(/"crons"\s*:\s*\[([^\]]*)\]/)?.[1] ?? ''}]`) as string[];
  assert.ok(
    crons.length <= 5,
    `${crons.length} tâches déclarées : le plan gratuit de Cloudflare en autorise 5 par compte.`
  );
  // Et le tableau, lui, n'est pas limité : c'est tout l'intérêt du répartiteur.
  assert.ok((TACHES as unknown[]).length > crons.length, 'Le répartiteur ne sert plus à rien.');
});
