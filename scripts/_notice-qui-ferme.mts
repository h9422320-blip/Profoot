/**
 * QUI FERME LA NOTICE DE PAIEMENT, ET POURQUOI ON LES PERD.
 *
 * La notice est le dernier écran avant la boutique. Trois sorties : continuer,
 * laisser filer les vingt secondes, ou fermer. Fermer est un refus explicite —
 * et un tiers des gens le font.
 *
 * Ce script cherche d'abord si ce tiers est STABLE (donc structurel) ou
 * accidentel, puis s'il se concentre quelque part : un pays, un appareil, une
 * offre. Lecture seule.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const DEPUIS = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);

const lignes: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb
    .from('visites_pages')
    .select('chemin, entre_le, pays, mobile, compte_id')
    .gte('entre_le', `${DEPUIS}T00:00:00Z`)
    .like('chemin', '/~%')
    .range(de, de + 999);
  if (error) throw new Error(error.message);
  if (!data?.length) break;
  lignes.push(...data);
  if (data.length < 1000) break;
}
console.log(`${lignes.length} étape(s) relevée(s) depuis le ${DEPUIS}.\n`);

const etapeDe = (c: string) => String(c).split('/')[1] ?? '?';
const offreDe = (c: string) => String(c).split('/')[2] ?? '—';
const jourDe = (x: any) => String(x).slice(0, 10);

// ── 1. LE TIERS QUI FERME EST-IL STABLE ? ──────────────────────────────────
const jours = [...new Set(lignes.map((l) => jourDe(l.entre_le)))].sort();
console.log('── LA NOTICE, JOUR PAR JOUR');
console.log('   jour         ouvertures  continuer   auto   fermée   part fermée   → caisse   perdus');
for (const j of jours) {
  const duJour = lignes.filter((l) => jourDe(l.entre_le) === j);
  const n = (e: string) => duJour.filter((l) => etapeDe(l.chemin) === `~${e}`).length;
  const cont = n('notice-continuer');
  const auto = n('notice-auto');
  const ferm = n('notice-fermee');
  const caisse = n('depart-caisse');
  const vues = cont + auto + ferm;
  const partis = cont + auto;
  const perdus = partis - caisse;
  console.log(
    `   ${j}   ${String(vues).padStart(8)}   ${String(cont).padStart(8)}  ${String(auto).padStart(5)}  ` +
      `${String(ferm).padStart(6)}   ${vues ? ((ferm / vues) * 100).toFixed(0).padStart(9) + ' %' : '        —'}   ` +
      `${String(caisse).padStart(7)}   ${String(perdus).padStart(6)}`
  );
}

const total = (e: string) => lignes.filter((l) => etapeDe(l.chemin) === `~${e}`).length;
const C = total('notice-continuer'), A = total('notice-auto'), F = total('notice-fermee');
const K = total('depart-caisse'), EL = total('echec-lien'), IR = total('inscription-requise');
console.log(
  `\n   TOTAL huit jours : ${C + A + F} notices vues — ${C} continuer, ${A} auto, ${F} fermées ` +
    `(${(((F) / (C + A + F)) * 100).toFixed(1)} %)`
);
console.log(`   ${C + A} partis vers la caisse → ${K} arrivés. ${C + A - K} perdus en chemin.`);
console.log(`   échecs de lien signalés : ${EL}   ·   inscriptions exigées : ${IR}`);

// ── 2. QUI FERME ? ─────────────────────────────────────────────────────────
const classer = (etape: string, champ: 'pays' | 'mobile') => {
  const m = new Map<string, number>();
  for (const l of lignes.filter((x) => etapeDe(x.chemin) === `~${etape}`)) {
    const k = String(l[champ] ?? '—');
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

console.log('\n── PAR PAYS : part de ceux qui ferment (≥ 10 notices vues)');
const paysF = classer('notice-fermee', 'pays');
const paysC = classer('notice-continuer', 'pays');
const paysA = classer('notice-auto', 'pays');
const tousPays = new Set([...paysF.keys(), ...paysC.keys(), ...paysA.keys()]);
const rangs: { p: string; vues: number; part: number }[] = [];
for (const p of tousPays) {
  const f = paysF.get(p) ?? 0;
  const vues = f + (paysC.get(p) ?? 0) + (paysA.get(p) ?? 0);
  if (vues >= 10) rangs.push({ p, vues, part: (f / vues) * 100 });
}
for (const r of rangs.sort((a, b) => b.part - a.part))
  console.log(`   ${r.p.padEnd(4)} ${String(r.vues).padStart(4)} notices   ${r.part.toFixed(0).padStart(3)} % ferment`);

console.log('\n── PAR APPAREIL');
for (const champ of [true, false]) {
  const f = classer('notice-fermee', 'mobile').get(String(champ)) ?? 0;
  const c = classer('notice-continuer', 'mobile').get(String(champ)) ?? 0;
  const a = classer('notice-auto', 'mobile').get(String(champ)) ?? 0;
  const v = f + c + a;
  console.log(`   ${champ ? 'téléphone' : 'ordinateur'} : ${v} notices, ${v ? ((f / v) * 100).toFixed(0) : 0} % ferment`);
}

console.log('\n── PAR OFFRE');
const parOffre = new Map<string, { f: number; c: number; a: number }>();
for (const l of lignes) {
  const e = etapeDe(l.chemin);
  if (!['~notice-fermee', '~notice-continuer', '~notice-auto'].includes(e)) continue;
  const o = offreDe(l.chemin);
  const v = parOffre.get(o) ?? { f: 0, c: 0, a: 0 };
  if (e === '~notice-fermee') v.f++;
  else if (e === '~notice-continuer') v.c++;
  else v.a++;
  parOffre.set(o, v);
}
for (const [o, v] of [...parOffre].sort((a, b) => b[1].f + b[1].c + b[1].a - (a[1].f + a[1].c + a[1].a))) {
  const t = v.f + v.c + v.a;
  console.log(`   ${o.padEnd(20)} ${String(t).padStart(4)} notices   ${((v.f / t) * 100).toFixed(0).padStart(3)} % ferment`);
}

// ── 3. COMBIEN DE TEMPS RESTENT-ILS AVANT DE FERMER ? ──────────────────────
const duree = (e: string) => {
  const l = lignes.filter((x) => etapeDe(x.chemin) === `~${e}`);
  return l.length;
};
console.log(`\n(la durée passée sur la notice n'est pas mesurée : ${duree('notice-fermee')} fermetures relevées)`);
