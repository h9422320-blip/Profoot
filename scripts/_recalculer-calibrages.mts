// Recalcule les facteurs de buts par championnat à partir des jugements.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { recalculerCalibrages } = await import('../src/lib/calibrage.js');
console.log(JSON.stringify(await recalculerCalibrages(), null, 1).slice(0, 1500));
