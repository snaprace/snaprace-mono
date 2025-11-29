import { useMemo } from "react";
import { api } from "@/trpc/react";
import type { Photo as SharedPhoto } from "@/types/photo";

export type Photo = SharedPhoto & {
  src: string;
  isSelfieMatch?: boolean;
  organizerId: string;
};

interface UsePhotoGalleryProps {
  eventId: string;
  organizerId: string;
  bib?: string;
  instagramHandle?: string | null;
}

export function usePhotoGallery({
  eventId,
  organizerId,
  bib,
  instagramHandle,
}: UsePhotoGalleryProps) {
  const byEventQuery = api.photos.getByEvent.useInfiniteQuery(
    {
      organizerId,
      eventId,
      limit: 50,
      instagramHandle: instagramHandle ?? undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !bib,
    },
  );

  const byBibQuery = api.photos.getByBib.useInfiniteQuery(
    {
      organizerId,
      eventId,
      bibNumber: bib ?? "",
      limit: 50,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!bib,
    },
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    bib ? byBibQuery : byEventQuery;

  const photos = useMemo(() => {
    return (
      data?.pages.flatMap((page) =>
        page.items.map((item) => ({
          ...item,
          organizerId: item.orgId,
        })),
      ) ?? []
    );
  }, [data]);

  return {
    photos,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  };
}
