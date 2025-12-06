import "@/styles/globals.css";

import { Raleway } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrganizerLoader } from "../organizer-loader";
import { OrganizerStyles } from "@/components/OrganizerStyles";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import ClarityInit from "@/components/analytics/ClarityInit";
import { UnsupportedLocaleWarning } from "@/components/UnsupportedLocaleWarning";
import { getOrganizerBySubdomainServer } from "@/server/services/organizers-server";
import Script from "next/script";
import { env } from "@/env";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
    keywords: ["race photos", "marathon photos", "running", "bib search", siteName],
    openGraph: {
      title,
      description,
      siteName,
      type: "website",
      locale,
      images: [
        {
          url: organizer?.branding_meta?.branding?.logoUrl || "/images/og-landing.png",
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
      images: [organizer?.branding_meta?.branding?.logoUrl || "/images/og-landing.png"],
    },
    icons: [
      {
        rel: "icon",
        url: organizer?.branding_meta?.branding?.logoUrl || "/images/snaprace-logo-icon-only.svg",
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

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

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

  const messages = await getMessages();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": organizer ? "Organization" : "WebSite",
    name: organizer?.name || "SnapRace",
    url: env.NEXT_PUBLIC_SITE_URL,
    description: organizer
      ? `Official photo gallery for ${organizer.name}`
      : "Find your race photos easily with SnapRace.",
    ...(organizer && { logo: organizer.branding_meta?.branding?.logoUrl }),
  };

  return (
    <html lang={locale} className={`${raleway.variable}`} suppressHydrationWarning>
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
        <NextIntlClientProvider messages={messages}>
          <OrganizerLoader>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              {organizer && organizer.countries && (
                <div className="container mx-auto px-4 pt-4">
                  <UnsupportedLocaleWarning
                    organizerCountries={organizer.countries}
                    currentLocale={locale as Locale}
                  />
                </div>
              )}
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </OrganizerLoader>
        </NextIntlClientProvider>
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

