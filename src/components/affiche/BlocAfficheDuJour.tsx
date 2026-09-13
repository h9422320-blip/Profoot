'use client';

import { useEffect, useState } from 'react';
import { Share2, Image as ImageIcon, Link2, ChevronRight } from 'lucide-react';

/**
 * « MON AFFICHE DU JOUR » — LE BLOC DE LA PAGE MON PROFIL.
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
 * ── L'HABILLAGE EST CELUI DE CETTE PAGE, PAS UN AUTRE ───────────────────
 *
 * Première version refusée : elle empruntait les classes de la page Réglages
 * (`bg-card`, `rounded-[28px]`, `text-foreground`). Posée dans « Mon Profil »,
 * qui a son propre habillage — fond `#1d2f3a`, coins de 32, tuiles blanches à
 * 5 %, texte blanc —, elle faisait corps étranger.
 *
 * Ici, tout est repris de la carte de profil juste en dessous : même fond,
 * mêmes coins, même tuile d'icône en dégradé vert, mêmes rangées d'action avec
 * chevron. Le bloc doit avoir l'air d'avoir toujours été là.
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

export default function BlocAfficheDuJour() {
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
  useEffect(
    () => () => {
      if (apercu) URL.revokeObjectURL(apercu);
    },
    [apercu]
  );

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
      // `canShare` demandé AVANT : tous les navigateurs n'acceptent pas le
      // partage de fichiers, et un écran ne doit jamais rester bloqué parce
      // qu'une interface manque.
      if (partageur.share && partageur.canShare?.({ files: [fichier] })) {
        await partageur.share({
          files: [fichier],
          title: 'Mon affiche du jour — ProFoot AI',
          text: 'Mon activité d’analyse du jour avec ProFoot AI — profootai.com',
        });
        return;
      }

      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(fichier);
      lien.download = nomFichier;
      lien.click();
      URL.revokeObjectURL(lien.href);
      setMessage('Affiche enregistrée dans vos images — partagez-la depuis votre galerie.');
    } catch (e: any) {
      // Un partage annulé par la personne n'est pas une erreur.
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

  return (
    <div className="bg-[#1d2f3a]/80 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-2xl">
      {/* En-tête : même tuile en dégradé vert que la carte de profil. */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-6">
        {/* La lueur est posée en style direct : une classe d'ombre arbitraire
            contenant des virgules — `shadow-[0_0_20px_rgba(...)]` — ne génère
            rien chez Tailwind, un piège déjà rencontré sur ce projet. */}
        <div
          className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#10B981] to-[#059669] text-white flex items-center justify-center shrink-0"
          style={{ boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}
        >
          <Share2 className="w-7 h-7" />
        </div>
        {/* Le titre a sa ligne entière : à côté du badge, il sortait tronqué
            en « Mon affi… » sur un écran de téléphone. */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight">Mon affiche du jour</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-[#10B981]/20 text-[#10B981] text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 border border-[#10B981]/20">
              Essai privé
            </span>
            <span className="text-[11px] text-white/50 whitespace-nowrap">pour votre statut</span>
          </div>
        </div>
      </div>

      {/* Deux tuiles de chiffres, comme celles du profil. Libellés COURTS :
          sur 375 pixels de large, « matchs analysés aujourd'hui » partait sur
          deux lignes et cassait l'alignement des deux tuiles. */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 border border-white/5 rounded-[20px] p-4 text-center">
          <span className="text-2xl font-black text-white">{n}</span>
          <p className="text-[11px] text-white/50 font-medium mt-1 uppercase tracking-wider">aujourd’hui</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-[20px] p-4 text-center">
          <span className="text-2xl font-black text-white">{etat.analysesDuMois ?? 0}</span>
          <p className="text-[11px] text-white/50 font-medium mt-1 uppercase tracking-wider">ce mois-ci</p>
        </div>
      </div>

      {/* Les actions, en rangées — l'idiome de cette page. */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => partager('story')}
          disabled={enCours !== null}
          className="w-full flex items-center justify-between p-4 bg-[#10B981]/10 hover:bg-[#10B981]/20 disabled:opacity-60 rounded-[20px] transition-colors border border-[#10B981]/20 group"
        >
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-[#10B981] group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold text-[#10B981] whitespace-nowrap">
              {enCours === 'story' ? 'Création…' : 'Partager mon affiche'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#10B981]/50" />
        </button>

        <button
          type="button"
          onClick={() => partager('carre')}
          disabled={enCours !== null}
          className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 disabled:opacity-60 rounded-[20px] transition-colors border border-white/5 group"
        >
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
            <span className="text-sm font-bold text-white whitespace-nowrap">
              {enCours === 'carre' ? 'Création…' : 'Version carrée'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </button>

        <button
          type="button"
          onClick={copierLeLien}
          className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-[20px] transition-colors border border-white/5 group"
        >
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
            <span className="text-sm font-bold text-white whitespace-nowrap">Copier le lien</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </button>
      </div>

      {message ? <p className="mt-4 text-xs text-white/50 text-center">{message}</p> : null}

      {apercu ? (
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={apercu}
            alt="Aperçu de mon affiche du jour"
            className="w-full max-w-[220px] rounded-[20px] border border-white/10 shadow-2xl"
          />
        </div>
      ) : null}
    </div>
  );
}
