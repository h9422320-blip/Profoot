/**
 * OÙ SE PERDENT LES SECONDES, PHASE PAR PHASE.
 *
 * Un « c'est lent » ne se corrige pas. Un « la poignée de main TLS prend
 * neuf secondes » se corrige. On décompose donc chaque requête :
 *
 *   DNS        trouver l'adresse
 *   CONNEXION  ouvrir le tuyau (TCP)
 *   TLS        se mettre d'accord sur le chiffrement
 *   ATTENTE    le temps que le serveur réfléchit avant le premier octet
 *   TRANSFERT  le temps de faire passer le contenu
 *
 * Une lenteur dans TLS accuse la configuration ; une lenteur dans ATTENTE
 * accuse le serveur d'origine ; une lenteur dans TRANSFERT accuse le poids.
 */
import https from 'node:https';

const cibles = [
  ['via Cloudflare', 'profootai.com'],
  ['Vercel direct  ', 'profoot-2lqq.vercel.app'],
];

const mesurer = (hote, chemin = '/login') =>
  new Promise((resolve) => {
    const t = { debut: Date.now() };
    const req = https.request(
      { host: hote, port: 443, path: chemin + '?t=' + Math.random(), method: 'GET', headers: { 'accept-encoding': 'br, gzip' } },
      (res) => {
        t.premierOctet = Date.now();
        let octets = 0;
        res.on('data', (c) => { octets += c.length; });
        res.on('end', () => {
          t.fin = Date.now();
          resolve({
            statut: res.statusCode,
            dns: t.dns - t.debut,
            connexion: t.connecte - t.dns,
            tls: t.securise - t.connecte,
            attente: t.premierOctet - t.securise,
            transfert: t.fin - t.premierOctet,
            total: t.fin - t.debut,
            octets,
          });
        });
      }
    );
    req.on('socket', (s) => {
      s.on('lookup', () => { t.dns = Date.now(); });
      s.on('connect', () => { t.connecte = Date.now(); });
      s.on('secureConnect', () => { t.securise = Date.now(); });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(40000, () => { req.destroy(); resolve(null); });
    req.end();
  });

console.log('\n  Chaque ligne est une visite complète, connexion neuve.\n');
console.log('  cible              essai    DNS  connex.    TLS  ATTENTE  transf.   TOTAL');
console.log('  ' + '─'.repeat(78));

const bilan = new Map();

for (const [nom, hote] of cibles) {
  const tous = [];
  for (let i = 1; i <= 6; i++) {
    const m = await mesurer(hote);
    if (!m) { console.log(`  ${nom}    ${i}    ÉCHEC / dépassement`); continue; }
    tous.push(m);
    const c = (v) => String(v).padStart(6);
    console.log(
      `  ${nom}    ${i} ${c(m.dns)} ${c(m.connexion)} ${c(m.tls)} ${c(m.attente)} ${c(m.transfert)} ${String(m.total).padStart(7)}` +
      (m.total > 3000 ? '  <<<' : '')
    );
    await new Promise((r) => setTimeout(r, 800));
  }
  bilan.set(nom, tous);
  console.log('');
}

console.log('  ══ CE QUI COÛTE LE PLUS ══\n');
for (const [nom, tous] of bilan) {
  if (!tous.length) continue;
  const moy = (cle) => Math.round(tous.reduce((s, m) => s + m[cle], 0) / tous.length);
  const pire = (cle) => Math.max(...tous.map((m) => m[cle]));
  console.log(`  ${nom}`);
  for (const cle of ['dns', 'connexion', 'tls', 'attente', 'transfert']) {
    console.log(`    ${cle.padEnd(11)} moyenne ${String(moy(cle)).padStart(6)} ms    pire ${String(pire(cle)).padStart(6)} ms`);
  }
  console.log(`    ${'TOTAL'.padEnd(11)} moyenne ${String(moy('total')).padStart(6)} ms    pire ${String(pire('total')).padStart(6)} ms\n`);
}
