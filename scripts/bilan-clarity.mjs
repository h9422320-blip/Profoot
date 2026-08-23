/**
 * LE BILAN CLARITY, À LA DEMANDE.
 *
 *   node scripts/bilan-clarity.mjs            un bilan neuf (consomme 1 à 4 requêtes)
 *   node scripts/bilan-clarity.mjs --relire   le dernier bilan, sans rien consommer
 *   node scripts/bilan-clarity.mjs --jours 1  ne regarder que la veille
 *
 * ── LE PLAFOND EST LA CONTRAINTE PRINCIPALE ───────────────────────────────
 *
 * Microsoft autorise DIX appels par jour et par projet, tous usages confondus
 * — la page d'administration en fait déjà. Chaque bilan neuf en consomme au
 * plus quatre : trois pour l'audience, un pour le comportement.
 *
 * Le résultat est écrit dans `bilan-clarity.json`. `--relire` le ressort tel
 * quel : on peut le relire dix fois par jour sans toucher au quota.
 *
 * ── CE QUE CE BILAN NE PEUT PAS DIRE ──────────────────────────────────────
 *
 * L'API rend des TOTAUX, pas les vidéos de session. Elle dit que douze
 * personnes ont cliqué rageusement sur une page ; elle ne dit pas sur quoi.
 * Le bilan désigne donc où regarder, et l'interface de Clarity montre quoi.
 */

import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';

const FICHIER = 'bilan-clarity.json';
const args = process.argv.slice(2);
const relire = args.includes('--relire');
const jours = Number(args[args.indexOf('--jours') + 1]) || 3;

// ── Affichage ──────────────────────────────────────────────────────────────
const T = (s) => console.log(s);
const titre = (s) => { T(''); T(`  ${'═'.repeat(2)} ${s.toUpperCase()} ${'═'.repeat(Math.max(0, 66 - s.length))}`); T(''); };

function afficher(b) {
  const quand = new Date(b.releveLe).toLocaleString('fr-FR', { timeZone: 'Africa/Conakry' });

  titre('bilan clarity');
  T(`  Période : ${b.periode}`);
  T(`  Relevé le ${quand} (heure de Conakry)${b.enReserve ? ' — depuis la réserve, aucune requête consommée' : ''}`);

  if (b.resume.length) {
    titre("ce qu'il faut retenir");
    for (const l of b.resume) T(`  • ${l}`);
  }

  if (b.problemes.length) {
    titre('les problèmes qui coûtent des ventes');
    for (const p of b.problemes) {
      T(`  ${p.rang}. ${p.titre.toUpperCase()}`);
      T(`     Constat        : ${p.constat}`);
      T(`     Conséquence    : ${p.consequence}`);
      T(`     Que faire      : ${p.recommandation}`);
      T('');
    }
  } else if (b.sessions > 0) {
    titre('les problèmes qui coûtent des ventes');
    T('  Aucun signal au-dessus des seuils retenus sur cette période.');
  }

  if (b.pagesLesPlusVues.length) {
    titre('les pages les plus vues');
    T(`  sessions   rage   morts   demi-tours   lecture   page`);
    T(`  ${'-'.repeat(74)}`);
    for (const p of b.pagesLesPlusVues)
      T(
        `  ${String(p.sessions).padStart(8)}  ${String(p.clicsDeRage).padStart(5)}  ` +
        `${String(p.clicsMorts).padStart(6)}  ${String(p.retoursRapides).padStart(11)}  ` +
        `${String(p.profondeurScroll != null ? p.profondeurScroll + ' %' : '—').padStart(8)}   ${p.url}`
      );
  }

  if (b.pagesQuiDecrochent.length) {
    titre('où les gens décrochent le plus');
    for (const p of b.pagesQuiDecrochent) {
      const taux = p.sessions ? Math.round((p.retoursRapides / p.sessions) * 1000) / 10 : 0;
      T(`  ${String(taux + ' %').padStart(7)} de demi-tours immédiats   ${p.url}   (${p.sessions} sessions)`);
    }
  }

  if (b.pays.length) {
    titre('pays');
    for (const p of b.pays) T(`  ${String(p.sessions).padStart(6)}   ${p.valeur}`);
  }

  if (b.appareils.length) {
    titre('appareils');
    for (const a of b.appareils) T(`  ${String(a.sessions).padStart(6)}   ${a.valeur}`);
  }

  if (b.manques.length) {
    titre("ce que clarity n'a pas fourni");
    for (const m of b.manques) T(`  • ${m}`);
    T('');
    T("  Ces trous ne sont pas comblés : un bilan qui devine ne sert à rien.");
  }
  T('');
}

// ── Relecture : aucun appel réseau ─────────────────────────────────────────
if (relire) {
  if (!fs.existsSync(FICHIER)) {
    T(`\n  Aucun bilan enregistré. Lancez d'abord : node scripts/bilan-clarity.mjs\n`);
    process.exit(0);
  }
  afficher(JSON.parse(fs.readFileSync(FICHIER, 'utf8')));
  T(`  (relecture du dernier bilan — aucune requête consommée)\n`);
  process.exit(0);
}

// ── Bilan neuf ─────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

if (!process.env.CLARITY_API_TOKEN) {
  T(`\n  CLARITY_API_TOKEN est absent de .env.local.`);
  T(`\n  Pour l'obtenir : Clarity → Settings → Data Export → Generate new API token.`);
  T(`  Puis ajoutez dans .env.local, sur une seule ligne :`);
  T(`\n      CLARITY_API_TOKEN=votre_jeton_ici\n`);
  process.exit(1);
}

const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { lireApercuClarity, lireComportementClarity } = await jiti.import('../src/lib/clarity-api.ts');
const { composerBilan } = await jiti.import('../src/lib/bilan-clarity.ts');

const n = Math.min(3, Math.max(1, jours));
T(`\n  Interrogation de Clarity sur ${n} jour(s)…`);

const [apercu, comportement] = await Promise.all([
  lireApercuClarity(n),
  lireComportementClarity(n),
]);

const bilan = composerBilan(apercu, comportement);
fs.writeFileSync(FICHIER, JSON.stringify(bilan, null, 1), 'utf8');
afficher(bilan);
T(`  Bilan enregistré dans ${FICHIER} — relisez-le avec --relire, sans consommer de requête.\n`);
