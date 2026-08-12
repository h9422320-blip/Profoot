import { ImageResponse } from 'next/og';

/**
 * Image d'aperçu, celle qui s'affiche quand un lien vers ProFoot est partagé
 * sur WhatsApp, Facebook ou X, et que Google peut reprendre dans ses résultats.
 *
 * Elle était jusqu'ici remplacée par `/logo.png` — un fichier qui est en réalité
 * un JPEG et dont les dimensions ne correspondent pas à celles déclarées. Les
 * réseaux sociaux recadraient alors n'importe comment, ou n'affichaient aucun
 * aperçu. Or l'essentiel du trafic de lancement passe par des liens partagés
 * dans WhatsApp : un lien sans visuel se remarque beaucoup moins.
 *
 * L'image est fabriquée ici plutôt qu'ajoutée en fichier : elle est toujours
 * exactement au format attendu, et le texte reste modifiable sans repasser par
 * un outil de dessin.
 *
 * Contrainte du moteur de rendu : tout bloc contenant plus d'un enfant doit
 * déclarer `display` explicitement. Sans cela l'image ne plante pas à la
 * compilation — elle renvoie une erreur 500 en production, et le lien partagé
 * perd son aperçu sans que rien ne le signale.
 */
export const runtime = 'edge';
export const alt = "ProFoot AI — l'analyse de matchs par intelligence artificielle";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const COMPETITIONS = ['Premier League', 'La Liga', 'Ligue 1', 'Serie A', 'CAN'];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 90px',
          background: 'linear-gradient(135deg, #0b1620 0%, #16242e 55%, #0d2a24 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 38 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 900,
              color: '#0b1620',
              marginRight: 18,
            }}
          >
            P
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#ffffff' }}>
            <div style={{ marginRight: 10 }}>ProFoot</div>
            <div style={{ color: '#10b981' }}>AI</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 30 }}>
          <div style={{ fontSize: 74, fontWeight: 900, color: '#ffffff', lineHeight: 1.08 }}>
            L’analyse de matchs
          </div>
          <div style={{ fontSize: 74, fontWeight: 900, color: '#ffffff', lineHeight: 1.08 }}>
            par intelligence artificielle
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: 'rgba(255,255,255,0.62)', marginBottom: 46 }}>
          Forme des équipes, absents et confrontations directes — avant le coup d’envoi.
        </div>

        <div style={{ display: 'flex' }}>
          {COMPETITIONS.map((c) => (
            <div
              key={c}
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 700,
                color: '#10b981',
                border: '2px solid rgba(16,185,129,0.35)',
                borderRadius: 999,
                padding: '9px 22px',
                marginRight: 14,
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
