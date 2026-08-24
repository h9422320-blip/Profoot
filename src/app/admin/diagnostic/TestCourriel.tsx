'use client';

import { useEffect, useState } from 'react';
import { Mail, Check, X, Loader2 } from 'lucide-react';

/**
 * LE BOUTON QUI RÉPOND À « EST-CE QUE L'ENVOI MARCHE ? »
 *
 * Le rattrapage quotidien prévient les clients dont l'accès vient d'être
 * rouvert — mais il ne s'exécute que lorsqu'il y a quelqu'un à rattraper,
 * c'est-à-dire, si tout va bien, jamais.
 *
 * Sans ce bouton, on ne découvrirait la panne d'envoi que le jour où elle
 * compte : un client attend, l'accès est rouvert, et le message qui devait le
 * lui dire ne part pas.
 *
 * Le message ne part que vers l'adresse de l'administrateur connecté. La route
 * n'accepte aucun destinataire : il n'y a pas de paramètre à détourner.
 */
export default function TestCourriel() {
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'ok' | 'erreur'>('repos');
  const [detail, setDetail] = useState<string>('');

  /**
   * L'ÉTAT DU SERVEUR, CONSTATÉ SANS RIEN ENVOYER.
   *
   * La question « la clé est-elle bien dans Vercel ? » ne se répond pas depuis
   * un poste de développement : `.env.local` et la production sont deux
   * environnements distincts. Les confondre a produit, le 24 août 2026, un
   * « l'envoi n'est pas configuré » qui ne décrivait que la machine locale.
   *
   * Cette lecture interroge le serveur qui sert cette page. Elle ne montre
   * jamais la clé — seulement si elle est là.
   */
  const [config, setConfig] = useState<{
    variableAttendue: string;
    presenteSurCeServeur: boolean;
    expediteur: string;
    verdict: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/diagnostic/courriel')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setConfig(d))
      .catch(() => setConfig(null));
  }, []);

  async function tester() {
    setEtat('envoi');
    setDetail('');
    try {
      const r = await fetch('/api/diagnostic/courriel', { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        setEtat('ok');
        setDetail(d.message ?? 'Message envoyé.');
      } else {
        setEtat('erreur');
        setDetail([d.cause, d.quoiFaire].filter(Boolean).join(' — '));
      }
    } catch (e: any) {
      setEtat('erreur');
      setDetail(e?.message ?? 'Appel impossible.');
    }
  }

  return (
    <div className="rounded-[20px] border border-border-card bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-foreground/40" />
        <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground">
          Envoi de courriel
        </h2>
      </div>
      <p className="text-[11.5px] text-foreground/45 leading-relaxed mb-4">
        C&apos;est ce canal qui prévient un client lorsque son accès, payé mais non reçu,
        vient d&apos;être rouvert automatiquement. Le test écrit à votre propre adresse.
      </p>

      {/* ── L'ÉTAT DU SERVEUR, AVANT MÊME D'ESSAYER ──────────────────────
          Le nom exact de la variable est affiché : une clé posée dans Vercel
          sous RESEND_KEY ou RESEND_API ne serait jamais lue, et rien ne le
          signalerait — les courriels ne partiraient simplement pas. */}
      {config && (
        <div
          className={`rounded-[14px] border px-3.5 py-2.5 mb-4 ${
            config.presenteSurCeServeur
              ? 'border-primary/25 bg-primary/[0.07]'
              : 'border-warning/30 bg-warning/[0.07]'
          }`}
        >
          <div className="flex items-center gap-2">
            {config.presenteSurCeServeur ? (
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-warning shrink-0" />
            )}
            <span className="text-[12px] font-bold text-foreground/80">
              {config.variableAttendue}{' '}
              {config.presenteSurCeServeur ? 'est en place sur ce serveur' : 'absente de ce serveur'}
            </span>
          </div>
          <p className="text-[11px] text-foreground/45 mt-1.5 leading-relaxed">
            {config.verdict} Les messages partent de{' '}
            <span className="text-foreground/70">{config.expediteur}</span>.
          </p>
        </div>
      )}

      <button
        onClick={tester}
        disabled={etat === 'envoi'}
        className="inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/30 px-4 py-2 text-[12px] font-bold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
      >
        {etat === 'envoi' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi en cours…
          </>
        ) : (
          <>
            <Mail className="w-3.5 h-3.5" /> Envoyer un message de test
          </>
        )}
      </button>

      {etat === 'ok' && (
        <div className="mt-3 flex items-start gap-2 text-[12px] text-primary">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{detail}</span>
        </div>
      )}
      {etat === 'erreur' && (
        <div className="mt-3 flex items-start gap-2 text-[12px] text-warning">
          <X className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{detail}</span>
        </div>
      )}
    </div>
  );
}
