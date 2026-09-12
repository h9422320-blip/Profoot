/**
 * PRODUIRE UNE AFFICHE DU JOUR POUR CONTRÔLE. Lecture seule, sauf le fichier PNG.
 *
 * Ce script emploie EXACTEMENT le dessin et les données de la route
 * `/api/affiche` : même composant, même lecture en base, même contrôle de
 * conformité. Il sert à regarder l'affiche et à vérifier qu'aucun résultat,
 * gain ou pronostic n'y figure, sans avoir à ouvrir une session.
 *
 *   npx tsx scripts/_apercu-affiche.mts [courriel] [jour AAAA-MM-JJ]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chargerEnv } from './challenger/commun.mjs';

chargerEnv();
const { ImageResponse } = await import('next/og');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { donneesAffiche, verifierConformite, afficheAutorisee, AFFICHE_PUBLIQUE, ESSAI_PRIVE } = await import(
  '../src/lib/affiche-du-jour.js'
);
const { default: AfficheVisuel, textesDeLAffiche } = await import('../src/components/affiche/AfficheVisuel.js');

const courriel = (process.argv[2] ?? ESSAI_PRIVE[0]).toLowerCase();
const jour = process.argv[3] ?? new Date().toISOString().slice(0, 10);
const sb = createAdminClient();

// Retrouver le compte par son adresse. La base compte plus de dix mille
// comptes : vingt pages ne suffisaient pas, et le script concluait à tort que
// l'adresse n'existait pas.
let utilisateur: any = null;
for (let page = 1; page <= 80 && !utilisateur; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(`lecture des comptes : ${error.message}`);
  const comptes = data?.users ?? [];
  utilisateur = comptes.find((u: any) => String(u.email ?? '').toLowerCase() === courriel) ?? null;
  if (comptes.length < 200) break;
}
if (!utilisateur) throw new Error(`aucun compte pour ${courriel}`);

console.log(`compte : ${utilisateur.email}`);
console.log(`interrupteur AFFICHE_PUBLIQUE : ${AFFICHE_PUBLIQUE}`);
console.log(`accès accordé : ${afficheAutorisee(utilisateur.email, false) ? 'OUI' : 'NON'}`);
console.log(`accès pour un autre abonné payant : ${afficheAutorisee('quelquun@exemple.com', true) ? 'OUI' : 'NON'}`);

const d = await donneesAffiche(sb as any, utilisateur, jour);
console.log(
  `\ndonnées du ${d.jour} : ${d.analysesDuJour} analyse(s) du jour, ${d.analysesDuMois} ce mois-ci, ` +
    `série ${d.serie}, club de cœur ${d.equipePreferee?.nom ?? '—'}, ${d.matchs.length} match(s) à afficher`
);

const nomsDeClubs = [
  ...d.matchs.flatMap((m: any) => [m.domicile, m.exterieur]),
  ...(d.equipePreferee ? [d.equipePreferee.nom] : []),
];
const textes = textesDeLAffiche(d);
console.log('\ntextes qui paraîtront sur l’affiche :');
for (const t of textes) console.log(`  « ${t} »`);
console.log('\nnoms de clubs affichés :', nomsDeClubs.length ? nomsDeClubs.join(', ') : '—');

verifierConformite([...textes, ...nomsDeClubs], nomsDeClubs);
console.log('\ncontrôle de conformité : AUCUN mot interdit.');

// Le logo, embarqué : pas de serveur à interroger pour un contrôle hors ligne.
const fichierLogo = path.join(process.cwd(), 'public', 'logo-affiche.png');
const logo = fs.existsSync(fichierLogo)
  ? `data:image/png;base64,${fs.readFileSync(fichierLogo).toString('base64')}`
  : null;

const dossier = path.join(process.cwd(), '.challenger', 'apercus');
fs.mkdirSync(dossier, { recursive: true });

for (const [nom, largeur, hauteur] of [
  ['story-1080x1920', 1080, 1920],
  ['carre-1080x1080', 1080, 1080],
] as [string, number, number][]) {
  const image = new ImageResponse(AfficheVisuel({ d, logo, largeur, hauteur }) as any, { width: largeur, height: hauteur });
  const octets = Buffer.from(await image.arrayBuffer());
  const sortie = path.join(dossier, `affiche-${jour}-${nom}.png`);
  fs.writeFileSync(sortie, octets);
  console.log(`écrit : ${sortie} (${Math.round(octets.length / 1024)} ko)`);
}
