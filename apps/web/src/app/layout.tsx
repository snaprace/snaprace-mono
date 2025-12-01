import "@/styles/globals.css";

import { Raleway } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";

import { OrganizerLoader } from "./organizer-loader";
import { OrganizerStyles } from "@/components/OrganizerStyles";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import ClarityInit from "@/components/analytics/ClarityInit";
import { getOrganizerBySubdomainServer } from "@/server/services/organizers-server";
import Script from "next/script";
import { env } from "@/env";

export async function generateMetadata() {
  const headersList = await headers();
  const subdomain = headersList.get("x-organization");

  let organizer = null;
  if (subdomain) {
    try {
      organizer = await getOrganizerBySubdomainServer(subdomain);
    } catch (error) {
      console.error("Failed to fetch organizer for metadata:", error);
    }
  }

  const siteName = organizer?.name || "SnapRace";
  const title = organizer
    ? `${organizer.name} - Event Photos & Results`
    : "SnapRace - Find Your Race Photos";
  const description = organizer
    ? `Find and download your race photos from ${organizer.name}. Search by bib number.`
    : "Easily find and download your race photos using your bib number.";

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title,
    description,
    keywords: [
      "race photos",
      "marathon photos",
      "running",
      "bib search",
      siteName,
    ],
    openGraph: {
      title,
      description,
      siteName,
      type: "website",
      images: [
        {
          url:
            organizer?.branding_meta?.branding?.logoUrl ||
            "/images/og-landing.png",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        organizer?.branding_meta?.branding?.logoUrl || "/images/og-landing.png",
      ],
    },
    icons: [
      {
        rel: "icon",
        url:
          organizer?.branding_meta?.branding?.logoUrl ||
          "/images/snaprace-logo-icon-only.svg",
      },
    ],
  };
}

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-raleway",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Get organizer data on server for immediate style application
  const headersList = await headers();
  const subdomain = headersList.get("x-organization");
  const CRISP_WEBSITE_ID = process.env.CRISP_WEBSITE_ID!;

  let organizer = null;
  if (subdomain) {
    try {
      organizer = await getOrganizerBySubdomainServer(subdomain);
    } catch (error) {
      console.error("Failed to fetch organizer for styles:", error);
    }
  }

  // JSON-LD for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": organizer ? "Organization" : "WebSite",
    name: organizer?.name || "SnapRace",
    url: env.NEXT_PUBLIC_SITE_URL, // Should technically be the full URL including subdomain if applicable
    description: organizer
      ? `Official photo gallery for ${organizer.name}`
      : "Find your race photos easily with SnapRace.",
    ...(organizer && {
      logo: organizer.branding_meta?.branding?.logoUrl,
    }),
  };

  return (
    <html lang="en" className={`${raleway.variable}`} suppressHydrationWarning>
      <head>
        <OrganizerStyles organizer={organizer} />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1979581843862905"
          crossOrigin="anonymous"
        ></script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-background m-0 min-h-screen antialiased">
        <OrganizerLoader>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </OrganizerLoader>
        {process.env.NODE_ENV === "production" &&
          process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
            <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
          )}
        <ClarityInit />
        <Script id="crisp-widget" strategy="afterInteractive">
          {`
            window.$crisp=[]; window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";
            (function(){
              const d=document,s=d.createElement("script");
              s.src="https://client.crisp.chat/l.js"; s.async=1;
              d.getElementsByTagName("head")[0].appendChild(s);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
