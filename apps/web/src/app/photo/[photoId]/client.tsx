"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoSingleView } from "@/components/PhotoSingleView";
import { Skeleton } from "@/components/ui/skeleton";
import { encodePhotoId } from "@/utils/photo";

interface PhotoShareClientProps {
  photoId: string;
  photoUrl: string;
  organizerId?: string;
  eventId?: string;
  bibNumber?: string;
}

export function PhotoShareClient({
  photoId,
  photoUrl,
  organizerId,
  eventId,
  bibNumber,
}: PhotoShareClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If we have eventId, redirect to canonical events PhotoSingleView URL
    if (eventId) {
      const pid = encodePhotoId(photoId);
      const bib = bibNumber && bibNumber.length > 0 ? bibNumber : "null";
      router.replace(`/events/${eventId}/${bib}?pid=${pid}`);
      return;
    }
    // Otherwise, keep lightweight fallback rendering
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, [router, eventId, bibNumber, photoId]);

  const handleIndexChange = () => {
    // Single photo view doesn't need index changes
    return;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <Skeleton className="mx-auto mb-4 h-96 w-96" />
          <Skeleton className="mx-auto mb-2 h-4 w-48" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PhotoSingleView
        isOpen={true}
        onClose={() => router.push("/")}
        photos={[photoUrl]}
        currentIndex={0}
        onIndexChange={handleIndexChange}
        event={eventId}
        bibNumber={bibNumber}
        organizerId={organizerId}
      />
    </div>
  );
}
