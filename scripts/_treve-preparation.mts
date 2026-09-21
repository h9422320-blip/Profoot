import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { precalculerGrandsMatchs } = await import('../src/lib/precalcul-selection.js');
for (let passe = 1; passe <= 6; passe++) {
  const b = await precalculerGrandsMatchs(240_000, { maxParPassage: 80 });
  const reste = (b.details ?? []).find((d: string) => d.includes('plafond')) ?? 'rien en attente';
  console.log(`passe ${passe} · examinées ${b.examinees} · calculées ${b.calculees} · déjà connues ${b.dejaConnues} · échecs ${b.echecs} · ${reste}`);
  if (b.calculees === 0 && reste === 'rien en attente') break;
}
