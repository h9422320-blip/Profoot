/** Quelle règle de comptage reproduit EXACTEMENT le tableau de bord Chariow ? */
import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const ventes = [];
let url = 'https://api.chariow.com/v1/sales?per_page=100';
for (let p = 0; p < 60 && url; p++) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (Array.isArray(d?.data)) ventes.push(...d.data);
  let s = d?.pagination?.next_page_url ?? null;
  if (s) { const u = new URL(s); u.searchParams.set('per_page', '100'); s = u.toString(); }
  url = s;
}
console.log(`\n  ${ventes.length} vente(s) lues.`);
console.log(`  CIBLE CHARIOW : 16→22 août = 336 000 FCFA sur 103 ventes | total = 375 200 FCFA\n`);

const DU = '2026-08-16', AU = '2026-08-22';
const essai = (nom, filtre, dateDe) => {
  const lot = ventes.filter(filtre);
  const dedans = lot.filter((v) => { const j = String(dateDe(v) ?? '').slice(0, 10); return j >= DU && j <= AU; });
  const t = dedans.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
  const tout = lot.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
  const ok = t === 336000 && dedans.length === 103 ? '  <<<< CORRESPOND' : '';
  console.log(`  ${nom.padEnd(46)} ${String(dedans.length).padStart(4)} v. ${String(t).padStart(8)}  | total ${String(tout).padStart(8)}${ok}`);
};

const st = (v) => String(v.status);
essai('completed+settled, date de paiement', (v) => ['completed','settled'].includes(st(v)), (v) => v.completed_at ?? v.created_at);
essai('completed+settled, date de creation', (v) => ['completed','settled'].includes(st(v)), (v) => v.created_at);
essai('+ awaiting_payment, date de creation', (v) => ['completed','settled','awaiting_payment'].includes(st(v)), (v) => v.created_at);
essai('tout sauf abandoned+failed, creation', (v) => !['abandoned','failed'].includes(st(v)), (v) => v.created_at);
essai('tout sauf abandoned, creation', (v) => st(v) !== 'abandoned', (v) => v.created_at);
essai('tout statut, date de creation', () => true, (v) => v.created_at);

console.log(`\n  ══ TOUS LES STATUTS RENCONTRES (16→22, par date de creation) ══\n`);
const m = new Map();
for (const v of ventes) {
  const j = String(v.created_at).slice(0, 10);
  if (j < DU || j > AU) continue;
  const a = m.get(st(v)) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(v.amount?.value ?? 0);
  m.set(st(v), a);
}
for (const [s, a] of [...m].sort((x, y) => y[1].xof - x[1].xof))
  console.log(`  ${s.padEnd(22)} ${String(a.n).padStart(4)} vente(s)  ${String(a.xof).padStart(9)} FCFA`);
console.log('');
