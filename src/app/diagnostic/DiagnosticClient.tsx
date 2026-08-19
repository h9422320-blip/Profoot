'use client';

import { useEffect, useState } from 'react';

/**
 * LES CONTRÔLES, EXÉCUTÉS DANS LE NAVIGATEUR DU VISITEUR.
 *
 * Chacun répond à une question précise sur la chaîne qui va de son téléphone
 * jusqu'à nos serveurs. Un seul maillon rompu suffit à rendre l'application
 * inutilisable, et jusqu'ici personne ne savait lequel.
 *
 * ORDRE DES CONTRÔLES : du plus fondamental au plus fin. Le premier qui échoue
 * est presque toujours la cause ; les suivants ne font que le confirmer.
 */

type Etat = 'attente' | 'ok' | 'echec';

interface Controle {
  cle: string;
  titre: string;
  /** Ce que signifie un échec, en français simple. */
  siEchec: string;
  etat: Etat;
  detail: string;
}

const DUREE_MAX = 8000;

/** Un appel qui n'aboutit pas doit échouer franchement, pas rester suspendu. */
async function avecDelai<T>(promesse: Promise<T>, ms = DUREE_MAX): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error('délai dépassé')), ms)),
  ]);
}

export default function DiagnosticClient({ pays }: { pays: string }) {
  const [controles, setControles] = useState<Controle[]>([]);
  const [termine, setTermine] = useState(false);
  const [resume, setResume] = useState('');

  useEffect(() => {
    const liste: Controle[] = [
      { cle: 'js', titre: 'Le JavaScript démarre', siEchec: "Navigateur trop ancien : l'application ne peut pas s'afficher.", etat: 'attente', detail: '' },
      { cle: 'navigateur', titre: 'Votre navigateur', siEchec: '', etat: 'attente', detail: '' },
      { cle: 'reseau', titre: 'Notre serveur répond', siEchec: "Le site est injoignable depuis votre connexion.", etat: 'attente', detail: '' },
      { cle: 'base', titre: 'La base de données répond', siEchec: "Le service de connexion est bloqué ou injoignable. C'est ce qui empêche de créer un compte et de se connecter.", etat: 'attente', detail: '' },
      { cle: 'cookies', titre: 'Les cookies fonctionnent', siEchec: 'Sans cookies, impossible de rester connecté.', etat: 'attente', detail: '' },
      { cle: 'stockage', titre: 'Le stockage local fonctionne', siEchec: "Navigation privée : l'historique ne sera pas conservé.", etat: 'attente', detail: '' },
      { cle: 'analyse', titre: "L'application répond", siEchec: "L'application elle-même ne répond pas.", etat: 'attente', detail: '' },
    ];
    setControles([...liste]);

    const majliste = (cle: string, etat: Etat, detail: string) => {
      const i = liste.findIndex((c) => c.cle === cle);
      if (i >= 0) {
        liste[i] = { ...liste[i], etat, detail };
        setControles([...liste]);
      }
    };

    (async () => {
      // 1. Le JavaScript tourne — si on est ici, c'est déjà gagné.
      majliste('js', 'ok', 'oui');

      // 2. Le navigateur, tel qu'il se présente.
      const ua = navigator.userAgent;
      const systeme = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : 'autre';
      const version = ua.match(/(?:Version|Chrome|CriOS|SamsungBrowser|Firefox)\/(\d+)/)?.[1] ?? '?';
      const nom = /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
        : /CriOS/i.test(ua) ? 'Chrome (iPhone)'
        : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
        : /Chrome\//i.test(ua) ? 'Chrome'
        : /Safari\//i.test(ua) ? 'Safari' : 'inconnu';
      const integre = /Instagram/i.test(ua) ? 'Instagram'
        : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'Facebook'
        : /musical_ly|Bytedance|TikTok/i.test(ua) ? 'TikTok'
        : /WhatsApp/i.test(ua) ? 'WhatsApp' : null;
      majliste('navigateur', 'ok', `${nom} ${version} sur ${systeme}${integre ? ` — ouvert depuis ${integre}` : ''}`);

      // 3. Notre propre serveur, avec une adresse qui répond instantanément.
      //    Interroger une route qui va chercher des données confondrait
      //    « injoignable » et « lent » — deux pannes qui n'appellent pas du
      //    tout la même réponse.
      try {
        const t0 = Date.now();
        const r = await avecDelai(fetch('/api/ping', { cache: 'no-store' }));
        majliste('reseau', r.ok ? 'ok' : 'echec', r.ok ? `oui, en ${Date.now() - t0} ms` : `refusé (code ${r.status})`);
      } catch (e: any) {
        majliste('reseau', 'echec', e?.message ?? 'injoignable');
      }

      // 4. LA BASE DE DONNÉES, appelée DEPUIS LE NAVIGATEUR.
      //    C'est le maillon le plus souvent coupé : elle vit sur un autre
      //    domaine que le site, et certains opérateurs la bloquent alors que le
      //    site s'affiche parfaitement. L'utilisateur voit alors une belle page
      //    sur laquelle rien ne fonctionne.
      const urlBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!urlBase) {
        majliste('base', 'echec', 'adresse non configurée');
      } else {
        try {
          const t0 = Date.now();
          await avecDelai(fetch(`${urlBase}/auth/v1/health`, { cache: 'no-store', mode: 'cors' }));
          majliste('base', 'ok', `oui, en ${Date.now() - t0} ms`);
        } catch (e: any) {
          majliste('base', 'echec', `INJOIGNABLE (${e?.message ?? 'bloquée'})`);
        }
      }

      // 5. Les cookies.
      try {
        document.cookie = 'profoot_test=1; path=/; SameSite=Lax';
        const ok = document.cookie.includes('profoot_test=1');
        document.cookie = 'profoot_test=; path=/; Max-Age=0';
        majliste('cookies', ok ? 'ok' : 'echec', ok ? 'oui' : 'REFUSÉS par le navigateur');
      } catch {
        majliste('cookies', 'echec', 'refusés');
      }

      // 6. Le stockage local.
      try {
        localStorage.setItem('profoot_test', '1');
        localStorage.removeItem('profoot_test');
        majliste('stockage', 'ok', 'oui');
      } catch {
        majliste('stockage', 'echec', 'refusé (navigation privée ?)');
      }

      // 7. Une vraie donnée de football, pas seulement un serveur en vie.
      //    Délai plus large : cette route interroge le fournisseur de données,
      //    et une connexion mobile lente n'est pas une panne.
      try {
        const t0 = Date.now();
        const r = await avecDelai(fetch('/api/competitions/status', { cache: 'no-store' }), 20000);
        majliste('analyse', r.ok ? 'ok' : 'echec', r.ok ? `oui, en ${Date.now() - t0} ms` : `code ${r.status}`);
      } catch (e: any) {
        majliste('analyse', 'echec', e?.message ?? 'pas de réponse');
      }

      setTermine(true);

      const echecs = liste.filter((c) => c.etat === 'echec');
      setResume(
        echecs.length === 0
          ? "Tout fonctionne sur cet appareil. Si l'application vous pose problème, ce n'est ni votre téléphone ni votre connexion."
          : `${echecs.length} problème${echecs.length > 1 ? 's' : ''} détecté${echecs.length > 1 ? 's' : ''} : ${echecs.map((c) => c.titre).join(', ')}.`
      );

      // On envoie le relevé pour qu'il soit lisible sans capture d'écran.
      // Un échec d'envoi ne change rien à ce qui est affiché.
      try {
        await fetch('/api/diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pays,
            navigateur: `${nom} ${version}`,
            systeme,
            integre,
            agent: ua,
            resultats: liste.map((c) => ({ cle: c.cle, etat: c.etat, detail: c.detail })),
          }),
        });
      } catch {
        /* le diagnostic reste affiché à l'écran */
      }
    })();
  }, [pays]);

  return (
    <>
      <section
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#34D399', margin: '0 0 12px' }}>
          Contrôles sur votre appareil
        </h2>

        {controles.map((c) => (
          <div key={c.cle} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 16, width: 20, flexShrink: 0 }}>
                {c.etat === 'attente' ? '…' : c.etat === 'ok' ? '✅' : '❌'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{c.titre}</span>
            </div>
            {c.detail && (
              <p style={{ margin: '4px 0 0 30px', fontSize: 12.5, color: c.etat === 'echec' ? '#fca5a5' : 'rgba(255,255,255,0.55)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                {c.detail}
              </p>
            )}
            {c.etat === 'echec' && c.siEchec && (
              <p style={{ margin: '6px 0 0 30px', fontSize: 12.5, color: '#fbbf24', lineHeight: 1.45 }}>
                {c.siEchec}
              </p>
            )}
          </div>
        ))}
      </section>

      {termine && (
        <section
          style={{
            marginTop: 16,
            background: resume.startsWith('Tout') ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)',
            border: `1px solid ${resume.startsWith('Tout') ? 'rgba(16,185,129,0.4)' : 'rgba(251,191,36,0.4)'}`,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <h2 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 8px' }}>Résultat</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{resume}</p>
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Envoyez une capture de cet écran à l&apos;équipe ProFoot AI.
          </p>
        </section>
      )}
    </>
  );
}
