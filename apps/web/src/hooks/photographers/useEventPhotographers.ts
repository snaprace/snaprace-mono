import { api } from "@/trpc/react";

export function useEventPhotographers(eventId: string) {
  const { data: photographers, isLoading } =
    api.photosV2.getPhotographersByEvent.useQuery(
      { eventId },
      {
        enabled: !!eventId,
      },
    );

  return {
    photographers,
    isLoading,
  };
}
