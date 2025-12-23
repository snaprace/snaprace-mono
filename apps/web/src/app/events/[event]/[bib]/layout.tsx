import { setRequestLocale, getLocale } from "next-intl/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PhotoService } from "@/server/services/photos";
import { env } from "@/env";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string; bib: string }>;
}): Promise<Metadata> {
  const { event: eventId, bib } = await params;
  const locale = await getLocale();

  if (bib === "null") {
    return {};
  }

  try {
    const { items } = await PhotoService.getPhotosByBib({
      eventId,
      bibNumber: bib,
      limit: 1,
    });

    if (items.length > 0 && items[0]) {
      const photo = items[0];
      const imageRequest = {
        bucket: env.NEXT_PUBLIC_IMAGE_BUCKET,
        key: photo.src,
        edits: {
          resize: {
            width: 1200,
            height: 630,
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
          toFormat: "jpeg",
        },
      };
      const json = JSON.stringify(imageRequest);
      const encoded = Buffer.from(json).toString("base64");
      const imageUrl = `${env.NEXT_PUBLIC_IMAGE_HANDLER_URL}/${encoded}`;

      return {
        title: `Bib ${bib} - Photos`,
        openGraph: {
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: `Bib ${bib} Photos`,
            },
          ],
        },
        twitter: {
          images: [imageUrl],
        },
      };
    }
  } catch (error) {
    console.error("Error fetching photo for Bib OG image:", error);
  }

  return {
    title: `Bib ${bib} - Photos`,
  };
}

export default async function BibLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ event: string; bib: string }>;
}) {
  const locale = await getLocale();
  setRequestLocale(locale);

  return <>{children}</>;
}

