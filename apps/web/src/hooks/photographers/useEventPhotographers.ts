import { api } from "@/trpc/react";

export function useEventPhotographers(eventId: string) {
  const { data: photographers, isLoading } =
    api.photos.getPhotographersByEvent.useQuery(
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
