export function ProFootLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Hexagon - Représente un panneau de ballon de football moderne */}
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      {/* Noeud central AI */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      {/* Connexions neuronales / tactiques */}
      <path d="M12 9.5v-3.5" />
      <path d="M12 18v-3.5" />
      <path d="M14.5 10.5l2.5-1.5" />
      <path d="M7 15l2.5-1.5" />
      <path d="M9.5 10.5L7 9" />
      <path d="M17 15l-2.5-1.5" />
    </svg>
  );
}
