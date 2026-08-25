"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, Send, Loader, Sparkles, Lock, ArrowRight, Zap, Loader2, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { fuseauDuNavigateur } from "@/lib/pays-acheteur";
import dynamic from "next/dynamic";
import { usePaysAcheteur } from "@/components/usePaysAcheteur";

/** Chargee a la demande : voir la note dans la page des tarifs. */
const NoticePaiement = dynamic(() => import("@/components/NoticePaiement"), { ssr: false });

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Emails des propriétaires - accès gratuit pour les tests
const OWNER_EMAILS = ["h9422320@gmail.com", "abdoulayecamara2708@gmail.com"];

// Render message content with basic markdown-like formatting
function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const colorClass = isUser ? "text-black" : "text-white/90";
  const lines = content.split("\n");

  return (
    <div className={`text-[14.5px] leading-[1.75] font-medium ${colorClass}`} style={{fontFamily: "var(--police-texte), sans-serif"}}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        // Bold text: **text**
        const boldProcessed = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} className={`font-bold ${isUser ? 'text-black' : 'text-white'}`}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
        const isNumbered = /^\d+\./.test(line.trim());
        const isHeader = line.trim().startsWith("#") || line.trim().startsWith("━");

        if (isHeader) {
          return (
            <p key={i} className={`font-black text-xs uppercase tracking-widest mt-3 mb-1 ${isUser ? 'text-black/70' : 'text-primary/80'}`}>
              {line.replace(/^#+\s*/, "").replace(/━+/g, "").trim()}
            </p>
          );
        }

        if (isBullet || isNumbered) {
          return (
            <div key={i} className="flex items-start gap-2 my-0.5">
              <span className={`mt-[6px] w-1.5 h-1.5 rounded-full shrink-0 ${isUser ? 'bg-black/40' : 'bg-primary'}`} />
              <span>{boldProcessed}</span>
            </div>
          );
        }

        return <p key={i} className="my-0.5">{boldProcessed}</p>;
      })}
    </div>
  );
}

