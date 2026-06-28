"use client";
import { useEffect } from "react";

const TAWK_PROPERTY_ID = "6a419e958719f21d5abdf20f"; // ProFoot AI

export default function TawkToChat() {
  useEffect(() => {
    // Use the official Tawk.to initialization pattern
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    (window as any).Tawk_LoadStart = new Date();

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
  }, []);

  return null;
}
