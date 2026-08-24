/**
 * LE DÉROULÉ : on rejoue le calendrier, on prédit avant, on apprend après.
 */
import { chargerMatchs, nouveauJuge, afficher } from './banc.mjs';
import { referenceDomicile, poissonParLigue, elo, COUPES } from './modeles.mjs';

const COUPURE = Date.parse('2025-08-01T00:00:00Z');

export function derouler(fabriques, options = {}) {
  const { coupure = COUPURE, filtre = null } = options;
  const matchs = chargerMatchs();
  const modeles = fabriques.map((f) => f());
  const juges = modeles.map((m) => nouveauJuge(m.nom));
  const jugesA = modeles.map((m) => nouveauJuge(m.nom));
  const jugesB = modeles.map((m) => nouveauJuge(m.nom));

  const apresCoupure = matchs.filter((m) => Date.parse(m.date) >= coupure);
  const milieu = apresCoupure.length ? Date.parse(apresCoupure[Math.floor(apresCoupure.length / 2)].date) : coupure;

  let entraines = 0, testes = 0;

  for (const m of matchs) {
    const t = Date.parse(m.date);
    const enTest = t >= coupure && (!filtre || filtre(m, modeles));

    if (enTest) {
      testes++;
      modeles.forEach((mod, i) => {
        const r = mod.predire(m);
        juges[i].ajouter(r.probas, r.score, m);
        (t < milieu ? jugesA : jugesB)[i].ajouter(r.probas, r.score, m);
      });
    } else if (t < coupure) entraines++;

    // Tout match nourrit l'état, testé ou non : le modèle apprend du passé,
    // y compris du match qu'il vient d'annoncer.
    modeles.forEach((mod) => mod.apprendre(m));
  }

  return {
    modeles, entraines, testes,
    bilans: juges.map((j) => j.bilan()),
    juges,
    moities: { A: jugesA.map((j) => j.bilan()), B: jugesB.map((j) => j.bilan()) },
  };
}

// Ce fichier sert de point d'entrée ET de bibliothèque. Le drapeau évite de
// relancer tout le déroulé quand un autre script vient seulement importer
// `derouler`.
if (process.env.BANC_SILENCIEUX !== '1') {
  const r = derouler([
    () => referenceDomicile(),
    () => poissonParLigue(),
    () => elo(),
  ]);

  console.log(`\n  ${r.entraines} matchs d'entrainement (avant le 1er aout 2025), ${r.testes} matchs de test.`);
  afficher(r.bilans, 'JEU DE TEST — matchs jamais vus pendant l entrainement');

  console.log('\n  ══ ÉPREUVE DES DEUX MOITIÉS DU JEU DE TEST ══\n');
  console.log('  modele                         1re moitie   2e moitie   ecart');
  console.log('  ' + '─'.repeat(64));
  r.bilans.forEach((b, i) => {
    const a = r.moities.A[i], c = r.moities.B[i];
    console.log(`  ${b.nom.padEnd(30)} ${String(a.vainqueur).padStart(8)} % ${String(c.vainqueur).padStart(10)} % ${String(Math.round((c.vainqueur - a.vainqueur) * 10) / 10).padStart(7)}`);
  });

  console.log('\n  ══ CALIBRATION ══\n');
  r.juges.forEach((j) => {
    const c = j.calibration().filter((x) => x.n >= 30);
    if (!c.length) return;
    console.log(`  ${j.nom}`);
    for (const x of c) console.log(`    ${String(x.de).padStart(3)}-${String(x.a).padStart(3)} %  ${String(x.n).padStart(5)} matchs   promis ${String(x.promis).padStart(3)} %  tenu ${String(x.tenu).padStart(3)} %   ${x.promis - x.tenu > 0 ? '+' : ''}${x.promis - x.tenu} pt`);
    console.log('');
  });
}
