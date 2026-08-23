import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/**
 * AUCUNE TABLE SENSIBLE N'EST LISIBLE AVEC LA CLÉ PUBLIQUE.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 23 AOÛT 2026 ───────────────────────────────────
 *
 * L'audit a testé quatorze tables avec la CLÉ PUBLIQUE — celle dont dispose
 * n'importe quel visiteur, puisqu'elle voyage dans le navigateur. Treize
 * refusaient la lecture. Une l'acceptait : `app_settings`.
 *
 * Elle rendait le nom de l'application, l'adresse de contact, le mode
 * maintenance — tout cela est public par nature — ET `updated_by`, c'est-à-dire
 * L'ADRESSE DU COMPTE ADMINISTRATEUR. C'est le premier ingrédient d'une prise
 * de compte : un attaquant qui sait qui viser n'a plus qu'à s'occuper du mot
 * de passe.
 *
 * ── POURQUOI CE TEST INTERROGE LA VRAIE BASE ──────────────────────────────
 *
 * Une politique de sécurité ne se lit pas dans le code : elle vit dans la base.
 * Un test qui se contenterait de vérifier qu'un fichier SQL existe ne prouverait
 * rien — le fichier peut être écrit et jamais exécuté, ce qui est exactement ce
 * qui s'est passé pour d'autres migrations.
 *
 * Sans configuration locale, le test s'abstient plutôt que d'échouer : il ne
 * doit pas bloquer une mise en ligne parce qu'il tourne hors du poste de
 * développement.
 */

function clePublique() {
  try {
    const env = Object.fromEntries(
      fs.readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
        })
    );
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  } catch {
    return null;
  }
}

test('★ ACQUIS — aucune table sensible ne se lit avec la clé publique', async (t) => {
  const anon = clePublique();
  if (!anon) return t.skip('Configuration locale absente : contrôle impossible ici.');

  const SENSIBLES = [
    'app_settings',
    'subscriptions',
    'analysis_history',
    'payment_intents',
    'predictions_match',
    'analysis_usage',
    'matchs_debloques',
    'webhook_events',
    'partners',
    'visites_pages',
  ];

  const ouvertes: string[] = [];

  for (const table of SENSIBLES) {
    const { data, error } = await anon.from(table).select('*').limit(1);
    // Une table absente n'est pas une faille.
    if (error && /does not exist|schema cache/i.test(error.message)) continue;
    if (!error && data && data.length > 0) ouvertes.push(table);
  }

  assert.deepEqual(
    ouvertes,
    [],
    `Ces tables sont redevenues lisibles par n'importe quel visiteur : ${ouvertes.join(', ')}. ` +
      "`app_settings` exposait ainsi l'adresse du compte administrateur — de quoi savoir qui viser."
  );
});
