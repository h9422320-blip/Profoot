/** Le lien reçu par courriel mène-t-il vraiment à un mot de passe changé ? */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const etat = JSON.parse(fs.readFileSync('scratch-test-connexion.json', 'utf8'));
const publique = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

// Le jeton lu dans le lien du courriel reçu.
const TOKEN = '4f63dfed85f5e2a6406fc84bbece64752b3706960c33faea10a38509';

console.log('\n  ══ LE LIEN DU COURRIEL, SUIVI JUSQU AU BOUT ══\n');

// 1. Ce que fait la page /reinitialiser-mot-de-passe en arrivant.
const sb = publique();
const { data: v, error: ev } = await sb.auth.verifyOtp({ token_hash: TOKEN, type: 'recovery' });
console.log(`  1. Le lien ouvre une session : ${v?.session ? 'OUI' : 'NON — ' + ev?.message}`);
if (!v?.session) { console.log('\n  ✘ NON RÉSOLU\n'); process.exit(1); }

// 2. Le nouveau mot de passe est accepté.
const { error: eu } = await sb.auth.updateUser({ password: etat.nouveau });
console.log(`  2. Nouveau mot de passe accepté : ${eu ? 'NON — ' + eu.message : 'OUI'}`);

// 3. La connexion avec le nouveau mot de passe.
const { data: s, error: es } = await publique().auth.signInWithPassword({
  email: etat.adresse, password: etat.nouveau,
});
console.log(`  3. Connexion avec le nouveau  : ${s?.session ? 'RÉUSSIE' : 'ÉCHEC — ' + es?.message}`);

// 4. L ancien mot de passe ne marche plus.
const { data: s2 } = await publique().auth.signInWithPassword({
  email: etat.adresse, password: etat.motDePasse,
});
console.log(`  4. L ancien ne marche plus     : ${s2?.session ? 'IL MARCHE ENCORE — PROBLÈME' : 'confirmé'}`);

// 5. Le lien ne fonctionne qu une fois.
const { data: v2, error: ev2 } = await publique().auth.verifyOtp({ token_hash: TOKEN, type: 'recovery' });
console.log(`  5. Le lien est à usage unique  : ${v2?.session ? 'NON, REJOUABLE — PROBLÈME' : 'confirmé (' + String(ev2?.message).slice(0, 40) + ')'}`);

const tout = !!v?.session && !eu && !!s?.session && !s2?.session && !v2?.session;
console.log(`\n  ${tout ? '✔ RÉSOLU' : '✘ NON RÉSOLU'}\n`);
fs.writeFileSync('scratch-test-connexion.json', JSON.stringify({ ...etat, test2: tout }, null, 1));
