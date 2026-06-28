"use client";
import { useEffect } from "react";

// ============================================================================
// Tawk.to Live Chat Widget
// HOW TO GET YOUR OWN ID:
// 1. Go to https://www.tawk.to and create a FREE account
// 2. Create a property (your website name: ProFoot AI)
// 3. In Settings > Widget, copy your Property ID (looks like: 64abc123...)
// 4. Replace TAWK_PROPERTY_ID below with your real ID
// ============================================================================

const TAWK_PROPERTY_ID = "REPLACE_WITH_YOUR_TAWK_ID"; // <-- Replace this
const TAWK_WIDGET_ID = "default";

export default function TawkToChat() {
  useEffect(() => {
    // Don't load if it's the placeholder
    if (TAWK_PROPERTY_ID === "REPLACE_WITH_YOUR_TAWK_ID") return;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
}
