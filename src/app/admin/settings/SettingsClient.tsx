"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Loader2, CheckCircle2, AlertTriangle, Wrench, ShieldCheck,
  XCircle, Info, Eye,
} from "lucide-react";
import { enregistrerReglages } from "./actions";
import type { AppSettings } from "@/lib/app-settings";
import { dateHeure } from "../_components/Ui";

type Service = { nom: string; actif: boolean; detail: string };

export default function SettingsClient({
  reglages,
  services,
}: {
  reglages: AppSettings;
  services: Service[];
}) {
  const [appName, setAppName] = useState(reglages.appName);
  const [contactEmail, setContactEmail] = useState(reglages.contactEmail);
  const [maintenance, setMaintenance] = useState(reglages.maintenance);
  const [message, setMessage] = useState(reglages.maintenanceMessage);
  // Une ligne par club. Saisie libre, volontairement : ajouter un club ne doit
  // pas demander un deploiement.
  const [clubs, setClubs] = useState(reglages.grandsClubs.join("\n"));

  const [confirmation, setConfirmation] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const modifie =
    appName !== reglages.appName ||
    contactEmail !== reglages.contactEmail ||
    maintenance !== reglages.maintenance ||
    message !== reglages.maintenanceMessage ||
    clubs !== reglages.grandsClubs.join("\n");

  function soumettre() {
    // Activer la maintenance coupe le site pour tous les visiteurs : cette
    // action passe obligatoirement par une confirmation explicite.
    if (maintenance && !reglages.maintenance && !confirmation) {
      setConfirmation(true);
      return;
    }
    setConfirmation(false);
    setRetour(null);

    const donnees = new FormData();
    donnees.set("appName", appName);
    donnees.set("contactEmail", contactEmail);
    if (maintenance) donnees.set("maintenance", "on");
    donnees.set("maintenanceMessage", message);
    donnees.set("grandsClubs", clubs);

    demarrer(async () => {
      const r = await enregistrerReglages(donnees);
      setRetour(
        r.ok
          ? {
              ok: true,
              texte: r.maintenance
                ? "Enregistré. Le site est maintenant en maintenance pour vos visiteurs."
                : "Enregistré. Le site est accessible normalement.",
            }
          : { ok: false, texte: r.erreur }
      );
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Paramètres</h1>
        <p className="text-sm text-white/40 mt-1">
          Configuration réelle de l'application — chaque réglage est enregistré en base
        </p>
      </div>

      <AnimatePresence>
        {retour && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-[16px] p-4 flex items-start gap-3 border ${
              retour.ok
                ? "bg-[#10b981]/10 border-[#10b981]/25"
                : "bg-red-500/10 border-red-500/25"
            }`}
          >
            {retour.ok ? (
              <CheckCircle2 className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${retour.ok ? "text-[#10b981]" : "text-red-200"}`}>{retour.texte}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bandeau d'état quand la maintenance est déjà active */}
      {reglages.maintenance && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-[16px] p-4 flex items-start gap-3">
          <Wrench className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-200">Le site est actuellement en maintenance</p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Vos visiteurs voient la page de maintenance. Vous seul gardez l'accès complet.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2e4757]">
              <h3 className="font-bold text-white text-sm">Configuration générale</h3>
            </div>

            <div className="p-5 space-y-5">
              <label className="block space-y-2">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
                  Nom de l'application
                </span>
                <input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-[#1d2f3a] border border-[#2e4757] rounded-[14px] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
                <span className="block text-[11px] text-white/30">
                  Affiché sur la page de maintenance.
                </span>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
                  E-mail de contact
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-[#1d2f3a] border border-[#2e4757] rounded-[14px] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
                <span className="block text-[11px] text-white/30">
                  Adresse proposée à vos visiteurs pendant une maintenance.
                </span>
              </label>
            </div>
          </div>

          <div className="bg-[#16242e] border border-amber-500/25 rounded-[20px] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2e4757] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-sm">Mode maintenance</h3>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">Couper l'accès au site</p>
                  <p className="text-[11px] text-white/40 mt-1 leading-relaxed max-w-md">
                    Tous vos visiteurs verront la page de maintenance. Vous gardez l'accès complet,
                    et les paiements continuent d'être encaissés et activés normalement.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={maintenance}
                  onClick={() => { setMaintenance(!maintenance); setConfirmation(false); }}
                  className={`w-14 h-7 rounded-full relative shrink-0 transition-colors ${
                    maintenance ? "bg-amber-500" : "bg-white/10"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow ${
                      maintenance ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
                  Message affiché
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-[#1d2f3a] border border-[#2e4757] rounded-[14px] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors resize-none"
                />
              </label>

              <a
                href="/maintenance"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Prévisualiser la page de maintenance
              </a>
            </div>
          </div>

          {/* ── Les affiches qui remontent en tête du mur de preuves ──────────
              Un visiteur ne lit pas dix cartes : il en regarde deux. Si ces
              deux-là opposent des clubs qu'il ne connaît pas, il referme la
              page sans avoir vu que l'outil a aussi vu juste sur Barcelone ou
              le Real. */}
          <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-sm font-black text-white">Grands clubs du mur de preuves</h2>
              <p className="text-xs text-white/40 mt-1 leading-relaxed">
                Toute preuve impliquant un de ces clubs passe en haut de la page d&apos;analyse.
                Une ligne par club. Rien n&apos;est masqué : les autres réussites restent, plus bas.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
                Un club par ligne
              </span>
              <textarea
                value={clubs}
                onChange={(e) => setClubs(e.target.value)}
                rows={8}
                spellCheck={false}
                className="w-full bg-[#1d2f3a] border border-[#2e4757] rounded-[14px] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors resize-y font-mono"
              />
            </label>

            <p className="text-[11px] text-white/30 leading-relaxed">
              Écrivez un fragment du nom, en minuscules : « barcelon » attrape aussi bien
              « FC Barcelone » que « Barcelona ». Videz le champ pour revenir à la liste d&apos;origine.
            </p>
          </div>

          <AnimatePresence>
            {confirmation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-[16px] p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-100">
                        Confirmez la coupure du site
                      </p>
                      <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                        Vos visiteurs ne pourront plus lancer d'analyses ni s'abonner tant que la
                        maintenance sera active. Vous pourrez la désactiver depuis cette page.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={soumettre}
                      className="px-4 py-2 rounded-[14px] bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors"
                    >
                      Oui, activer la maintenance
                    </button>
                    <button
                      onClick={() => { setConfirmation(false); setMaintenance(false); }}
                      className="px-4 py-2 rounded-[14px] border border-white/15 text-white/70 font-bold text-sm hover:bg-white/5 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4">
            <button
              onClick={soumettre}
              disabled={!modifie || enCours}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#10b981] hover:bg-[#34d399] text-black font-bold rounded-[16px] text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {enCours ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
            {modifie && !enCours && (
              <span className="text-xs text-white/40">Modifications non enregistrées</span>
            )}
          </div>

          {reglages.updatedAt && (
            <p className="text-[11px] text-white/25">
              Dernière modification : {dateHeure(reglages.updatedAt)}
              {reglages.updatedBy ? ` par ${reglages.updatedBy}` : ""}
            </p>
          )}
        </div>

        {/* État des services */}
        <div className="space-y-6">
          <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2e4757] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#10b981]" />
              <h3 className="font-bold text-white text-sm">État des services</h3>
            </div>

            <div className="divide-y divide-[#2e4757]/50">
              {services.map((s, i) => (
                <motion.div
                  key={s.nom}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-5 py-3.5 flex items-start gap-3"
                >
                  {s.actif ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white leading-tight">{s.nom}</p>
                    <p className="text-[11px] text-white/35 mt-0.5">{s.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] p-5">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
              <p className="text-xs text-white/45 leading-relaxed">
                Cet état est déduit de la configuration réellement chargée par le serveur.
                Une ligne rouge signifie qu'une variable d'environnement manque sur Vercel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
