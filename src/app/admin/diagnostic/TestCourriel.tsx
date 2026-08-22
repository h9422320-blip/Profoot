'use client';

import { useState } from 'react';
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
