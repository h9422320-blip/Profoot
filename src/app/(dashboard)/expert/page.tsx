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
      <div className="flex items-center justify-center min-h-[75vh] animate-fade-in px-4">
        <div className="max-w-2xl w-full relative">
          {/* ── LE HALO NE CLIGNOTE PLUS ──────────────────────────────────
              Il portait `animate-pulse` sur une surface de 120 % floutée à
              cent pixels. Une grande zone floue repeinte en boucle est ce qui
              coûte le plus cher sur un téléphone d'entrée de gamme, et 96 %
              du trafic en est un. Le halo reste — il cesse de se rafraîchir. */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-r from-[#10B981]/20 to-blue-500/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="bg-[#16242e]/70 backdrop-blur-3xl border border-white/[0.08] rounded-[32px] p-6 sm:p-9 md:p-11 text-center shadow-[0_0_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
            {/* Liseré lumineux en haut de carte : c'est lui qui donne l'arête
                de verre. */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#10B981]/60 to-transparent" />

            {/* ── LE BADGE ───────────────────────────────────────────────── */}
            <div className="relative z-10 inline-flex items-center gap-1.5 px-3 py-1 mb-5 rounded-full bg-[#10B981]/10 border border-[#10B981]/25 text-[#34D399] text-[9.5px] font-black uppercase tracking-[0.15em]">
              <Sparkles className="w-3 h-3" />
              Premium
            </div>

            {/* ── L'EMBLÈME ──────────────────────────────────────────────────
                L'anneau est un dégradé, pas une bordure : un `border` ne sait
                pas dégrader. On enveloppe donc le disque dans un cercle d'un
                pixel et demi rempli du dégradé — même technique que le cadre
                des cartes de prix. Le halo derrière donne la profondeur. */}
            <div className="relative z-10 mx-auto mb-6 w-fit">
              <div
                aria-hidden
                className="absolute inset-0 -m-3 rounded-full bg-[#10B981]/25 blur-2xl"
              />
              <div className="relative rounded-full p-[1.5px] bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-400 shadow-lg shadow-emerald-500/25">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#16242e] flex items-center justify-center bg-gradient-to-b from-white/[0.06] to-transparent">
                  <Lock
                    className="w-8 h-8 sm:w-10 sm:h-10 text-[#34D399] drop-shadow-[0_0_14px_rgba(52,211,153,0.7)]"
                    strokeWidth={1.75}
                  />
                </div>
              </div>
            </div>

            <h1 className="text-[28px] sm:text-4xl md:text-5xl font-black mb-3 tracking-tight relative z-10 bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent" style={{fontFamily: "var(--police-marque), sans-serif"}}>
              Accès Réservé VIP
            </h1>

            {/* ── LE PAVÉ EST DEVENU UNE PHRASE ────────────────────────────
                Les sept bénéfices étaient empilés en prose sur cinq lignes.
                Personne ne lit ça sur un téléphone : ils descendent dans la
                liste ci-dessous, où l'œil les parcourt en deux secondes. */}
            <p className="text-[13.5px] sm:text-base text-white/55 font-medium leading-relaxed mb-6 max-w-sm mx-auto relative z-10">
              <strong className="text-white font-bold">ProFoot Expert</strong> est votre analyste
              football personnel, réservé aux abonnés.
            </p>

            {/* ── CE QU'ON OBTIENT, EN UN COUP D'ŒIL ─────────────────────── */}
            <ul className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 mb-7 text-left max-w-md mx-auto">
              {[
                'Analyste disponible 24h/24',
                "Connecté à l'actualité en temps réel",
                'Statistiques détaillées',
                'Analyses tactiques',
                'Projections de rencontres',
                'Transferts et mercato',
                'Aucune limite de questions',
              ].map((avantage) => (
                <li key={avantage} className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-[#10B981]/15 text-[#34D399] flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
                  </span>
                  <span className="text-[12.5px] font-semibold text-white/80 leading-tight">{avantage}</span>
                </li>
              ))}
            </ul>

            {/* ── L'APERÇU VERROUILLÉ ────────────────────────────────────────
                Montrer ce qu'on n'a pas donne davantage envie que le décrire.
                Ces trois bulles sont DÉCORATIVES : `aria-hidden` les retire
                des lecteurs d'écran, qui ne doivent pas lire une conversation
                qui n'a jamais eu lieu. Leur texte respecte le vocabulaire de
                l'analyse et ne promet aucun résultat.
                Le flou est appliqué au texte lui-même, pas à un calque
                par-dessus : on ne peut donc pas le retirer en inspectant la
                page — il n'y a rien à révéler, ce contenu est faux. */}
            <div aria-hidden className="relative z-10 mb-7 rounded-[20px] overflow-hidden border border-white/[0.07] bg-black/25">
              <div className="p-4 space-y-2.5 blur-[3px] select-none pointer-events-none">
                <div className="flex justify-end">
                  <span className="max-w-[75%] rounded-2xl rounded-br-md bg-[#10B981]/80 px-3 py-2 text-[11.5px] font-semibold text-black text-left">
                    Comment se présente Manchester City ce week-end ?
                  </span>
                </div>
                <div className="flex justify-start">
                  <span className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2 text-[11.5px] text-white/85 text-left">
                    City reste sur cinq victoires de rang, quinze buts marqués et trois encaissés.
                    Haaland a retrouvé son rythme après sa gêne musculaire.
                  </span>
                </div>
                <div className="flex justify-start">
                  <span className="max-w-[70%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2 text-[11.5px] text-white/85 text-left">
                    Rodri a repris une place de titulaire, ce qui change tout au milieu.
                  </span>
                </div>
              </div>

              {/* Le voile de verre et son cadenas */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#16242e]/40 via-[#16242e]/60 to-[#16242e]/85 backdrop-blur-[2px]">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/75">
                  <Lock className="w-3 h-3 text-[#34D399]" strokeWidth={2.5} />
                  Aperçu verrouillé
                </span>
              </div>
            </div>

            <div className="relative z-10 w-full sm:w-auto mx-auto mt-4 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#10B981] to-[#047857] rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500" />
              <button 
                onClick={handleSubscribe} 
                disabled={loadingCheckout}
                className="relative w-full bg-gradient-to-r from-[#10B981] to-[#059669] text-black font-black px-6 sm:px-10 py-4 sm:py-5 rounded-full flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 transition-transform duration-300 group-hover:scale-[1.02] border border-[#34D399]/50 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingCheckout ? (
                   <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                ) : (
                  <>
                    <span className="text-base sm:text-lg">Débloquer l'Accès VIP</span>
                    <div className="flex items-center">
                      <span className="bg-black/10 px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                        {offreVip
                          ? `dès ${offreVip.prixXof.toLocaleString("fr-FR")} FCFA${offreVip.dureeJours >= 365 ? "/an" : "/mois"}`
                          : "Voir les offres"}
                      </span>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5" />
                    </div>
                  </>
                )}
              </button>
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
