"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, Send, Loader, Sparkles, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProFootLogo } from "@/components/ui/ProFootLogo";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Email du propriétaire - accès gratuit pour les tests
const OWNER_EMAIL = "kuzmabah@gmail.com";

export default function ExpertAgentPage() {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Bonjour ! Je suis ProFoot Expert, votre agent VIP privé. Posez-moi toutes vos questions sur le football : statistiques, forme des équipes, actualités ou analyses de joueurs. Comment puis-je vous aider aujourd'hui ?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch user email from Supabase
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) })
      });

      if (!res.ok) throw new Error("Erreur serveur");

      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text || "Désolé, une erreur s'est produite."
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "⚠️ Une erreur s'est produite. Merci de réessayer dans quelques instants."
      }]);
    } finally {
      setIsLoading(false);
    }
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
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight relative z-10" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
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
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-[#111A24]/60 backdrop-blur-xl border border-white/5 rounded-[32px] shadow-2xl overflow-hidden animate-fade-in">
      <div className="px-6 py-5 border-b border-white/5 bg-black/20 flex items-center gap-4 shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 text-primary border border-primary/40 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.15)]">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
            ProFoot Expert <Sparkles className="w-4 h-4 text-warning" />
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-primary font-black">Agent IA Premium • En ligne</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-[24px] p-5 ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-[#10B981] to-[#059669] text-black rounded-tr-sm shadow-[0_4px_14px_rgba(16,185,129,0.2)]'
                : 'bg-black/40 border border-white/5 text-white rounded-tl-sm shadow-md'
            }`}>
              {m.role === 'assistant' && m.id !== 'welcome' && (
                <div className="flex items-center gap-2 mb-2">
                  <ProFootLogo className="w-4 h-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">Expert IA</span>
                </div>
              )}
              <div className={`text-sm md:text-base font-semibold leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-black' : 'text-white/80'}`}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-[24px] rounded-tl-sm p-5 bg-black/40 border border-white/5 flex items-center gap-3">
              <Loader className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs font-semibold text-white/50">L'expert analyse votre question...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/30 border-t border-white/5 shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Posez votre question sur le football..."
            className="w-full bg-[#111A24] border border-white/10 rounded-full py-4 pl-6 pr-16 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-semibold"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#34D399] transition-colors"
          >
            <Send className="w-4 h-4 translate-x-px" />
          </button>
        </form>
        <p className="text-center text-[10px] text-white/30 font-semibold mt-3">
          L'IA peut faire des erreurs. Vérifiez les informations importantes.
        </p>
      </div>
    </div>
  );
}
