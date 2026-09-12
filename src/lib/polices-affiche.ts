import fs from 'node:fs';

/**
 * LES POLICES DE L'AFFICHE.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Le moteur d'image (Satori) n'embarque qu'une seule police, Geist Regular.
 * Sans autre police fournie, TOUT sort en graisse normale : ni titre, ni
 * chiffre, ni marque ne peuvent ressortir. C'est la raison principale pour
 * laquelle les deux premières affiches ressemblaient à un tableau de bord et
 * non à une affiche — le propriétaire les a refusées, et il avait raison.
 *
 * ── CE QU'ON CHARGE, ET POURQUOI CELLES-LÀ ───────────────────────────────
 *
 * Exactement les polices de l'application (`src/app/polices.ts`) : Outfit pour
 * la marque, les titres et les chiffres ; Inter pour le texte courant. Une
 * affiche doit ressembler au produit qu'elle annonce.
 *
 * Les fichiers sont rangés dans le dépôt, en TTF — le moteur ne lit pas le
 * woff2 dans lequel Next sert les polices du site. Ils sont lus une fois par
 * processus : une affiche ne paie pas la lecture disque à chaque demande.
 */

export interface PoliceChargee {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700 | 900;
  style: 'normal';
}

const FICHIERS: { fichier: string; name: string; weight: PoliceChargee['weight'] }[] = [
  { fichier: 'outfit-900.ttf', name: 'Outfit', weight: 900 },
  { fichier: 'outfit-700.ttf', name: 'Outfit', weight: 700 },
  { fichier: 'inter-600.ttf', name: 'Inter', weight: 600 },
  { fichier: 'inter-400.ttf', name: 'Inter', weight: 400 },
];

let cache: PoliceChargee[] | null = null;

/**
 * Les polices prêtes pour `ImageResponse`.
 *
 * Une police manquante n'empêche pas l'affiche : le moteur retombe sur sa
 * police par défaut. Mieux vaut une affiche moins belle qu'une erreur.
 */
export function polices(): PoliceChargee[] {
  if (cache) return cache;
  const chargees: PoliceChargee[] = [];
  for (const { fichier, name, weight } of FICHIERS) {
    try {
      const chemin = new URL(`../polices/${fichier}`, import.meta.url);
      chargees.push({ name, data: fs.readFileSync(chemin), weight, style: 'normal' });
    } catch (e: any) {
      console.warn(`[AFFICHE] police ${fichier} illisible : ${e?.message}`);
    }
  }
  cache = chargees;
  return chargees;
}
