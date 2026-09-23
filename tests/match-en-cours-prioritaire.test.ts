/**
 * ★ ACQUIS — PENDANT UN MATCH, C'EST CE MATCH QU'ON ANALYSE.
 *
 * Défaut trouvé le 23 septembre 2026 : l'analyse retenait la rencontre À VENIR
 * avant celle en cours. Un abonné qui analysait Atlético–Real pendant le derby
 * du 20 septembre lisait « 4 avril 2027 » comme date du match, et son analyse
 * portait le numéro du match retour — donc ne pouvait JAMAIS être confrontée à
 * un résultat. Sur 1 000 analyses non jugées de plus de trois jours, 889
 * pointaient ainsi vers une rencontre à venir.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');

test('★ ACQUIS — le numéro retenu est celui du match en cours', () => {
  assert.match(
    src,
    /fixtureIdResolu =\s*matchDirect\?\.fixtureId \?\?\s*targetFutureMatch\?\.fixture\?\.id \?\?\s*targetPastMatch\?\.fixture\?\.id/,
    'La rencontre à venir est repassée devant le direct : les analyses du jour redeviendront injugeables.'
  );
});

test('★ ACQUIS — la date et le stade affichés sont ceux du match en cours', () => {
  assert.match(
    src,
    /const lieuConnu = fixtureEnCours \|\| targetFutureMatch \|\| targetPastMatch \|\| nextH2H;/,
    'L’écran peut de nouveau annoncer la date du match retour pendant le match.'
  );
  assert.match(src, /if \(matchDirect\) fixtureEnCours = rencontreEnDirect;/);
  assert.match(src, /fixtureEnCours = fiche\?\.response\?\.\[0\] \?\? rencontreEnDirectH2H;/);
});

test('★ ACQUIS — le direct retrouvé par la seconde source reprend la première place', () => {
  assert.match(src, /fixtureIdResolu = matchDirect\.fixtureId;/);
  assert.doesNotMatch(src, /fixtureIdResolu \?\?= matchDirect\.fixtureId;/);
});
