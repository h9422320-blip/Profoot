import { CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="bg-card border border-border-card rounded-3xl p-10 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground">Paiement Réussi !</h1>
          <p className="text-foreground/50">
            Félicitations, votre abonnement ProFoot AI est maintenant actif. Bienvenue dans l'élite !
          </p>
        </div>

        <Link 
          href="/analyze" 
          className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors"
        >
          Commencer l'analyse <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
