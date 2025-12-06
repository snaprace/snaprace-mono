import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { getEventById } from "@/server/services/events";
import { EventHeader } from "./_components/EventHeader";
import { JingleBellBanner } from "./_components/JingleBellBanner";
import { env } from "@/env";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string; locale: string }>;
}): Promise<Metadata> {
  const eventId = (await params).event;
  const event = await getEventById({ eventId });

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
  children: ReactNode;
  params: Promise<{ event: string; locale: string }>;
}) {
  const { event: eventId, locale } = await params;
  setRequestLocale(locale);

  const event = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-white">
      <EventHeader event={event} />
      {event.organizer_id === "winningeventsgroup" && <JingleBellBanner />}
      {children}
    </div>
  );
}
