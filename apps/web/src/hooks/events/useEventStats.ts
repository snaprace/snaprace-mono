import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

export function useEventStats(eventId: string, organizerId: string) {
  const params = useParams();
  const currentBib = params?.bib as string | undefined;

  const eventCountQuery = api.photosV2.getPhotoCountByEvent.useQuery(
    { organizerId, eventId },
    { enabled: !currentBib },
  );

  const bibCountQuery = api.photosV2.getPhotoCountByBib.useQuery(
    { eventId, bibNumber: currentBib ?? "" },
    { enabled: !!currentBib },
  );

  const runnerQuery = api.resultsV2.getRunnerByBib.useQuery(
    { eventId, bib: currentBib ?? "" },
    { enabled: !!currentBib },
  );

  if (currentBib) {
    return {
      label: `Bib #${currentBib}`,
      runnerName:
        runnerQuery.data?.first_name + " " + runnerQuery.data?.last_name,
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
