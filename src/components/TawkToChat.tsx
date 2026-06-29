"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TAWK_PROPERTY_ID = "6a419e958719f21d5abdf20f"; // ProFoot AI

export default function TawkToChat() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. Initialize Tawk.to if not already done
    if (!(window as any).Tawk_API) {
      (window as any).Tawk_API = (window as any).Tawk_API || {};
      (window as any).Tawk_LoadStart = new Date();

      // Adjust position on mobile to avoid overlapping the bottom navbar
      (window as any).Tawk_API.customStyle = {
        visibility: {
          desktop: {
            position: 'br',
            xOffset: '15px',
            yOffset: '15px'
          },
          mobile: {
            position: 'br',
            xOffset: '15px',
            yOffset: '120px' // Remonté plus haut (120px au lieu de 80px)
          }
        }
      };

      const s1 = document.createElement("script");
      const s0 = document.getElementsByTagName("script")[0];

      s1.async = true;
      s1.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/1js856usr`;
      s1.charset = "UTF-8";
      s1.setAttribute("crossorigin", "*");

      if (s0 && s0.parentNode) {
        s0.parentNode.insertBefore(s1, s0);
      } else {
        document.head.appendChild(s1);
      }
    }

    // 2. Hide or show based on pathname
    const tawkApi = (window as any).Tawk_API;
    
    // Fonction pour gérer la visibilité
    const manageVisibility = () => {
      try {
        if (pathname === "/") {
          if (tawkApi.hideWidget) tawkApi.hideWidget();
        } else {
          if (tawkApi.showWidget) tawkApi.showWidget();
        }
      } catch (e) {
        console.warn("Tawk.to not fully ready");
      }
    };

    // On utilise un petit délai pour s'assurer que le widget est bien prêt à être caché/affiché
    const checkInterval = setInterval(() => {
      if (tawkApi.isLoaded || tawkApi.hideWidget) {
        manageVisibility();
        clearInterval(checkInterval);
      }
    }, 300);

    // Sécurité: on nettoie l'intervalle après 10 secondes
    setTimeout(() => clearInterval(checkInterval), 10000);

    tawkApi.onLoad = manageVisibility;

  }, [pathname]);

  return null;
}
