'use client';

import { useEffect, useState } from 'react';

/**
 * LE BOUTON « PARTAGER MON AFFICHE DU JOUR ».
 *
 * ── CE QU'IL FAIT ────────────────────────────────────────────────────────
 *
 * Il demande au serveur si la fonctionnalité est ouverte pour ce compte. Si
 * non, il ne rend RIEN — pas un bouton grisé, pas un message : rien. Pendant
 * l'essai privé, les autres abonnés ne doivent pas même savoir qu'elle existe.
 *
 * Si oui, il récupère le PNG produit par `/api/affiche`, le propose au partage
 * natif du téléphone (statut WhatsApp, story Instagram) et, à défaut, au
 * téléchargement.
 *
 * ── POURQUOI L'API DE PARTAGE AVEC FICHIER ──────────────────────────────
 *
 * Sur mobile, `navigator.share({ files })` ouvre la feuille de partage du
 * système : deux tapes et l'affiche est sur le statut. Tous les navigateurs ne
 * l'acceptent pas — d'où `canShare` demandé AVANT, et le téléchargement en
 * repli. Aucun écran ne doit rester bloqué parce qu'une API manque.
 */

interface Etat {
  disponible: boolean;
  jour?: string;
  analysesDuJour?: number;
  analysesDuMois?: number;
  serie?: number;
  matchs?: number;
}

type Format = 'story' | 'carre';

export default function AfficheDuJour() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState<Format | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch('/api/affiche/etat')
      .then((r) => (r.ok ? r.json() : { disponible: false }))
      .then((x) => {
        if (vivant) setEtat(x);
      })
      .catch(() => {
        if (vivant) setEtat({ disponible: false });
      });
    return () => {
      vivant = false;
    };
  }, []);

  // Libérer l'aperçu quand il est remplacé ou que le composant disparaît.
  useEffect(() => () => {
    if (apercu) URL.revokeObjectURL(apercu);
  }, [apercu]);

  if (!etat?.disponible) return null;

  const nomFichier = `profoot-affiche-${etat.jour ?? 'du-jour'}.png`;

  async function produire(format: Format): Promise<File | null> {
    const r = await fetch(`/api/affiche?format=${format === 'carre' ? 'carre' : 'story'}`);
    if (!r.ok) {
      setMessage("L'affiche n'a pas pu être créée. Réessayez dans un instant.");
      return null;
    }
    const blob = await r.blob();
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(URL.createObjectURL(blob));
    return new File([blob], nomFichier, { type: 'image/png' });
  }

  async function partager(format: Format) {
    setMessage(null);
    setEnCours(format);
    try {
      const fichier = await produire(format);
      if (!fichier) return;

      const partageur = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (partageur.share && partageur.canShare?.({ files: [fichier] })) {
        await partageur.share({
          files: [fichier],
          title: 'Mon affiche du jour — ProFoot AI',
          text: 'Mon activité d’analyse du jour avec ProFoot AI — profootai.com',
        });
        return;
      }

      // Repli : on télécharge, l'abonné partage depuis sa galerie.
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(fichier);
      lien.download = nomFichier;
      lien.click();
      URL.revokeObjectURL(lien.href);
      setMessage('Affiche enregistrée dans vos images — partagez-la depuis votre galerie.');
    } catch (e: any) {
      // Un partage annulé par l'utilisateur n'est pas une erreur.
      if (e?.name !== 'AbortError') setMessage("Le partage n'a pas abouti. L'affiche reste téléchargeable.");
    } finally {
      setEnCours(null);
    }
  }

  async function copierLeLien() {
    try {
      await navigator.clipboard.writeText('https://profootai.com');
      setMessage('Lien profootai.com copié.');
    } catch {
      setMessage('Copie impossible sur ce navigateur : profootai.com');
    }
  }

  const n = etat.analysesDuJour ?? 0;
  const resume =
    n === 0
      ? "Aucune analyse aujourd'hui pour l'instant"
      : n === 1
        ? '1 match analysé aujourd’hui'
        : `${n} matchs analysés aujourd’hui`;

  return (
    <section
      style={{
        marginTop: 24,
        padding: 18,
        borderRadius: 18,
        border: '1px solid rgba(16,185,129,0.28)',
        background: 'rgba(16,185,129,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#e8f0f8', fontSize: 16, fontWeight: 600 }}>Mon affiche du jour ⚽🔍</div>
          <div style={{ color: '#9fb3c8', fontSize: 13, marginTop: 2 }}>
            {resume}
            {etat.serie && etat.serie > 1 ? ` · 🔥 ${etat.serie} jours d’affilée` : ''}
            {etat.analysesDuMois ? ` · ${etat.analysesDuMois} ce mois-ci` : ''}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            color: '#10b981',
            border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: 999,
            padding: '3px 10px',
          }}
        >
          essai privé
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => partager('story')}
          disabled={enCours !== null}
          style={{
            flex: '1 1 220px',
            padding: '12px 16px',
            borderRadius: 12,
            border: 'none',
            background: enCours ? '#0f3d30' : 'linear-gradient(135deg,#10b981,#059669)',
            color: '#04110c',
            fontSize: 15,
            fontWeight: 700,
            cursor: enCours ? 'wait' : 'pointer',
          }}
        >
          {enCours === 'story' ? 'Création…' : 'Partager mon affiche du jour'}
        </button>
        <button
          type="button"
          onClick={() => partager('carre')}
          disabled={enCours !== null}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'transparent',
            color: '#e8f0f8',
            fontSize: 14,
            cursor: enCours ? 'wait' : 'pointer',
          }}
        >
          {enCours === 'carre' ? 'Création…' : 'Format carré'}
        </button>
        <button
          type="button"
          onClick={copierLeLien}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'transparent',
            color: '#9fb3c8',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Copier le lien
        </button>
      </div>

      {message ? <div style={{ marginTop: 10, color: '#9fb3c8', fontSize: 13 }}>{message}</div> : null}

      {apercu ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={apercu}
          alt="Aperçu de mon affiche du jour"
          style={{ marginTop: 14, width: '100%', maxWidth: 300, borderRadius: 14, display: 'block' }}
        />
      ) : null}
    </section>
  );
}
