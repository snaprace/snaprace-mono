import { useMemo } from "react";
import { api } from "@/trpc/react";
import { getBlurDataURL } from "@/utils/thumbhash";

export type Photo = {
  src: string;
  width: number;
  height: number;
  id: string;
  blurDataURL?: string;
};

interface UsePhotoGalleryProps {
  eventId: string;
  organizerId: string;
  bib?: string;
}

export function usePhotoGallery({
  eventId,
  organizerId,
  bib,
}: UsePhotoGalleryProps) {
  const byEventQuery = api.photosV2.getByEvent.useInfiniteQuery(
    {
      organizerId,
      eventId,
      limit: 100,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !bib,
    },
  );

  const byBibQuery = api.photosV2.getByBib.useInfiniteQuery(
    {
      organizerId,
      eventId,
      bibNumber: bib ?? "",
      limit: 100,
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
          id: item.key,
          src: item.imageUrl,
          width: item.width,
          height: item.height,
          blurDataURL: getBlurDataURL(item.thumbHash),
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
