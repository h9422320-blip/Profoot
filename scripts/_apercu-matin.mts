// SIMULATION : ce que recevraient les premiers destinataires du message du matin. Rien ne part.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireTerrain, publicDuMatin } = await import('../src/lib/campagnes/publics.js');
const { programmeDuMatin, fabriqueMessageDuMatin } = await import('../src/lib/campagnes/index.js');
const terrain = await lireTerrain(31);
const liste = publicDuMatin(terrain);
const programme = await programmeDuMatin();
const fabrique = fabriqueMessageDuMatin(programme);
const avecVerdict = liste.filter((d: any) => d.contexte?.verdict?.length).length;
const abonnes = liste.filter((d: any) => d.contexte?.abonne).length;
const aRisque = liste.filter((d: any) => d.contexte?.abonne && !d.contexte?.verdict?.length && d.contexte?.joursActifs < 7).length;
console.log(`public : ${liste.length} · abonnés ${abonnes} · avec un verdict d'hier ${avecVerdict} · abonnés sous 7 jours ${aRisque}`);
console.log(`programme : ${programme.surs.length} sûrs · ${programme.matchs.length} affiches · prochain : ${programme.prochains?.jour ?? '—'} (${programme.prochains?.matchs.length ?? 0})`);
const premiers = liste.slice(0, 50);
console.log(`les 50 premiers : ${premiers.filter((d: any) => d.contexte?.verdict?.length).length} avec verdict · jours actifs ${premiers.map((d: any) => d.contexte?.joursActifs).join(',')}`);
const exemples = [liste.find((d: any) => d.contexte?.verdict?.length > 1), liste.find((d: any) => !d.contexte?.verdict?.length)].filter(Boolean);
for (const d of exemples) {
  const m = fabrique(d as any);
  console.log('\n══════════ SUJET : ' + m?.sujet + '\n' + m?.texte.replace(/[^\s@]+@[^\s@]+/g, '[adresse]'));
}
