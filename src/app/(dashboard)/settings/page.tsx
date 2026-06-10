import { User, Bell, Shield, CreditCard, Palette, Globe } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-foreground/50 text-sm mt-1">Gérez votre compte et vos préférences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Paramètres */}
        <div className="space-y-2">
          <SettingsNavButton icon={User} label="Profil" active />
          <SettingsNavButton icon={Palette} label="Apparence" />
          <SettingsNavButton icon={Bell} label="Notifications" />
          <SettingsNavButton icon={Globe} label="Langue" />
          <Link href="/pricing" className="block">
            <SettingsNavButton icon={CreditCard} label="Abonnement" />
          </Link>
          <SettingsNavButton icon={Shield} label="Sécurité" />
        </div>

        {/* Contenu Paramètres */}
        <div className="md:col-span-3 space-y-8">
          <div className="bg-card border border-border-card rounded-2xl p-8 shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-6">Informations du profil</h2>
            
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-sidebar border-2 border-border-card flex items-center justify-center text-2xl font-bold text-foreground">
                OB
              </div>
              <div>
                <button className="bg-sidebar border border-border-card hover:bg-border-card text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Changer l'avatar
                </button>
              </div>
            </div>

            <form className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Prénom</label>
                  <input type="text" defaultValue="Ousmane" className="w-full bg-sidebar border border-border-card rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Nom</label>
                  <input type="text" defaultValue="B." className="w-full bg-sidebar border border-border-card rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Email</label>
                <input type="email" defaultValue="contact@exemple.com" className="w-full bg-sidebar border border-border-card rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              
              <div className="pt-4 border-t border-border-card flex justify-end">
                <button className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors">
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>

          <div className="bg-card border border-border-card rounded-2xl p-8 shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-6">Thème</h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="border-2 border-primary bg-sidebar rounded-xl p-4 flex flex-col items-center gap-3">
                <div className="w-full h-24 bg-[#0b1319] rounded-lg border border-border-card flex items-center justify-center">
                  <div className="w-12 h-2 bg-primary/20 rounded" />
                </div>
                <span className="font-bold text-foreground">Sombre (Visifoot)</span>
              </button>
              <button className="border-2 border-transparent bg-sidebar hover:border-border-card rounded-xl p-4 flex flex-col items-center gap-3 transition-colors opacity-50 cursor-not-allowed">
                <div className="w-full h-24 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                  <div className="w-12 h-2 bg-primary/20 rounded" />
                </div>
                <span className="font-bold text-foreground/50">Clair (Bientôt)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavButton({ icon: Icon, label, active }: any) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
      active 
        ? 'bg-primary/10 text-primary border border-primary/20' 
        : 'text-foreground/70 hover:bg-card hover:text-foreground border border-transparent'
    }`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
