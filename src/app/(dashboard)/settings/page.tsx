"use client";

import { useState, useEffect } from "react";
import { User, Bell, CreditCard, Palette, Globe, Check } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profil");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("fr");

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const getInitials = (email: string) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Profil mis à jour avec succès !");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Paramètres</h1>
        <p className="text-white/50 text-sm mt-1 font-medium">Gérez votre compte et vos préférences personnelles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Paramètres */}
        <div className="space-y-2">
          <SettingsNavButton 
            icon={User} 
            label="Profil" 
            active={activeTab === "profil"} 
            onClick={() => setActiveTab("profil")} 
          />
          <SettingsNavButton 
            icon={Palette} 
            label="Apparence" 
            active={activeTab === "apparence"} 
            onClick={() => setActiveTab("apparence")} 
          />
          <SettingsNavButton 
            icon={Bell} 
            label="Notifications" 
            active={activeTab === "notifications"} 
            onClick={() => setActiveTab("notifications")} 
          />
          <SettingsNavButton 
            icon={Globe} 
            label="Langue" 
            active={activeTab === "langue"} 
            onClick={() => setActiveTab("langue")} 
          />
          <Link href="/pricing" className="block">
            <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all text-orange-400 hover:bg-orange-500/10 border border-transparent">
              <CreditCard className="w-4 h-4" />
              Abonnement
            </button>
          </Link>
        </div>

        {/* Contenu Paramètres */}
        <div className="md:col-span-3 space-y-8">
          
          {/* TAB: PROFIL */}
          {activeTab === "profil" && (
            <div className="bg-[#111A24]/80 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-2xl animate-fade-in">
              <h2 className="text-xl font-black text-white mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Informations du profil</h2>
              
              {loading ? (
                <div className="animate-pulse flex space-x-4">
                  <div className="rounded-full bg-white/10 h-20 w-20"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="h-2 bg-white/10 rounded"></div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-2 bg-white/10 rounded col-span-2"></div>
                        <div className="h-2 bg-white/10 rounded col-span-1"></div>
                      </div>
                      <div className="h-2 bg-white/10 rounded"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-6 mb-10">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-3xl font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      {getInitials(userEmail)}
                    </div>
                    <div>
                      <button className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
                        Changer l'avatar
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Prénom</label>
                        <input type="text" placeholder="Votre prénom" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-[#10B981]/50 focus:bg-white/10 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Nom</label>
                        <input type="text" placeholder="Votre nom" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-[#10B981]/50 focus:bg-white/10 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Email (Non modifiable)</label>
                      <input type="email" value={userEmail} disabled className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3.5 text-sm text-white/50 cursor-not-allowed" />
                    </div>
                    
                    <div className="pt-6 border-t border-white/5 flex justify-end">
                      <button type="submit" className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:brightness-110 active:scale-[0.98] text-black px-8 py-3 rounded-xl text-sm font-black transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)]">
                        Sauvegarder les modifications
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}

          {/* TAB: APPARENCE */}
          {activeTab === "apparence" && (
            <div className="bg-[#111A24]/80 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-2xl animate-fade-in">
              <h2 className="text-xl font-black text-white mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Thème de l'application</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button className="border-2 border-[#10B981] bg-white/5 rounded-2xl p-6 flex flex-col items-center gap-4 relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-[#10B981]">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="w-full h-32 bg-[#0A1118] rounded-xl border border-white/10 flex items-center justify-center shadow-inner relative overflow-hidden">
                     {/* Mockup UI */}
                     <div className="absolute top-2 left-2 right-2 flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-[#10B981]/50"></div>
                     </div>
                     <div className="w-16 h-2 bg-[#10B981]/30 rounded-full" />
                  </div>
                  <span className="font-bold text-white">Sombre (ProFoot Elite)</span>
                </button>
                <button className="border-2 border-transparent bg-white/5 hover:border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 transition-colors opacity-50 cursor-not-allowed">
                  <div className="w-full h-32 bg-[#F3F4F6] rounded-xl border border-gray-300 flex items-center justify-center shadow-inner relative overflow-hidden">
                     <div className="absolute top-2 left-2 right-2 flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-[#10B981]/50"></div>
                     </div>
                     <div className="w-16 h-2 bg-[#10B981]/50 rounded-full" />
                  </div>
                  <span className="font-bold text-white/50">Clair (Bientôt disponible)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="bg-[#111A24]/80 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-2xl animate-fade-in">
              <h2 className="text-xl font-black text-white mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Préférences de notifications</h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <h3 className="font-bold text-white text-sm">Alertes de nouveaux pronostics</h3>
                    <p className="text-xs text-white/50 mt-1 font-medium">Recevoir un email quand une nouvelle analyse IA majeure est disponible.</p>
                  </div>
                  <button 
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-[#10B981]' : 'bg-white/20'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <h3 className="font-bold text-white text-sm">Résultats de matchs suivis</h3>
                    <p className="text-xs text-white/50 mt-1 font-medium">Notification push sur votre appareil quand un match suivi se termine.</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-[#10B981]">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <h3 className="font-bold text-white text-sm">Offres et nouveautés</h3>
                    <p className="text-xs text-white/50 mt-1 font-medium">Informations sur les nouvelles fonctionnalités de ProFoot.</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-white/20">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LANGUE */}
          {activeTab === "langue" && (
            <div className="bg-[#111A24]/80 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-2xl animate-fade-in">
              <h2 className="text-xl font-black text-white mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Langue de l'interface</h2>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setSelectedLanguage("fr")}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${selectedLanguage === "fr" ? 'bg-[#10B981]/10 border-[#10B981]/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">🇫🇷</span>
                    <span className={`font-bold ${selectedLanguage === "fr" ? 'text-[#10B981]' : 'text-white'}`}>Français</span>
                  </div>
                  {selectedLanguage === "fr" && <Check className="w-5 h-5 text-[#10B981]" />}
                </button>

                <button 
                  onClick={() => setSelectedLanguage("en")}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${selectedLanguage === "en" ? 'bg-[#10B981]/10 border-[#10B981]/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">🇬🇧</span>
                    <span className={`font-bold ${selectedLanguage === "en" ? 'text-[#10B981]' : 'text-white'}`}>English (US)</span>
                  </div>
                  {selectedLanguage === "en" && <Check className="w-5 h-5 text-[#10B981]" />}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function SettingsNavButton({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${
      active 
        ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 scale-[1.02] shadow-sm' 
        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
    }`}>
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}ton>
  );
}
