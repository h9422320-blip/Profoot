/**
 * LE PARCOURS DE CONNEXION, TESTÉ EN VRAI.
 *
 * Trois situations, sur la vraie base et le vrai service d'envoi.
 * Le compte de test est supprimé à la fin.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { messageAuth } = await jiti.import('../src/lib/messages-auth.ts');

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const publique = () => createClient(URL, ANON, { auth: { persistSession: false } });

// Adresse à alias : elle arrive dans la boîte du propriétaire, ce qui permet
// de LIRE le courriel de réinitialisation et de vérifier qu'il part vraiment.
const ADRESSE = 'm09997818+pfconnexion@gmail.com';
const MOT_DE_PASSE = `Test-${Math.random().toString(36).slice(2, 10)}!`;
const NOUVEAU = `Neuf-${Math.random().toString(36).slice(2, 10)}!`;

const ok = (b) => (b ? '✔ RÉSOLU' : '✘ NON RÉSOLU');
console.log('');

// ── Ménage préalable ───────────────────────────────────────────────────────
const { data: liste } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const ancien = liste?.users?.find((u) => u.email === ADRESSE);
if (ancien) { await admin.auth.admin.deleteUser(ancien.id); console.log('  (ancien compte de test supprimé)\n'); }

// ══ SITUATION 1 — aucun compte ════════════════════════════════════════════
console.log('  ══ 1. NOUVEAU VISITEUR, AUCUN COMPTE ══\n');
const { error: e1 } = await publique().auth.signInWithPassword({ email: ADRESSE, password: MOT_DE_PASSE });
console.log(`  Supabase répond      : « ${e1?.message} »`);
const m1 = messageAuth(e1?.message);
console.log(`  L'utilisateur lit    : « ${m1.texte} »`);
console.log(`  Porte de sortie      : ${m1.lien ? m1.lien.texte + ' → ' + m1.lien.href : 'AUCUNE'}`);
const test1a = !/invalid|credential/i.test(m1.texte) && /compte/i.test(m1.texte) && m1.lien?.href === '/signup';

// Il suit le lien et crée son compte.
const { data: inscription, error: e1b } = await publique().auth.signUp({
  email: ADRESSE, password: MOT_DE_PASSE, options: { data: { full_name: 'Test Connexion' } },
});
const compteCree = !e1b && !!inscription?.user;
console.log(`  Création du compte   : ${compteCree ? 'réussie' : 'ÉCHEC — ' + e1b?.message}`);
console.log(`  Confirmation exigée  : ${inscription?.session ? 'non, connecté aussitôt' : 'OUI, il faut confirmer l e-mail'}`);
console.log(`\n  ${ok(test1a && compteCree)}\n`);

// ══ SITUATION 3 — bon mot de passe (testée avant la réinitialisation) ══════
console.log('  ══ 3. COMPTE EXISTANT, BON MOT DE PASSE ══\n');
// La confirmation est forcée côté administration pour tester la connexion
// elle-même, sans dépendre d'un clic dans une boîte mail.
const idCompte = inscription?.user?.id;
if (idCompte) await admin.auth.admin.updateUserById(idCompte, { email_confirm: true });
const { data: s3, error: e3 } = await publique().auth.signInWithPassword({ email: ADRESSE, password: MOT_DE_PASSE });
console.log(`  Connexion            : ${s3?.session ? 'réussie, session ouverte' : 'ÉCHEC — ' + e3?.message}`);
console.log(`\n  ${ok(!!s3?.session)}\n`);

// ══ SITUATION 2 — mot de passe oublié ═════════════════════════════════════
console.log('  ══ 2. MOT DE PASSE OUBLIÉ — L E-MAIL PART-IL VRAIMENT ? ══\n');
const avant = new Date();
const { error: e2 } = await publique().auth.resetPasswordForEmail(ADRESSE, {
  redirectTo: 'https://profootai.com/reinitialiser-mot-de-passe',
});
console.log(`  Demande envoyée      : ${e2 ? 'REFUSÉE — ' + e2.message : 'acceptée par Supabase'}`);
console.log(`  Adresse visée        : ${ADRESSE}`);
console.log(`  Envoyée à            : ${avant.toISOString().slice(11, 19)} UTC`);
console.log(`\n  → Vérification de l arrivée réelle dans la boîte : étape suivante.\n`);

fs.writeFileSync('scratch-test-connexion.json', JSON.stringify({
  adresse: ADRESSE, motDePasse: MOT_DE_PASSE, nouveau: NOUVEAU,
  idCompte, envoyeeA: avant.toISOString(), test1: test1a && compteCree, test3: !!s3?.session,
}, null, 1));
