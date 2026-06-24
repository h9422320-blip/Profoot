"use client";

import { useState, useEffect, useRef } from "react";
import { User, Bell, CreditCard, Palette, Globe, Check, Upload } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState("profil");
  const [userEmail, setUserEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Notification states
  const [notifPredictions, setNotifPredictions] = useState(true);
  const [notifResults, setNotifResults] = useState(true);
  const [notifOffers, setNotifOffers] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email) setUserEmail(user.email);
        
        // Load metadata
        if (user.user_metadata?.full_name) {
          const parts = user.user_metadata.full_name.split(" ");
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
        }
        if (user.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        }
      }
      
      // Load notification preferences from localStorage
      const prefs = localStorage.getItem("profoot_notifs");
      if (prefs) {
        try {
          const parsed = JSON.parse(prefs);
          if (parsed.predictions !== undefined) setNotifPredictions(parsed.predictions);
          if (parsed.results !== undefined) setNotifResults(parsed.results);
          if (parsed.offers !== undefined) setNotifOffers(parsed.offers);
        } catch(e) {}
      }
      
      setLoading(false);
    };
    fetchUser();
  }, []);

  // Save notification preferences when they change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem("profoot_notifs", JSON.stringify({
        predictions: notifPredictions,
        results: notifResults,
        offers: notifOffers
      }));
    }
  }, [notifPredictions, notifResults, notifOffers, loading]);

  const getInitials = () => {
    if (firstName || lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (!userEmail) return "U";
    return userEmail.substring(0, 2).toUpperCase();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: `${firstName} ${lastName}`.trim() }
      });
      if (error) throw error;
      alert(t("settings.profileUpdated"));
    } catch (err) {
      console.error(err);
      alert(t("settings.profileError"));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${Math.random()}.${fileExt}`;
    
    try {
      setSaving(true);
      // Upload to bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
        
      if (uploadError) {
        console.error('Error uploading:', uploadError);
        // If bucket fails (often because bucket isn't created yet in dev), we can use a dummy image for mockup or just alert
        alert("Erreur: Le bucket 'avatars' n'existe peut-être pas dans Supabase.");
        return;
      }
      
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
      
      await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl }
      });
      
    } catch(err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">


      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Paramètres */}
        <div className="space-y-2">
          <SettingsNavButton 
            icon={User} 
            label={t("settings.profile")} 
            active={activeTab === "profil"} 
            onClick={() => setActiveTab("profil")} 
          />

          <Link href="/pricing" className="block">
            <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all text-orange-400 hover:bg-orange-500/10 border border-transparent">
              <CreditCard className="w-4 h-4" />
              {t("settings.subscription")}
            </button>
          </Link>
        </div>

        {/* Contenu Paramètres */}
        <div className="md:col-span-3 space-y-8">
          
          {/* TAB: PROFIL */}
          {activeTab === "profil" && (
            <div className="bg-card/80 backdrop-blur-md border border-border-card rounded-3xl p-8 shadow-2xl animate-fade-in">
              <h2 className="text-xl font-black text-foreground mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{t("settings.profileInfo")}</h2>
              
              {loading ? (
                <div className="animate-pulse flex space-x-4">
                  <div className="rounded-3xl bg-foreground/10 h-24 w-24"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="h-2 bg-foreground/10 rounded"></div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-2 bg-foreground/10 rounded col-span-2"></div>
                        <div className="h-2 bg-foreground/10 rounded col-span-1"></div>
                      </div>
                      <div className="h-2 bg-foreground/10 rounded"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-6 mb-10">
                    <div 
                      className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-3xl font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-cover bg-center overflow-hidden"
                      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : {}}
                    >
                      {!avatarUrl && getInitials()}
                    </div>
                    <div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={fileInputRef}
                        className="hidden" 
                        onChange={handleAvatarUpload}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 text-foreground px-5 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {t("settings.changeAvatar")}
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground/50 uppercase tracking-widest">{t("settings.firstName")}</label>
                        <input 
                          type="text" 
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder={t("settings.firstNamePlaceholder")} 
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:bg-foreground/10 transition-all" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground/50 uppercase tracking-widest">{t("settings.lastName")}</label>
                        <input 
                          type="text" 
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder={t("settings.lastNamePlaceholder")} 
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:bg-foreground/10 transition-all" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground/50 uppercase tracking-widest">{t("settings.emailNonEditable")}</label>
                      <input type="email" value={userEmail} disabled className="w-full bg-black/5 dark:bg-black/20 border border-foreground/5 rounded-xl px-4 py-3.5 text-sm text-foreground/50 cursor-not-allowed" />
                    </div>
                    
                    <div className="pt-6 border-t border-border-card flex justify-end">
                      <button 
                        type="submit" 
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 active:scale-[0.98] text-white px-8 py-3 rounded-xl text-sm font-black transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                      >
                        {saving ? t("settings.saving") : t("settings.saveChanges")}
                      </button>
                    </div>
                  </form>
                </>
              )}
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
        ? 'bg-primary/10 text-primary border border-primary/20 scale-[1.02] shadow-sm' 
        : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground border border-transparent'
    }`}>
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}
