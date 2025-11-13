import "@/styles/globals.css";

import { type Metadata } from "next";
import { Raleway } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";

import { OrganizationLoader } from "./organization-loader";
import { OrganizationStyles } from "@/components/OrganizationStyles";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import ClarityInit from "@/components/analytics/ClarityInit";
import { getOrganizationBySubdomain } from "@/lib/server-organization";
import Script from "next/script";
import { env } from "@/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: "SnapRace - Find Your Race Photos",
  description:
    "Easily find and download your race photos using your bib number.",
  openGraph: {
    title: "SnapRace - Find Your Race Photos",
    description:
      "Easily find and download your race photos using your bib number.",
    type: "website",
    images: [
      {
        url: "/images/og-landing.png",
        width: 1200,
        height: 630,
        alt: "SnapRace - Find Your Race Photos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/og-landing.png"],
  },
};

// const poppins = Poppins({
//   subsets: ["latin"],
//   weight: ["300", "400", "500", "600", "700"],
//   variable: "--font-poppins",
//   display: "swap",
// });

// const montserrat = Montserrat({
//   subsets: ["latin"],
//   weight: ["400", "500", "600", "700", "800"],
//   variable: "--font-montserrat",
//   display: "swap",
// });

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-raleway",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Get organization data on server for immediate style application
  const headersList = await headers();
  const subdomain = headersList.get("x-organization");
  const CRISP_WEBSITE_ID = process.env.CRISP_WEBSITE_ID!;

  let organization = null;
  if (subdomain) {
    try {
      organization = await getOrganizationBySubdomain(subdomain);
    } catch (error) {
      console.error("Failed to fetch organization for styles:", error);
    }
  }

  return (
    <html lang="en" className={`${raleway.variable}`}>
      <head>
        <OrganizationStyles organization={organization} />
      </head>
      <body className="bg-background m-0 min-h-screen antialiased">
        <OrganizationLoader>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </OrganizationLoader>
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
