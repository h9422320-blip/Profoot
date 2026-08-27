/**
 * BANC D'ESSAI PAWAPAY — SANDBOX UNIQUEMENT.
 *
 *     node scripts/pawapay-sandbox.mjs
 *
 * Il refuse de tourner si l'adresse configurée n'est pas celle du bac à sable :
 * un banc d'essai qui déclenche de vrais paiements ne se rattrape pas.
 *
 * Ce qu'il fait :
 *   1. lit la configuration active du compte (pays, opérateurs, montants) ;
 *   2. lance une série d'encaissements avec les numéros de test officiels ;
 *   3. relit chaque statut jusqu'à ce qu'il soit définitif ;
 *   4. dit, pour chacun, si l'issue est celle attendue.
 *
 * Aucune écriture dans notre base : c'est un essai de la passerelle, pas du
 * parcours d'achat. Le parcours complet se teste depuis le site, une fois le
 * jeton en place.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}

const BASE = (process.env.PAWAPAY_BASE_URL || 'https://api.sandbox.pawapay.io').replace(/\/+$/, '');
const JETON = process.env.PAWAPAY_API_TOKEN;

if (!JETON) {
  console.log('\n  PAWAPAY_API_TOKEN absent de .env.local — rien ne peut être testé.\n');
  process.exit(1);
}
if (!BASE.includes('sandbox')) {
  console.log(`\n  REFUS : l'adresse configurée est « ${BASE} », ce n'est pas le bac à sable.\n`);
  process.exit(1);
}

const appel = async (chemin, options = {}) => {
  const r = await fetch(BASE + chemin, {
    method: options.methode ?? 'GET',
    headers: {
      Authorization: `Bearer ${JETON}`,
      Accept: 'application/json',
      ...(options.corps ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.corps ? JSON.stringify(options.corps) : undefined,
  });
  const texte = await r.text();
  let json = null;
  try { json = texte ? JSON.parse(texte) : null; } catch {}
  return { http: r.status, json, texte };
};

// ── 1. LA CONFIGURATION DU COMPTE ────────────────────────────────────────
console.log(`\n══ COMPTE SANDBOX — ${BASE} ══\n`);
const conf = await appel('/v2/active-conf');
if (conf.http !== 200) {
  console.log(`  L'appel a répondu ${conf.http} : ${conf.texte.slice(0, 200)}`);
  process.exit(1);
}
console.log(`  société : ${conf.json?.companyName ?? '—'}`);
const pays = conf.json?.countries ?? [];
console.log(`  pays ouverts : ${pays.length}\n`);
for (const p of pays.slice(0, 40)) {
  const ops = (p.providers ?? []).map((x) => x.provider).join(', ');
  console.log(`     ${String(p.country).padEnd(5)} ${ops}`);
}

// ── 2. LES ESSAIS ────────────────────────────────────────────────────────
//
// Numéros de test officiels PawaPay. La terminaison décide de l'issue :
//   …789 / …899  COMPLETED      …129  SUBMITTED (reste en cours)
//   …019  PAYER_LIMIT_REACHED   …049  INSUFFICIENT_BALANCE
const ESSAIS = [
  { nom: 'Kenya — réussite',                tel: '254703456789', op: 'MPESA_KEN', dev: 'KES', montant: '100', attendu: 'COMPLETED' },
  { nom: 'Kenya — réussite (2)',            tel: '254703456789', op: 'MPESA_KEN', dev: 'KES', montant: '250', attendu: 'COMPLETED' },
  { nom: 'Kenya — réussite (3)',            tel: '254703456789', op: 'MPESA_KEN', dev: 'KES', montant: '500', attendu: 'COMPLETED' },
  { nom: 'Kenya — réussite (4)',            tel: '254703456789', op: 'MPESA_KEN', dev: 'KES', montant: '750', attendu: 'COMPLETED' },
  { nom: 'Kenya — réussite (5)',            tel: '254703456789', op: 'MPESA_KEN', dev: 'KES', montant: '1000', attendu: 'COMPLETED' },
  { nom: 'Kenya — solde insuffisant',       tel: '254703456049', op: 'MPESA_KEN', dev: 'KES', montant: '100', attendu: 'FAILED' },
  { nom: 'Kenya — plafond atteint',         tel: '254703456019', op: 'MPESA_KEN', dev: 'KES', montant: '100', attendu: 'FAILED' },
  { nom: 'Kenya — reste en cours',          tel: '254703456129', op: 'MPESA_KEN', dev: 'KES', montant: '100', attendu: 'PENDING' },
];

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const resultats = [];

console.log(`\n══ ${ESSAIS.length} ENCAISSEMENTS DE TEST ══\n`);

for (const e of ESSAIS) {
  const depositId = crypto.randomUUID();
  const reference = `ESSAI-${depositId.slice(0, 8)}`;

  const init = await appel('/v2/deposits', {
    methode: 'POST',
    corps: {
      depositId,
      amount: e.montant,
      currency: e.dev,
      payer: { type: 'MMO', accountDetails: { phoneNumber: e.tel, provider: e.op } },
      clientReferenceId: reference,
      customerMessage: 'ProFoot AI',
    },
  });

  const accepte = init.json?.status;
  if (accepte !== 'ACCEPTED' && accepte !== 'DUPLICATE_IGNORED') {
    console.log(`  ✖  ${e.nom.padEnd(28)} refusé à l'initiation : ${accepte ?? init.http} ${init.json?.failureReason?.failureCode ?? ''}`);
    resultats.push({ ...e, obtenu: 'REJET_INITIATION', ok: false, depositId });
    continue;
  }

  // On relit jusqu'au statut définitif, sans dépasser vingt secondes.
  let statut = null, code = null;
  for (let i = 0; i < 10; i++) {
    await attendre(2000);
    const s = await appel(`/v2/deposits/${depositId}`);
    if (s.json?.status === 'FOUND') {
      statut = s.json.data?.status;
      code = s.json.data?.failureReason?.failureCode;
      if (statut === 'COMPLETED' || statut === 'FAILED') break;
    }
  }

  const ok = e.attendu === 'PENDING'
    ? statut !== 'COMPLETED' && statut !== 'FAILED'
    : statut === e.attendu;

  console.log(
    `  ${ok ? '✔' : '✖'}  ${e.nom.padEnd(28)} ${String(statut ?? '—').padEnd(10)} ` +
    `${code ? '(' + code + ')' : ''}  ${depositId}`
  );
  resultats.push({ ...e, obtenu: statut, code, ok, depositId });
}

const reussis = resultats.filter((r) => r.ok).length;
console.log(`\n  ${reussis}/${resultats.length} essais conformes à ce qui était attendu.`);
const completes = resultats.filter((r) => r.obtenu === 'COMPLETED').length;
console.log(`  dont ${completes} encaissements aboutis (COMPLETED).\n`);

fs.writeFileSync('.essais-pawapay.json', JSON.stringify(resultats, null, 1), 'utf8');
console.log('  détail écrit dans .essais-pawapay.json\n');
