"use client";

import { useState, useTransition } from "react";
import { Save, Upload, Eye, EyeOff, UserPlus } from "lucide-react";
import { enregistrerAmbassadeur, basculerAmbassadeur } from "./actions";
import type { Ambassadeur } from "@/lib/ambassadeurs";

/**
 * Réglage des ambassadeurs.
 *
 * Chaque ambassadeur a son propre formulaire : un formulaire unique pour toute
 * la liste ferait renvoyer toutes les photos à chaque enregistrement, sur des
 * connexions mobiles où cinq mégaoctets se paient cher.
 */
export default function AmbassadeursClient({ ambassadeurs }: { ambassadeurs: Ambassadeur[] }) {
  const [ajout, setAjout] = useState(false);

  return (
    <div className="space-y-4">
      {ambassadeurs.map((a) => (
        <Fiche key={a.id} ambassadeur={a} />
      ))}

      {ajout ? (
        <Fiche
          ambassadeur={{
            id: "",
            nom: "",
            role: "Ambassadeur ProFoot",
            citation: "",
            photoUrl: null,
            ordre: ambassadeurs.length,
            actif: true,
          }}
          onAnnuler={() => setAjout(false)}
        />
      ) : (
        <button
          onClick={() => setAjout(true)}
          className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-full text-[13px] font-black bg-[#1d2f3a] border border-[#2e4757] text-white hover:border-[#10b981]/50 transition"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un ambassadeur
        </button>
      )}
    </div>
  );
}

function Fiche({
  ambassadeur: a,
  onAnnuler,
}: {
  ambassadeur: Ambassadeur;
  onAnnuler?: () => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [apercu, setApercu] = useState<string | null>(a.photoUrl);
  const nouveau = !a.id;

  return (
    <form
      action={(fd) =>
        demarrer(async () => {
          setMessage(null);
          const r = await enregistrerAmbassadeur(fd);
          setMessage({ ok: r.ok, texte: r.message });
          if (r.ok && nouveau) onAnnuler?.();
        })
      }
      className="rounded-[20px] border border-[#2e4757] bg-[#16242e] p-4 sm:p-5 space-y-4"
    >
      <input type="hidden" name="id" value={a.id} />

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Aperçu au même rapport que la page d'accueil : ce qu'on voit ici est
            ce qui sera publié, cadrage compris. */}
        <div className="w-full sm:w-[150px] shrink-0">
          <div className="relative w-full aspect-[4/5] rounded-[16px] overflow-hidden bg-[#0d1720] border border-[#2e4757]">
            {apercu ? (
              // Aperçu local : `next/image` n'accepte pas une URL temporaire de
              // navigateur.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={apercu} alt="" className="w-full h-full object-cover object-top" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[11px] text-white/25 text-center px-3">
                Aucune photo — l&apos;ambassadeur ne s&apos;affichera pas
              </div>
            )}
          </div>

          <label className="mt-2 flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-[12px] bg-[#1d2f3a] border border-[#2e4757] text-[12px] font-bold text-white/70 hover:border-[#10b981]/50 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            {a.photoUrl ? "Remplacer" : "Choisir une photo"}
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setApercu(URL.createObjectURL(f));
              }}
            />
          </label>
          <p className="text-[10px] text-white/25 mt-1.5 text-center">JPG, PNG ou WEBP · 5 Mo max</p>
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Nom</span>
              <input
                name="nom"
                defaultValue={a.nom}
                required
                className="mt-1 w-full min-h-[48px] px-3.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[15px] font-bold outline-none focus:border-[#10b981]/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Rôle</span>
              <input
                name="role"
                defaultValue={a.role}
                className="mt-1 w-full min-h-[48px] px-3.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[15px] font-bold outline-none focus:border-[#10b981]/60"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              Citation
            </span>
            <textarea
              name="citation"
              defaultValue={a.citation}
              rows={3}
              required
              className="mt-1 w-full px-3.5 py-3 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[14px] leading-relaxed outline-none focus:border-[#10b981]/60 resize-y"
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <label className="block w-24">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Ordre
              </span>
              <input
                type="number"
                name="ordre"
                defaultValue={a.ordre}
                min={0}
                className="mt-1 w-full min-h-[48px] px-3.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757] text-white text-[15px] font-bold outline-none focus:border-[#10b981]/60"
              />
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[44px] mt-5">
              <input
                type="checkbox"
                name="actif"
                defaultChecked={a.actif}
                className="w-4 h-4 accent-[#10b981]"
              />
              <span className="text-[13px] text-white/70">Afficher sur la page d&apos;accueil</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-full text-[13px] font-black bg-[#10b981] hover:bg-[#0ea371] text-[#06231a] transition disabled:opacity-50 disabled:cursor-wait"
        >
          <Save className="w-4 h-4" />
          {enCours ? "Enregistrement…" : nouveau ? "Ajouter" : "Enregistrer"}
        </button>

        {nouveau && (
          <button
            type="button"
            onClick={onAnnuler}
            className="px-4 py-3 min-h-[48px] rounded-full text-[13px] font-bold text-white/50 hover:text-white transition"
          >
            Annuler
          </button>
        )}

        {!nouveau && <BoutonVisibilite id={a.id} actif={a.actif} />}

        {message && (
          <span className={`text-[12px] ${message.ok ? "text-[#10b981]" : "text-rose-400"}`} role="status">
            {message.texte}
          </span>
        )}
      </div>
    </form>
  );
}

/** Masquer ou réafficher, sans rien supprimer. */
function BoutonVisibilite({ id, actif }: { id: string; actif: boolean }) {
  const [enCours, demarrer] = useTransition();

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("actif", String(!actif));
          await basculerAmbassadeur(fd);
        })
      }
      className="inline-flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-full text-[12px] font-bold bg-[#1d2f3a] border border-[#2e4757] text-white/70 hover:text-white transition disabled:opacity-50"
    >
      {actif ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      {actif ? "Masquer" : "Afficher"}
    </button>
  );
}
