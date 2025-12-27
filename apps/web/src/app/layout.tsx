import "@/styles/globals.css";

import { Raleway } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrganizerLoader } from "./organizer-loader";
import { OrganizerStyles } from "@/components/OrganizerStyles";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import ClarityInit from "@/components/analytics/ClarityInit";
import { UnsupportedLocaleWarning } from "@/components/UnsupportedLocaleWarning";
import {
  getOrganizerBySubdomainServer,
  type Organizer,
} from "@/server/services/organizers-server";
import Script from "next/script";
import { env } from "@/env";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

export async function generateMetadata() {
  const locale = await getLocale();
  const headersList = await headers();
  const subdomain = headersList.get("x-organization");

  let organizer: Organizer | null = null;
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
      locale,
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const headersList = await headers();
  const subdomain = headersList.get("x-organization");
  const CRISP_WEBSITE_ID = process.env.CRISP_WEBSITE_ID;

  let organizer: Organizer | null = null;
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
    <html
      lang={locale}
      className={`${raleway.variable}`}
      suppressHydrationWarning
    >
      <head>
        <OrganizerStyles organizer={organizer} />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1979581843862905"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          src="https://app.rybbit.io/api/script.js"
          data-site-id="d60dc1436468"
          defer
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(e,c){if(!c.__SV){var l,h;window.mixpanel=c;c._i=[];c.init=function(q,r,f){function t(d,a){var g=a.split(".");2==g.length&&(d=d[g[0]],a=g[1]);d[a]=function(){d.push([a].concat(Array.prototype.slice.call(arguments,0)))}}var b=c;"undefined"!==typeof f?b=c[f]=[]:f="mixpanel";b.people=b.people||[];b.toString=function(d){var a="mixpanel";"mixpanel"!==f&&(a+="."+f);d||(a+=" (stub)");return a};b.people.toString=function(){return b.toString(1)+".people (stub)"};l="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders start_session_recording stop_session_recording people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
              for(h=0;h<l.length;h++)t(b,l[h]);var n="set set_once union unset remove delete".split(" ");b.get_group=function(){function d(p){a[p]=function(){b.push([g,[p].concat(Array.prototype.slice.call(arguments,0))])}}for(var a={},g=["get_group"].concat(Array.prototype.slice.call(arguments,0)),m=0;m<n.length;m++)d(n[m]);return a};c._i.push([q,r,f])};c.__SV=1.2;var k=e.createElement("script");k.type="text/javascript";k.async=!0;k.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===
              e.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";e=e.getElementsByTagName("script")[0];e.parentNode.insertBefore(k,e)}})(document,window.mixpanel||[]);
              mixpanel.init('95ad1839257c575bff4b014a327dffe4', {
                autocapture: true,
                record_sessions_percent: 100,
              });
            `,
          }}
        />
        <script
          defer
          data-website-id="dfid_lcanOkGnCi6WspWy3muYC"
          data-domain="snap-race.com"
          src="https://datafa.st/js/script.js"
        ></script>
      </head>
      <body className="bg-background m-0 min-h-screen antialiased">
        <NextIntlClientProvider key={locale} messages={messages}>
          <OrganizerLoader>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              {organizer && organizer.countries && (
                <div className="container mx-auto px-4 pt-4">
                  <UnsupportedLocaleWarning
                    organizerCountries={organizer.countries}
                    currentLocale={locale}
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
        {CRISP_WEBSITE_ID && (
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
        )}
      </body>
    </html>
  );
}
