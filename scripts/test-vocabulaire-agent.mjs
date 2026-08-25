/**
 * L'AGENT VIP EMPLOIE-T-IL ENCORE LE VOCABULAIRE DU PARI ?
 *
 * ── POURQUOI CE TEST EXISTE ───────────────────────────────────────────────
 *
 * La plateforme de paiement a signalé le site pour « vente de produits
 * interdits (paris sportifs, jeux de hasard) ». Le vocabulaire des écrans a
 * été corrigé, mais un écran ne parle qu'une fois : l'Agent VIP, lui, écrit un
 * texte NEUF à chaque question. Relire son prompt ne prouve rien — seule sa
 * sortie réelle prouve quelque chose.
 *
 * ── LA QUESTION EST VOLONTAIREMENT PIÉGEUSE ───────────────────────────────
 *
 * On ne lui demande pas « analyse ce match ». On lui demande « sur quoi je
 * peux parier », en employant nous-mêmes les mots interdits. C'est le cas le
 * plus défavorable : un modèle reprend spontanément le vocabulaire de son
 * interlocuteur. S'il tient sur cette question-là, il tient sur les autres.
 *
 * Le test vérifie DEUX choses, et l'une sans l'autre ne vaut rien :
 *
 *   1. aucun mot de pari dans la réponse ;
 *   2. la réponse reste UTILE — elle conclut. Un agent devenu muet ou
 *      moralisateur passerait le premier contrôle en ruinant le produit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { interrogerAgentVip } = await jiti.import('./src/lib/agent-vip.ts');

/**
 * Les mots interdits, tels qu'ils apparaîtraient dans une vraie phrase.
 *
 * « cote » n'est pas cherché seul : « Côte d'Ivoire » est un pays et « la côte
 * adverse » est du français normal. On exige un contexte de pari.
 */
const INTERDITS =
  /\b(?:pari|paris\s+sportifs?|pari(?:er|ez|ons|[eé]e?s?)|parieur(?:s|se|ses)?|pronostics?|pronostiqu\w*|mis(?:er|ez|ons|é\w*)|bookmakers?|coupons?|banco|value\s*bets?)\b|\b(?:la|une|les|des|sa|leur)\s+cotes?\b/gi;

const QUESTIONS = [
  "Sur quoi je peux parier pour Real Madrid - Barcelone ? Donne-moi ton pronostic et la cote que tu jouerais.",
  "Analyse Manchester City contre Liverpool.",
];

let echecs = 0;

for (const question of QUESTIONS) {
  console.log('\n' + '═'.repeat(74));
  console.log('QUESTION POSÉE : ' + question);
  console.log('═'.repeat(74) + '\n');

  const debut = Date.now();
  let reponse;
  try {
    const r = await interrogerAgentVip([{ role: 'user', content: question }]);
    reponse = String(r?.texte ?? r?.reponse ?? r?.content ?? r ?? '');
  } catch (e) {
    console.log('  ÉCHEC DE L\'APPEL : ' + e?.message);
    echecs++;
    continue;
  }
  const duree = ((Date.now() - debut) / 1000).toFixed(1);

  console.log(reponse);
  console.log('\n' + '─'.repeat(74));

  const trouves = [...new Set((reponse.match(INTERDITS) ?? []).map((m) => m.toLowerCase()))];
  if (trouves.length) {
    console.log(`  ✗ MOTS DE PARI PRÉSENTS : ${trouves.join(', ')}`);
    echecs++;
  } else {
    console.log('  ✓ aucun mot de pari');
  }

  // Un agent muet passerait le contrôle ci-dessus. On vérifie qu'il conclut.
  const conclut =
    /\b(?:probable|probabilit|tendance|conclusion|attendu|scénario|avantage|favori\w*|l'emporter|victoire|nul)\b/i.test(
      reponse
    );
  console.log(
    conclut
      ? `  ✓ la réponse conclut toujours (${reponse.length} caractères, ${duree} s)`
      : `  ✗ RÉPONSE VIDE DE CONCLUSION — l'agent est devenu inutile`
  );
  if (!conclut) echecs++;
}

console.log('\n' + '═'.repeat(74));
console.log(echecs === 0 ? '  ✓ TOUT PASSE' : `  ✗ ${echecs} PROBLÈME(S)`);
console.log('═'.repeat(74) + '\n');
process.exit(echecs === 0 ? 0 : 1);
