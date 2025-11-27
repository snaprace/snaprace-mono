import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

export function useEventStats(
  eventId: string,
  organizerId: string,
  displayMode: string,
) {
  const params = useParams();
  const currentBib = params?.bib as string | undefined;

  const eventCountQuery = api.photos.getPhotoCountByEvent.useQuery(
    { organizerId, eventId },
    { enabled: !currentBib },
  );

  const bibCountQuery = api.photos.getPhotoCountByBib.useQuery(
    { eventId, bibNumber: currentBib ?? "" },
    { enabled: !!currentBib },
  );

  const runnerQuery = api.results.getRunnerByBib.useQuery(
    { eventId, bib: currentBib ?? "" },
    { enabled: !!currentBib && displayMode === "RESULTS_AND_PHOTOS" },
  );

  if (currentBib) {
    return {
      label: `Bib #${currentBib}`,
      runnerName: runnerQuery.data
        ? `${runnerQuery.data.first_name} ${runnerQuery.data.last_name}`
        : undefined,
      count: bibCountQuery.data,
      isLoading: bibCountQuery.isLoading || runnerQuery.isLoading,
    };
  }

  return {
    label: "All Photos",
    count: eventCountQuery.data,
    isLoading: eventCountQuery.isLoading,
  };
}
