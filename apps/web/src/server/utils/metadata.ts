import { type Metadata } from "next";
import { PhotoService } from "@/server/services/photos";
import { env } from "@/env";

export async function getPhotoMetadata({
  organizerId,
  eventId,
  pid,
}: {
  organizerId: string;
  eventId: string;
  pid: string;
}): Promise<Metadata | null> {
  try {
    const photo = await PhotoService.getPhoto({
      organizerId,
      eventId,
      pid,
    });

    if (photo) {
      // Construct Photo URL using image handler
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
        openGraph: {
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: "Event Photo",
            },
          ],
        },
        twitter: {
          images: [imageUrl],
        },
      };
    }
  } catch (error) {
    console.error("Error fetching photo for OG image:", error);
  }
  return null;
}

