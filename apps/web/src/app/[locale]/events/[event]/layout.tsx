import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { getEventById, type Event } from "@/server/services/events";
import { EventHeader } from "./_components/EventHeader";
import { env } from "@/env";
import { AdBanner } from "./_components/AdBanner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string; locale: string }>;
}): Promise<Metadata> {
  const eventId = (await params).event;
  const event: Event | null = await getEventById({ eventId });

  if (!event) {
    return {
      title: "Event Not Found",
    };
  }

  let imageUrl = event.thumbnail_image || "/images/no-image.jpg";

  // Handle event thumbnail
  if (!imageUrl.startsWith("http") && !imageUrl.startsWith("https")) {
    if (imageUrl.startsWith("/")) {
      imageUrl = `${env.NEXT_PUBLIC_SITE_URL}${imageUrl}`;
    } else {
      // It's an S3 key
      const imageRequest = {
        bucket: env.NEXT_PUBLIC_IMAGE_BUCKET,
        key: imageUrl,
        edits: {
          resize: {
            width: 1200,
            height: 630,
            fit: "cover",
          },
          toFormat: "jpeg",
        },
      };
      const json = JSON.stringify(imageRequest);
      const encoded = Buffer.from(json).toString("base64");
      imageUrl = `${env.NEXT_PUBLIC_IMAGE_HANDLER_URL}/${encoded}`;
    }
  }

  return {
    title: event.name,
    description: `${event.name} - ${new Date(event.event_date).toLocaleDateString()}`,
    openGraph: {
      title: event.name,
      description: `${event.name} - ${new Date(event.event_date).toLocaleDateString()}`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: event.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description: `${event.name} - ${new Date(event.event_date).toLocaleDateString()}`,
      images: [imageUrl],
    },
  };
}

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ event: string; locale: string }>;
}) {
  const { event: eventId, locale } = await params;
  setRequestLocale(locale);

  const event: Event | null = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-white">
      <EventHeader event={event} />
      {event.organizer_id === "winningeventsgroup" && (
        <AdBanner
          title="Winning Events Group — Creating Unforgettable Experiences"
          description="Trusted race management for runners, communities, and charities since 2013"
          backgroundImage="https://wvlrlvkfgwsbbhcsuarh.supabase.co/storage/v1/object/public/assets/winningeventsgroup/ad-banner-background.png"
          ctaLink="https://winningeventsgroup.com/"
          ctaText="Get Started"
          instagramHandle="winningeventsgroup"
          logoImage="https://wvlrlvkfgwsbbhcsuarh.supabase.co/storage/v1/object/public/assets/winningeventsgroup/logo.png"
          gradientTheme="blue"
        />
      )}
      {children}
    </div>
  );
}
