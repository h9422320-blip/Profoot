import { XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PaymentFailedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="bg-card border border-border-card rounded-3xl p-10 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="w-10 h-10 text-danger" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground">Échec du paiement</h1>
          <p className="text-foreground/50">
            Nous n'avons pas pu valider votre paiement. Aucun montant n'a été débité de votre compte.
          </p>
        </div>

        <Link 
          href="/pricing" 
          className="w-full flex items-center justify-center gap-2 py-4 bg-sidebar border border-border-card text-foreground rounded-xl font-bold hover:bg-sidebar-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Réessayer
        </Link>
      </div>
    </div>
  );
}
