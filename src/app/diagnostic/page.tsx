import type { Metadata } from 'next';
import { headers } from 'next/headers';
import DiagnosticClient from './DiagnosticClient';

/**
 * LA PAGE QUI DIT POURQUOI L'APPLICATION NE MARCHE PAS, DEPUIS L'APPAREIL DU
 * VISITEUR.
 *
 * POURQUOI ELLE EXISTE
 *
 * Plusieurs personnes au Maroc n'arrivent pas à se servir de ProFoot AI. Un
 * seul compte marocain a jamais été créé, il n'est jamais revenu, et aucune
 * tentative de paiement n'est jamais partie de là-bas. « Ça ne marche pas » est
 * tout ce qu'on sait, et ce n'est pas diagnosticable.
 *
 * Le fondateur n'est pas au Maroc, moi non plus, et personne ne peut y tester.
 * Alors plutôt que de continuer à supposer, on envoie un instrument : cette
 * page s'ouvre sur N'IMPORTE quel téléphone, exécute les contrôles un par un,
 * et affiche un résultat lisible que la personne peut photographier.
 *
 * ELLE DOIT MARCHER LÀ OÙ LE RESTE ÉCHOUE
 *
 * Rendue par le serveur, sans dépendre d'une session, sans base de données, et
 * volontairement dépouillée. Si l'application entière est cassée sur un
 * appareil, cette page-là doit quand même s'afficher — sinon elle ne sert à
 * rien.
 */

export const metadata: Metadata = {
  title: 'Diagnostic technique',
  description: "Vérifie que ProFoot AI fonctionne correctement sur votre appareil.",
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PageDiagnostic() {
  const h = await headers();

  // Ce que le SERVEUR voit de ce visiteur. Relevé ici parce que le navigateur,
  // lui, ne connaît ni son pays ni l'adresse par laquelle il est arrivé.
  const vuParLeServeur = {
    pays: (h.get('x-vercel-ip-country') || '').toUpperCase() || 'inconnu',
    ville: h.get('x-vercel-ip-city') || 'inconnue',
    agent: h.get('user-agent') || 'inconnu',
    langue: h.get('accept-language') || 'inconnue',
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#101c24',
        color: '#fff',
        padding: '20px 16px 60px',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>
          Diagnostic ProFoot AI
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: '0 0 22px', lineHeight: 1.5 }}>
          Cette page vérifie ce qui fonctionne — et ce qui ne fonctionne pas — sur votre téléphone.
          Attendez quelques secondes, puis envoyez une capture d&apos;écran de tout ce qui suit.
        </p>

        {/* CE BLOC EST ÉCRIT PAR LE SERVEUR.
            S'il s'affiche mais que rien d'autre n'apparaît, c'est déjà une
            réponse : le JavaScript ne démarre pas sur cet appareil. */}
        <section
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#34D399', margin: '0 0 12px' }}>
            Ce que notre serveur voit
          </h2>
          <Ligne libelle="Pays détecté" valeur={vuParLeServeur.pays} />
          <Ligne libelle="Ville" valeur={vuParLeServeur.ville} />
          <Ligne libelle="Langue" valeur={vuParLeServeur.langue.split(',')[0]} />
          <Ligne libelle="Appareil" valeur={vuParLeServeur.agent} petit />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '12px 0 0', lineHeight: 1.5 }}>
            Ce bloc vient du serveur. Si vous le voyez, la page est bien arrivée jusqu&apos;à vous.
          </p>
        </section>

        <DiagnosticClient pays={vuParLeServeur.pays} />
      </div>
    </main>
  );
}

function Ligne({ libelle, valeur, petit }: { libelle: string; valeur: string; petit?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, minWidth: 108, flexShrink: 0 }}>{libelle}</span>
      <span
        style={{
          fontSize: petit ? 11 : 13,
          fontWeight: 600,
          wordBreak: 'break-word',
          lineHeight: 1.45,
        }}
      >
        {valeur}
      </span>
    </div>
  );
}
