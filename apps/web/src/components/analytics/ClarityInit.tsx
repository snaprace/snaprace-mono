"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    clarity: (action: string, ...args: (string | number)[]) => void;
  }
}

export default function ClarityInit() {
  const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined" && clarityProjectId && window.clarity) {
      try {
        // Set custom tags based on current path
        const pathParts = pathname.split("/");

        // Tag page type
        if (pathname === "/") {
          window.clarity("set", "page_type", "home");
        } else if (pathname.includes("/events/")) {
          window.clarity("set", "page_type", "event_page");

          if (pathParts.length >= 3) {
            const eventId = pathParts[2];
            if (eventId) {
              window.clarity("set", "event_id", eventId);
            }

            if (pathParts.length >= 4) {
              const bibNumber = pathParts[3];
              if (bibNumber === "null") {
                window.clarity("set", "view_type", "all_photos");
              } else if (bibNumber) {
                window.clarity("set", "view_type", "bib_photos");
                window.clarity("set", "bib_number", bibNumber);
              }
            }
          }
        } else if (pathname.includes("/photo/")) {
          window.clarity("set", "page_type", "photo_detail");
        }

        // Set device type
        const isMobile = window.innerWidth < 768;
        window.clarity("set", "device_type", isMobile ? "mobile" : "desktop");

        // Set user agent info
        if (
          typeof navigator !== "undefined" &&
          (navigator.userAgent.includes("iPhone") ||
            navigator.userAgent.includes("Android"))
        ) {
          window.clarity("set", "platform", "mobile");
        } else {
          window.clarity("set", "platform", "desktop");
        }

        // Set referrer if available
        if (document.referrer) {
          window.clarity("set", "referrer", document.referrer);
        }
      } catch (error) {
        console.warn("Clarity tagging error:", error);
      }
    }
  }, [pathname, clarityProjectId]);

  // Only load in production with valid project ID
  if (!clarityProjectId || process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <Script
      id="clarity-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityProjectId}");
        `,
      }}
    />
  );
}
