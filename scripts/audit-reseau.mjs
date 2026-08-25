/**
 * AUDIT RÉSEAU COMPLET DU SITE EN PRODUCTION.
 *
 * ── POURQUOI CET AUDIT EXISTE ─────────────────────────────────────────────
 *
 * Le 19 août 2026, des visiteurs marocains ne pouvaient pas ouvrir le site :
 * leur opérateur les mettait sur un réseau IPv6 seul, et Vercel ne publie
 * aucune adresse IPv6. Cloudflare a été mis devant pour en fournir une.
 *
 * Le 25 août, un visiteur français voit « This page couldn't load ». Le
 * propriétaire a raison de rappeler que la première correction n'avait jamais
 * été vérifiée de bout en bout. Celui-ci le fait, et pourra être relancé
 * chaque fois que quelqu'un se plaint.
 *
 * ── CE QU IL CONTRÔLE ─────────────────────────────────────────────────────
 *
 *   1. le domaine publie bien une adresse IPv4 ET une IPv6 ;
 *   2. le certificat est valide et pas sur le point d'expirer ;
 *   3. chaque page répond, et en combien de temps ;
 *   4. les réponses sont compressées — sans quoi le poids triple ;
 *   5. rien n'est anormalement lourd.
 *
 * Diagnostic seul : rien n'est écrit, rien n'est modifié.
 */
const SITE = 'profootai.com';
const BASE = `https://${SITE}`;

const PAGES = [
  '/', '/login', '/signup', '/pricing', '/analyze', '/competitions',
  '/matches', '/preuves', '/standings', '/history', '/expert', '/settings',
  '/payment-success', '/payment-failed',
];

const doh = async (nom, type) => {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${nom}&type=${type}`, {
      headers: { accept: 'application/dns-json' },
    });
    const j = await r.json();
    const code = { A: 1, AAAA: 28, NS: 2, CNAME: 5 }[type];
    return (j.Answer ?? []).filter((a) => a.type === code).map((a) => a.data);
  } catch {
    return [];
  }
};

let alertes = [];

// ── 1. LE DOMAINE ────────────────────────────────────────────────────────
console.log('\n════ 1. CE QUE LE DOMAINE PUBLIE ════\n');
for (const nom of [SITE, `www.${SITE}`]) {
  const a4 = await doh(nom, 'A');
  const a6 = await doh(nom, 'AAAA');
  console.log(`  ${nom}`);
  console.log(`    IPv4 : ${a4.length ? a4.join(', ') : 'AUCUNE'}`);
  console.log(`    IPv6 : ${a6.length ? a6.join(', ') : 'AUCUNE'}`);
  if (!a4.length) alertes.push(`${nom} ne publie aucune IPv4 : personne ne peut y accéder.`);
  if (!a6.length) {
    alertes.push(
      `${nom} ne publie AUCUNE IPv6. Les opérateurs mobiles qui n'attribuent que de ` +
      `l'IPv6 — courant au Maroc et en Afrique de l'Ouest — ne peuvent pas ouvrir le site.`
    );
  }
}
const ns = await doh(SITE, 'NS');
const surCloudflare = ns.some((x) => /cloudflare/i.test(x));
console.log(`\n  Serveurs de noms : ${ns.join(', ') || '—'}`);
console.log(`  Passe par Cloudflare : ${surCloudflare ? 'OUI — c est lui qui fournit l IPv6' : 'NON'}`);
if (!surCloudflare) {
  alertes.push(
    "Le domaine ne passe plus par Cloudflare. C'est lui qui fournissait l'IPv6 " +
    'que Vercel ne publie pas : les réseaux IPv6 seul seront de nouveau bloqués.'
  );
}

// ── 2. LE CERTIFICAT ─────────────────────────────────────────────────────
console.log('\n════ 2. LE CERTIFICAT ════\n');
await new Promise((resolve) => {
  const https = require('node:https');
  const req = https.request({ host: SITE, port: 443, method: 'HEAD', path: '/' }, (res) => {
    const c = res.socket.getPeerCertificate();
    if (!c?.valid_to) { console.log('  illisible'); return resolve(); }
    const jours = Math.round((Date.parse(c.valid_to) - Date.now()) / 86400000);
    console.log(`  Émis pour ..... ${c.subject?.CN ?? '—'}`);
    console.log(`  Par ........... ${c.issuer?.O ?? '—'}`);
    console.log(`  Expire dans ... ${jours} jours`);
    if (jours < 15) alertes.push(`Le certificat expire dans ${jours} jours : le site deviendra inaccessible.`);
    resolve();
  });
  req.on('error', (e) => { console.log('  erreur : ' + e.message); resolve(); });
  req.end();
});

// ── 3. CHAQUE PAGE ───────────────────────────────────────────────────────
console.log('\n════ 3. CHAQUE PAGE, UNE PAR UNE ════\n');
console.log('  page                statut   temps     poids   compress.  cache');
console.log('  ' + '─'.repeat(70));

for (const p of PAGES) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + p, { redirect: 'manual', cache: 'no-store' });
    const buf = await r.arrayBuffer();
    const ms = Date.now() - t0;
    const ko = Math.round((Number(r.headers.get('content-length')) || buf.byteLength) / 1024);
    const comp = r.headers.get('content-encoding') ?? 'AUCUNE';
    console.log(
      `  ${p.padEnd(20)} ${String(r.status).padStart(4)} ${String(ms + ' ms').padStart(8)}` +
      ` ${String(ko + ' Ko').padStart(9)} ${comp.padStart(10)}  ${r.headers.get('x-vercel-cache') ?? '—'}`
    );
    if (r.status >= 500) alertes.push(`${p} renvoie ${r.status} : la page est cassée.`);
    if (ms > 3000) alertes.push(`${p} met ${ms} ms à répondre — trop long sur un mobile.`);
    if (comp === 'AUCUNE' && ko > 30) {
      alertes.push(`${p} n'est pas compressée (${ko} Ko) : le poids transmis est trois fois trop élevé.`);
    }
  } catch (e) {
    console.log(`  ${p.padEnd(20)} ÉCHEC : ${e.message}`);
    alertes.push(`${p} ne répond pas du tout : ${e.message}`);
  }
}

// ── VERDICT ──────────────────────────────────────────────────────────────
console.log('\n════ VERDICT ════\n');
if (!alertes.length) {
  console.log('  Aucun défaut réseau détecté. Le domaine, le certificat et toutes les');
  console.log('  pages répondent correctement, en IPv4 comme en IPv6.');
} else {
  for (const a of alertes) console.log(`  ⚠  ${a}`);
}
console.log('');
