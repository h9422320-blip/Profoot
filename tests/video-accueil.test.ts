/**
 * ★ ACQUIS — LA VIDÉO DE PRÉSENTATION JOUE TOUTE SEULE, EN BOUCLE, DÈS L'ARRIVÉE.
 *
 * Le propriétaire l'a demandé le 14 octobre 2026 : visible dès qu'on arrive
 * sur la page d'accueil, lancée sans aucun clic, et qui repart dès qu'elle
 * finit. Chacun de ces trois points tient à un attribut précis ; en perdre un
 * seul, et la vidéo reste figée sur l'image d'attente, sans que rien ne casse
 * à la compilation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const ACCUEIL = 'src/app/LandingClient.tsx';

test('★ ACQUIS — la balise vidéo porte tout ce qu’il faut pour partir sans clic', () => {
  const s = lire(ACCUEIL);
  const balise = s.match(/const BALISE_VIDEO =([\s\S]*?);\n/)?.[1] ?? '';
  assert.ok(balise, 'La balise de la vidéo de présentation a disparu.');
  // Sans `muted`, aucun navigateur n'accepte de lancer la vidéo tout seul.
  for (const a of ['autoplay', 'muted', 'loop', 'playsinline', 'webkit-playsinline']) {
    assert.match(balise, new RegExp(`\\b${a}\\b`), `L’attribut « ${a} » manque sur la vidéo.`);
  }
  // Jamais de commandes : elle n'a pas de bouton « lecture ».
  assert.doesNotMatch(balise, /\bcontrols\b/, 'La vidéo affiche des commandes de lecture.');
  // Le HTML est écrit tel quel : React poserait `muted` trop tard pour Safari.
  assert.match(s, /dangerouslySetInnerHTML=\{\{ __html: BALISE_VIDEO \}\}/, 'La balise n’est plus écrite telle quelle.');
});

test('★ ACQUIS — les fichiers de la vidéo sont bien servis par le site', () => {
  for (const f of ['public/video/presentation.mp4', 'public/video/presentation-affiche.jpg']) {
    assert.ok(fs.existsSync(path.join(process.cwd(), f)), `${f} est introuvable.`);
  }
  const taille = fs.statSync(path.join(process.cwd(), 'public/video/presentation.mp4')).size;
  // Au-delà, un téléphone sur réseau mobile attend trop avant de la voir bouger.
  assert.ok(taille < 8 * 1024 * 1024, `La vidéo pèse ${(taille / 1048576).toFixed(1)} Mo : trop lourde pour l’accueil.`);
});

test('★ ACQUIS — la vidéo, seule, passe avant le bouton, dans la première vue', () => {
  const css = lire('src/app/landing.css');
  assert.match(css, /\.hero-content > \.hero-video-bloc \{ order: 3; \}/, 'La vidéo n’est plus remontée sous le titre sur téléphone.');
  assert.match(css, /\.hero-content > \.hero-zone-cta \{ order: 4; \}/);
  assert.match(css, /grid-template-areas: "badge video" "titre video" "sous video" "cta video"/, 'La vidéo n’est plus à côté du texte sur ordinateur.');
});

test('★ ACQUIS — plus de téléphone autour de la vidéo de l’accueil', () => {
  // Le propriétaire l'a demandé le 14 octobre 2026 : la vidéo seule.
  const s = lire(ACCUEIL);
  const heros = s.slice(s.indexOf('<section className="hero-section">'), s.indexOf('</section>', s.indexOf('<section className="hero-section">')));
  assert.match(heros, /<VideoPresentation \/>/, 'La vidéo a disparu de l’en-tête.');
  assert.doesNotMatch(heros, /hero-app-mockup|mockup-screen|BoutonsLateraux|mockup-notch/, 'Le téléphone est revenu autour de la vidéo.');
});
