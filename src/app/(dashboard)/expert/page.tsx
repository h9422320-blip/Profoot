"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, Send, Loader, Sparkles, Lock, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Email du propriétaire - accès gratuit pour les tests
const OWNER_EMAIL = "kuzmabah@gmail.com";

// Render message content with basic markdown-like formatting
function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const colorClass = isUser ? "text-black" : "text-white/90";
  const lines = content.split("\n");

  return (
    <div className={`text-[14.5px] leading-[1.75] font-medium ${colorClass}`} style={{fontFamily: "'Inter', sans-serif"}}>
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
      content: "Bienvenue dans votre espace VIP 👋\n\nJe suis **ProFoot Expert**, votre analyste football IA personnel. Je suis connecté en temps réel à l'actualité du football.\n\nPosez-moi n'importe quelle question : statistiques d'un joueur, analyse tactique, pronostic de match, transferts, résultats en direct...\n\n⚽ Par quoi voulez-vous commencer ?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("@/utils/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email);
      });
    });

    fetch('/api/payments/moneroo/status')
      .then(res => res.json())
      .then(data => setIsPro(data.isPro))
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
          body: JSON.stringify({ messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) })
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
  const isOwner = userEmail === OWNER_EMAIL;
  const hasAccess = isOwner || isPro;

  if (isPro === null && !isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 animate-fade-in">
        <div className="bg-[#111A24]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background/0 to-background/0 pointer-events-none" />
          <div className="w-20 h-20 rounded-full bg-black/40 border border-white/5 flex items-center justify-center mx-auto mb-8 shadow-inner relative z-10">
            <Lock className="w-8 h-8 text-[#10B981]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight relative z-10" style={{fontFamily:"'Outfit',sans-serif"}}>
            Accès Réservé VIP
          </h1>
          <p className="text-sm md:text-base text-white/70 font-semibold leading-relaxed mb-10 max-w-md mx-auto relative z-10">
            L'Agent IA ProFoot Expert est exclusivement réservé aux membres possédant un abonnement annuel. Débloquez-le pour poser vos questions en illimité.
          </p>
          <Link href="/pricing" className="inline-flex relative z-10">
            <button className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#34D399] hover:to-[#10B981] text-black font-black px-8 py-4 rounded-full flex items-center gap-3 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <span>Devenir Membre VIP (60 000 FCFA/an)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-[#0D1520]/80 backdrop-blur-xl border border-white/[0.06] rounded-[28px] shadow-2xl overflow-hidden animate-fade-in">

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] bg-black/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl overflow-hidden bg-[#0A1118] border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Image src="/logo.png" alt="ProFoot AI" width={44} height={44} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-1.5" style={{fontFamily:"'Outfit',sans-serif"}}>
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
              <div className="w-7 h-7 rounded-xl overflow-hidden bg-[#0A1118] border border-primary/20 flex items-center justify-center shrink-0 mb-0.5">
                <Image src="/logo.png" alt="AI" width={28} height={28} className="w-full h-full object-contain" />
              </div>
            )}

            <div className={`max-w-[85%] md:max-w-[78%] rounded-[20px] px-5 py-4 ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-[#10B981] to-[#059669] rounded-br-sm shadow-[0_4px_20px_rgba(16,185,129,0.25)]'
                : 'bg-[#111A24]/90 border border-white/[0.07] rounded-bl-sm shadow-lg'
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
            <div className="w-7 h-7 rounded-xl overflow-hidden bg-[#0A1118] border border-primary/20 flex items-center justify-center shrink-0">
              <Image src="/logo.png" alt="AI" width={28} height={28} className="w-full h-full object-contain" />
            </div>
            <div className="rounded-[20px] rounded-bl-sm px-5 py-4 bg-[#111A24]/90 border border-white/[0.07] flex items-center gap-3">
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
            className="w-full bg-[#0D1520] border border-white/[0.08] rounded-2xl py-3.5 pl-5 pr-14 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30 transition-all font-medium"
            style={{fontFamily: "'Inter', sans-serif"}}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#059669] text-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:from-[#34D399] hover:to-primary transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:scale-105"
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
