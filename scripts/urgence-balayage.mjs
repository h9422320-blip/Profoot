/**
 * URGENCE — on teste TOUTES les pages publiques, comme un telephone Android.
 * Lecture seule, aucune ecriture.
 */
const PAGES = [
  '/', '/pricing', '/login', '/signup', '/mot-de-passe-oublie', '/competitions',
  '/matches', '/preuves', '/standings', '/stats', '/support', '/cgv',
  '/confidentialite', '/mentions-legales', '/payment-success', '/payment-failed',
  '/maintenance', '/search', '/club/33', '/competitions/laliga', '/match/1',
  '/analyze', '/dashboard', '/history', '/settings', '/expert',
];

const AGENT = 'Mozilla/5.0 (Linux; Android 13; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

console.log('\n  ══ BALAYAGE COMPLET, VU D UN TELEPHONE ══\n');
console.log('  page                        statut   duree   octets   remarque');
console.log('  ' + '─'.repeat(76));

const suspects = [];

for (const p of PAGES) {
  const t0 = Date.now();
  try {
    const r = await fetch('https://profootai.com' + p, {
      redirect: 'manual',
      headers: { 'user-agent': AGENT, 'accept-language': 'fr-FR,fr' },
    });
    const ms = Date.now() - t0;
    const dest = r.headers.get('location');
    let corps = '';
    if (r.status >= 200 && r.status < 300) corps = await r.text();

    const signes = [];
    if (/Application error|client-side exception/i.test(corps)) signes.push('ERREUR CLIENT');
    if (/Internal Server Error|500/.test(corps.slice(0, 800))) signes.push('ERREUR SERVEUR');
    if (r.status >= 500) signes.push('SERVEUR ' + r.status);
    if (r.status === 404) signes.push('INTROUVABLE');
    if (ms > 4000) signes.push('TRES LENT');
    if (corps && corps.length < 6000 && r.status === 200) signes.push('PAGE TRES COURTE');

    const remarque = dest ? `redirige vers ${dest.slice(0, 30)}` : signes.join(' · ');
    if (signes.length) suspects.push({ p, statut: r.status, ms, signes });

    console.log(
      `  ${p.padEnd(28)} ${String(r.status).padStart(5)} ${String(ms).padStart(7)} ms ${String(corps.length).padStart(8)}   ${remarque}`
    );
  } catch (e) {
    suspects.push({ p, statut: 'ECHEC', ms: Date.now() - t0, signes: [e.message] });
    console.log(`  ${p.padEnd(28)}  ECHEC ${String(Date.now() - t0).padStart(7)} ms            ${e.message}`);
  }
}

console.log('\n  ══ A REGARDER ══\n');
if (!suspects.length) console.log('  Aucune page en anomalie.');
for (const s of suspects) console.log(`  ${s.p.padEnd(28)} ${s.statut}  ${s.signes.join(' · ')}`);
console.log('');
