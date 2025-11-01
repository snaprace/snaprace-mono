import { notFound } from "next/navigation";
import { decodePhotoId } from "@/utils/photo";
import { PhotoShareClient } from "./client";
import type { Metadata } from "next";

interface PhotoPageProps {
  params: Promise<{
    photoId: string;
  }>;
  searchParams?: Promise<{
    organizerId?: string;
    eventId?: string;
    bibNumber?: string;
  }>;
}

// Generate metadata for social sharing
export async function generateMetadata({
  params,
  searchParams,
}: PhotoPageProps): Promise<Metadata> {
  const { photoId } = await params;
  const sp = (await searchParams) || {};
  const organizerId = sp.organizerId || "";
  const eventId = sp.eventId || "";

  const decodedId = decodePhotoId(photoId);

  const imageUrl = constructImageUrl(decodedId, organizerId, eventId);

  if (!imageUrl) {
    return {
      title: "Photo Not Found",
      description: "The requested photo could not be found.",
    };
  }

  return {
    title: `Race Photo - ${decodedId}`,
    description: "Check out this amazing race photo from SnapRace!",
    openGraph: {
      title: `Race Photo - ${decodedId}`,
      description: "Check out this amazing race photo from SnapRace!",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `Race Photo ${decodedId}`,
        },
      ],
      type: "website",
      siteName: "SnapRace",
    },
    twitter: {
      card: "summary_large_image",
      title: `Race Photo - ${decodedId}`,
      description: "Check out this amazing race photo from SnapRace!",
      images: [imageUrl],
    },
  };
}

// Helper function to construct image URL from photo ID
function constructImageUrl(
  photoId: string,
  organizerId: string,
  eventId: string,
): string | null {
  // Check if it's a valid CloudFront URL pattern
  // We'll need to determine the full path - this might need to be stored or fetched
  // For now, we'll try to reconstruct a basic CloudFront URL

  // If the photoId looks like a filename (e.g., HHH-4-11655)
  if (/^[A-Z]+-\d+-\d+$/.test(photoId)) {
    // This is a simplified example - in production, you'd need to know the full path
    // You might store this mapping in a database or derive it from the event
    return `https://images.snap-race.com/${organizerId}/${eventId}/raw_photos/${photoId}.jpg`;
  }

  return null;
}

export default async function PhotoSharePage({
  params,
  searchParams,
}: PhotoPageProps) {
  const { photoId } = await params;
  const sp = (await searchParams) || {};
  const organizerId = sp.organizerId || "";
  const eventId = sp.eventId || "";
  const bibNumber = sp.bibNumber || "";
  const decodedId = decodePhotoId(photoId);
  const imageUrl = constructImageUrl(decodedId, organizerId, eventId);

  if (!imageUrl) {
    notFound();
  }

  // Server component renders the page with metadata
  // Client component handles the interactive photo viewer
  return (
    <PhotoShareClient
      photoId={decodedId}
      photoUrl={imageUrl}
      organizerId={organizerId}
      eventId={eventId}
      bibNumber={bibNumber}
    />
  );
}
