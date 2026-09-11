/**
 * CE QUE PARTAGENT LES MORCEAUX DU CHALLENGER DE NUIT.
 *
 * Tout vit sous `.challenger/`, à la racine du dépôt, sur l'ordinateur du
 * propriétaire — dossier exclu de GitHub par `.gitignore`.
 */
import fs from 'node:fs';
import path from 'node:path';

export const RACINE = process.cwd();
export const DOSSIER = path.join(RACINE, '.challenger');
export const DOSSIER_TRAVAIL = path.join(DOSSIER, 'travail');
export const DOSSIER_RAPPORTS = path.join(DOSSIER, 'rapports');
export const FICHIER_RENCONTRES = path.join(DOSSIER, 'rencontres.json');
export const FICHIER_TIRS = path.join(DOSSIER, 'tirs.json');
/** Les probabilités tirées des cotes, par rencontre — pour la couche du marché. */
export const FICHIER_COTES = path.join(DOSSIER, 'cotes.json');
export const FICHIER_HISTORIQUE = path.join(DOSSIER, 'historique.jsonl');
export const FICHIER_PROPOSITION = path.join(DOSSIER, 'proposition.json');

/** Priorité du propriétaire : les grands championnats d'Europe d'abord… */
export const GRANDS: Record<number, string> = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  61: 'Ligue 1',
  94: 'Primeira Liga',
  88: 'Eredivisie',
};
/** …puis la Ligue des champions, puis l'Europa League. */
export const COUPES_SUIVIES: Record<number, string> = { 2: 'Ligue des champions', 3: 'Europa League' };
/** Les coupes, qui ne sont le championnat de personne. */
export const COUPES = new Set([2, 3, 848, 531]);

/**
 * Charge `.env.local` SANS écraser ce que le processus a déjà reçu : les
 * réglages `BANC_*` d'une variante viennent du processus parent, et ne
 * doivent pas être recouverts.
 */
export function chargerEnv(): void {
  const fichier = path.join(RACINE, '.env.local');
  if (!fs.existsSync(fichier)) return;
  for (const l of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const i = l.indexOf('=');
    if (i <= 0 || l.startsWith('#')) continue;
    const cle = l.slice(0, i).trim();
    if (process.env[cle] !== undefined) continue;
    process.env[cle] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

export function assurerDossiers(): void {
  for (const d of [DOSSIER, DOSSIER_TRAVAIL, DOSSIER_RAPPORTS]) fs.mkdirSync(d, { recursive: true });
}

export function journal(...morceaux: unknown[]): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${morceaux.map(String).join(' ')}`);
}
