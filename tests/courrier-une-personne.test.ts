/**
 * ★ ACQUIS — ÉCRIRE À UNE PERSONNE NE PEUT PAS DEVENIR ÉCRIRE À TOUT LE MONDE.
 *
 * ── POURQUOI CETTE PORTE EXISTE ───────────────────────────────────────────
 *
 * Tous les messages que l'application savait envoyer étaient écrits d'avance.
 * Le cas particulier — celui qui a payé deux fois, celui dont l'opérateur ne
 * passe pas — n'avait aucun chemin : la clé du service de courriel ne vit que
 * sur l'hébergeur, et un script local ne l'a pas.
 *
 * ── CE QUE CES ASSERTIONS EMPÊCHENT ───────────────────────────────────────
 *
 * Une porte qui envoie du courrier depuis notre domaine est exactement le
 * genre d'outil qui s'élargit tout seul : trois destinataires deviennent
 * trente, la simulation par défaut saute « pour aller plus vite », et un jour
 * un GET dans un navigateur laisse la clé dans l'historique et dans l'en-tête
 * de provenance de la page suivante.
 *
 * Les trois gardes sont donc figées ici.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SOURCE = 'src/app/api/courrier/route.ts';
const source = () => fs.readFileSync(SOURCE, 'utf8');
const codeSeul = (s: string) =>
  s
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');

test('★ ACQUIS — la porte du courrier exige la clé, en POST seulement', () => {
  const s = codeSeul(source());
  assert.match(s, /export async function POST\(/, 'La porte n’accepte plus le POST.');
  assert.doesNotMatch(s, /export async function GET\(/, 'Un GET laisserait la clé dans les journaux et l’historique.');
  assert.match(s, /process\.env\.ADMIN_ACCESS_KEY/, 'La clé d’administration ne garde plus la porte.');
  assert.match(s, /ecart \|= fournie\.charCodeAt\(i\) \^ attendue\.charCodeAt\(i\)/, 'La comparaison n’est plus à durée constante.');
  assert.match(s, /status: 401/, 'Un appel sans clé ne reçoit plus de refus.');
});

test('★ ACQUIS — rien ne part sans le demander explicitement', () => {
  const s = codeSeul(source());
  // `simulation !== false` : tout ce qui n'est pas un refus explicite de
  // simuler est une simulation. Un corps vide, un champ oublié, une faute de
  // frappe sur le nom du champ — dans les trois cas, rien ne part.
  assert.match(s, /corps\.simulation !== false/, 'La simulation n’est plus le défaut : un appel distrait enverrait pour de bon.');
  const avantEnvoi = s.slice(0, s.indexOf('envoyerCourriel'));
  assert.match(avantEnvoi, /corps\.simulation !== false/, 'Le garde de simulation est passé APRÈS l’envoi : il ne garde plus rien.');
});

test('★ ACQUIS — trois destinataires au plus, et des adresses valables', () => {
  const s = codeSeul(source());
  assert.match(s, /const MAX_DESTINATAIRES = 3;/, 'Le plafond de destinataires a bougé : ce n’est plus une réponse, c’est une campagne.');
  assert.match(s, /destinataires\.length > MAX_DESTINATAIRES/, 'Le plafond n’est plus appliqué.');
  assert.match(s, /adresseValable/, 'Les adresses ne sont plus vérifiées.');
});

test('★ ACQUIS — la raison d’un refus est lue APRÈS l’envoi', () => {
  // `dernierRefus` est une variable qui change pendant l'envoi. La
  // déstructurer au moment de l'import en figerait la valeur d'avant, et la
  // réponse dirait « aucun refus » à chaque échec — exactement l'aveuglement
  // que cette variable avait été ajoutée pour lever.
  const s = codeSeul(source());
  assert.match(s, /courriel\.dernierRefus/, 'Le refus est relu sur une valeur figée à l’import.');
  assert.doesNotMatch(s, /\{[^}]*dernierRefus[^}]*\} = await import/, 'La raison du refus est de nouveau déstructurée à l’import.');
});