export default function ExpertAgentPage() {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Bienvenue dans votre espace VIP 👋\n\nJe suis **ProFoot Expert**, votre analyste football IA personnel. Je suis connecté en temps réel à l'actualité du football.\n\nPosez-moi n'importe quelle question : statistiques d'un joueur, analyse tactique, projection de match, transferts, résultats en direct...\n\n⚽ Par quoi voulez-vous commencer ?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  /** Vrai quand la notice de paiement est ouverte. */
  const [noticeOuverte, setNoticeOuverte] = useState(false);
  const paysDetecte = usePaysAcheteur(noticeOuverte);
  // L'offre la moins chère qui ouvre l'Agent VIP, telle que réglée dans
  // l'administration. Le serveur la désigne ; cette page se contente de
  // l'afficher.
  const [offreVip, setOffreVip] = useState<{
    cle: string;
    libelle: string;
    prixXof: number;
    dureeJours: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("@/utils/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email);
      });
    });

    // L'accès à l'Agent VIP se lit sur le droit "vip", jamais sur le nom de
    // l'offre : les trois offres l'ouvrent désormais, et ce droit est le seul
    // à suivre le réglage de l'administration.
    fetch('/api/payments/status')
      .then(res => res.json())
      .then(data => {
        setIsPro(!!data.vip);
        if (data.offreVip) setOffreVip(data.offreVip);
      })
      .catch(() => setIsPro(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let attempt = 0;
    const maxAttempts = 3;
    let success = false;

    while (attempt < maxAttempts && !success) {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages.map(m => ({ role: m.role, content: m.content })), fuseau: fuseauDuNavigateur() })
        });

        if (!res.ok) {
          // Si c'est une erreur 429 (Rate Limit) ou 500, on déclenche le catch pour réessayer
          throw new Error(`HTTP Error ${res.status}`);
        }

        const data = await res.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.text || "Désolé, je n'ai pas pu générer de réponse."
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        success = true;
      } catch (error) {
        attempt++;
        console.warn(`Tentative ${attempt}/${maxAttempts} échouée pour l'IA...`);
        
        if (attempt >= maxAttempts) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "⚠️ Le réseau semble instable ou l'IA est surchargée. J'ai essayé de me reconnecter mais sans succès. Merci de patienter quelques secondes avant de relancer votre question."
          }]);
        } else {
          // Attente intelligente (backoff) : 3s, puis 5s
          const delay = attempt === 1 ? 3000 : 5000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    setIsLoading(false);
  };

  // Le propriétaire a toujours accès gratuitement
  const isOwner = userEmail && OWNER_EMAILS.includes(userEmail);
  const hasAccess = isOwner || isPro;

  if (isPro === null && !isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Le clic ouvre la notice ; le paiement part ensuite, inchange.
  const handleSubscribe = () => setNoticeOuverte(true);

  const lancerPaiement = async (paysChoisi: string | null) => {
    setNoticeOuverte(false);
    try {
      setLoadingCheckout(true);
      const res = await fetch('/api/payments/chariow/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // On envoie vers l'offre la moins chère qui ouvre l'Agent VIP, telle
        // que réglée dans l'administration — pas vers l'annuel par défaut.
        body: JSON.stringify({
          plan: offreVip?.cle ?? 'yearly',
          fuseau: fuseauDuNavigateur(),
          // Renseigne uniquement si l acheteur a corrige son pays.
          ...(paysChoisi ? { pays: paysChoisi } : {}),
        })
      });
      
      const data = await res.json();
      
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Une erreur est survenue lors de l'initialisation du paiement.");
        setLoadingCheckout(false);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion au serveur de paiement.");
      setLoadingCheckout(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex items-start justify-center pt-6 sm:pt-10 pb-6 animate-fade-in px-4">
        {/* ── POURQUOI CET ÉCRAN A ÉTÉ REPRIS UNE TROISIÈME FOIS ────────────
            Reproche du propriétaire, deux fois : « on sent que c'est fait par
            l'IA ». Ce n'est pas un jugement vague — ce sont des traits
            identifiables, et ils étaient tous là :

              — TOUT ÉTAIT CENTRÉ. Emblème, pastille, titre, phrase : une
                colonne parfaitement symétrique. C'est la signature n°1 d'une
                interface générée. Un designer aligne à gauche et laisse
                l'asymétrie porter la composition ;

              — LE SQUELETTE ÉTAIT LE GABARIT PAR DÉFAUT : pastille, grosse
                icône ronde, titre, sous-titre, liste à coches, bouton. Tout
                le monde reconnaît ce patron ;

              — CINQ EFFETS EMPILÉS : cadre dégradé, halo, reflet, texte en
                dégradé, lueur portée. Un designer en choisit un. En mettre
                cinq, c'est précisément ce qui fait « machine » ;

              — UNE PASTILLE « PREMIUM » AVEC DES ÉTINCELLES. Le cliché.

            Ici : alignement à gauche, UN SEUL effet décoratif — un liseré
            blanc qui s'éteint vers le bas — et la hiérarchie portée par la
            typographie, pas par la décoration. Le cadenas devient une petite
            marque en haut, pas un médaillon. */}
        <div className="w-full max-w-[340px] relative">
          <div className="rounded-[21px] p-[1px] bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent">
            <div className="bg-card rounded-[20px] p-6">
              {/* ── L'EN-TÊTE : UNE LIGNE, PAS UN MÉDAILLON ────────────────
                  Un emblème de soixante-quatre pixels centré annonce une page
                  d'erreur ; une marque discrète en haut à gauche annonce un
                  produit. */}
              <div className="flex items-center gap-2 mb-7">
                <span className="w-7 h-7 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <Lock className="w-3.5 h-3.5 text-[#34D399]" strokeWidth={2.25} />
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  Réservé aux abonnés
                </span>
              </div>

              {/* Le titre porte seul la hiérarchie : grand, serré, à gauche,
                  en blanc franc. Pas de dégradé sur le texte — c'est joli une
                  fois, et ça affaiblit le contraste. */}
              <h1
                className="text-[30px] leading-[1.05] font-black tracking-[-0.02em] text-white mb-3"
                style={{ fontFamily: 'var(--police-marque), sans-serif' }}
              >
                Votre analyste
                <br />
                football, à part.
              </h1>

              <p className="text-[13px] leading-relaxed text-white/45 mb-6">
                <strong className="text-white/75 font-semibold">ProFoot Expert</strong> répond à
                vos questions sur le football, à toute heure, en s&apos;appuyant sur les données
                réelles et l&apos;actualité du jour.
              </p>

              {/* ── TROIS LIGNES, SANS COCHES ─────────────────────────────
                  La liste à coches vertes est le marqueur visuel du gabarit de
                  vente. Trois lignes séparées par un filet se lisent aussi
                  vite et ne ressemblent à rien de généré. */}
              <div className="border-t border-white/[0.06] mb-6">
                {[
                  ['24h/24', 'Disponible à toute heure, sans limite de questions'],
                  ['En direct', "Connecté à l'actualité et aux résultats du jour"],
                  ['Complet', 'Statistiques, tactique, projections, transferts'],
                ].map(([titre, detail]) => (
                  <div key={titre} className="flex gap-3 py-2.5 border-b border-white/[0.06]">
                    <span className="text-[11px] font-black text-[#34D399] w-[54px] shrink-0 pt-px">
                      {titre}
                    </span>
                    <span className="text-[12px] text-white/55 leading-snug">{detail}</span>
                  </div>
                ))}
              </div>

              {/* ── LE BOUTON ÉTAIT L'ÉLÉMENT CASSÉ ─────────────────────────
                  Vu sur capture : « Débloquer l'Accès VIP » passait sur deux
                  lignes, la pastille du prix se trouvait comprimée à côté et
                  la flèche flottait. Trois informations entassées dans une
                  barre de trois cent quarante pixels de large.

                  Le libellé est raccourci et tient sur une ligne ; le prix
                  descend SOUS le bouton, en gris, avec la mention qui rassure.
                  Un bouton ne porte qu'une seule idée : l'action.

                  ── ET IL A PERDU SON DÉGRADÉ ─────────────────────────────
                  J'y avais collé le dégradé cyan-vert des cartes de tarifs
                  sans me demander s'il allait avec cet écran-ci. Il ne va pas :
                  la carte est sombre et retenue, le bouton hurlait. Un vert
                  plein, sans dégradé ni lueur, tient la même promesse sans
                  casser le calme de la composition. */}
              <button
                onClick={handleSubscribe}
                disabled={loadingCheckout}
                className="w-full min-h-[50px] bg-[#10B981] hover:bg-[#0ea472] text-[#04231c] font-black text-[14px] px-4 rounded-[14px] flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingCheckout ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Débloquer l&apos;accès
                    <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                  </>
                )}
              </button>

              {/* Le prix vit ici, lisible, sans encombrer l'action. Toujours
                  lu depuis le réglage de l'administration. */}
              <p className="mt-2.5 text-center text-[11.5px] text-white/35 font-medium">
                {offreVip
                  ? `dès ${offreVip.prixXof.toLocaleString('fr-FR')} FCFA${
                      offreVip.dureeJours >= 365 ? ' par an' : ' par mois'
                    } · sans engagement`
                  : 'Voir les offres disponibles'}
              </p>
              </div>
            </div>
          </div>

        {/* La notice n'existe QUE pendant le clic sur l'abonnement. Hors de ce
            moment, elle n'est pas montée : rien à charger pour qui ne paie pas. */}
        {noticeOuverte && (
          <NoticePaiement
            paysDetecte={paysDetecte}
            libelleOffre={`Agent VIP — ${(offreVip?.prixXof ?? 15000).toLocaleString('fr-FR')} FCFA${
              (offreVip?.dureeJours ?? 365) >= 365 ? ' / an' : ' / mois'
            }`}
            onContinuer={(paysRetenu) => lancerPaiement(paysRetenu)}
            onFermer={() => setNoticeOuverte(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-[#18272f]/80 backdrop-blur-xl border border-white/[0.06] rounded-[28px] shadow-2xl overflow-hidden animate-fade-in">

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] bg-black/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Image src="/logo.png" alt="ProFoot AI" width={44} height={44} className="w-full h-full object-cover scale-[1.35]" />
          </div>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-1.5" style={{fontFamily: "var(--police-marque), sans-serif"}}>
              ProFoot <span className="text-primary">Expert</span>
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 ml-0.5" />
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <p className="text-[10px] uppercase tracking-widest text-primary/80 font-black">Agent IA VIP · En ligne</p>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
          <Zap className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Recherche en temps réel</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>

            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 mb-0.5">
                <Image src="/logo.png" alt="AI" width={28} height={28} className="w-full h-full object-cover scale-[1.35]" />
              </div>
            )}

            <div className={`max-w-[85%] md:max-w-[78%] rounded-[20px] px-5 py-4 ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-[#10B981] to-[#059669] rounded-br-sm shadow-[0_4px_20px_rgba(16,185,129,0.25)]'
                : 'bg-[#1d2f3a]/90 border border-white/[0.07] rounded-bl-sm shadow-lg'
            }`}>
              {m.role === 'assistant' && m.id !== 'welcome' && (
                <div className="flex items-center gap-1.5 mb-2.5 pb-2.5 border-b border-white/[0.07]">
                  <Shield className="w-3 h-3 text-primary" />
                  <span className="text-[9px] uppercase tracking-[0.12em] text-white/35 font-black">ProFoot Expert</span>
                </div>
              )}
              <MessageContent content={m.content} isUser={m.role === 'user'} />
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start items-end gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0">
              <Image src="/logo.png" alt="AI" width={28} height={28} className="w-full h-full object-cover scale-[1.35]" />
            </div>
            <div className="rounded-[20px] rounded-bl-sm px-5 py-4 bg-[#1d2f3a]/90 border border-white/[0.07] flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{animationDelay: '0ms'}} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{animationDelay: '150ms'}} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{animationDelay: '300ms'}} />
              </div>
              <span className="text-xs font-semibold text-white/40">Analyse en cours...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-black/40 border-t border-white/[0.06] shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Posez votre question sur le football..."
            className="w-full bg-[#18272f] border border-white/[0.08] rounded-[20px] py-3.5 pl-5 pr-14 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30 transition-all font-medium"
            style={{fontFamily: "var(--police-texte), sans-serif"}}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 w-10 h-10 rounded-[16px] bg-gradient-to-br from-primary to-[#059669] text-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:from-[#34D399] hover:to-primary transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:scale-105"
          >
            <Send className="w-4 h-4 translate-x-px" />
          </button>
        </form>
        <p className="text-center text-[10px] text-white/20 font-medium mt-2.5 tracking-wide">
          ProFoot Expert · Connecté en temps réel · Réservé aux membres VIP
        </p>
      </div>
    </div>
  );
}
