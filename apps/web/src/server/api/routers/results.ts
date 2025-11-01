import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { ddb, DYNAMO_TIMING_RESULTS_TABLE } from "@/server/aws/clients";
import { getJsonFromS3 } from "@/server/utils/s3json";
import {
  getBibDetail,
  getAllEventResults,
  TimingServiceError,
  TimingServiceErrorReason,
  TIMING_MESSAGES,
} from "@/server/services/timing-service";
import type {
  BibDetailResponse,
  EventMetadataJSON,
} from "@/server/services/timing-service";
import { trpcError } from "@/server/api/error-utils";

const BibDetailInput = z.object({
  eventId: z.string().trim().min(1, "eventId is required."),
  bib: z.union([z.string().min(1, "bib is required."), z.number()]),
});

const TIMING_TRPC_MESSAGES = {
  NOT_FOUND: "No timing results were found for the provided bib number.",
  EVENT_NOT_FOUND: "No timing results were found for this event.",
};

export const resultsRouter = createTRPCRouter({
  getTimingByBib: publicProcedure
    .input(BibDetailInput)
    .query(async ({ input }) => {
      const { eventId } = input;
      const bib = String(input.bib).trim();

      let detail: BibDetailResponse;
      try {
        detail = await getBibDetail({
          ddb,
          tableName: DYNAMO_TIMING_RESULTS_TABLE,
          eventId,
          bib,
          loadDataset: (key) => getJsonFromS3(key),
        });
      } catch (error) {
        if (error instanceof TimingServiceError) {
          switch (error.reason) {
            case TimingServiceErrorReason.ItemNotFound:
              throw trpcError.notFound(TIMING_TRPC_MESSAGES.NOT_FOUND);
            case TimingServiceErrorReason.QueryFailed:
              throw trpcError.internal(String(TIMING_MESSAGES.FETCH_FAILED));
            case TimingServiceErrorReason.DatasetLoadFailed:
              throw trpcError.internal(
                String(TIMING_MESSAGES.DATASET_LOAD_FAILED),
              );
            case TimingServiceErrorReason.RowOutOfRange:
              throw trpcError.internal(
                String(TIMING_MESSAGES.ROW_OUT_OF_RANGE),
              );
            case TimingServiceErrorReason.DatasetMalformed:
              throw trpcError.badRequest(
                String(TIMING_MESSAGES.DATASET_MALFORMED),
              );
          }
        }

        throw trpcError.internal(String(TIMING_MESSAGES.FETCH_FAILED));
      }

      return detail;
    }),

  getAllResults: publicProcedure
    .input(
      z.object({
        eventId: z.string().min(1, "eventId is required."),
        organizationId: z.string().min(1, "organizationId is required."),
        category: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { eventId, organizationId, category } = input;

      // console.log("organizationId", organizationId);
      // console.log("eventId", eventId);
      // console.log("category", category);

      try {
        const results = await getAllEventResults({
          eventId,
          organizationId,
          loadDataset: (key) => getJsonFromS3(key),
          loadMetadata: (key) => getJsonFromS3<EventMetadataJSON>(key),
        });

        // Filter by category if specified
        if (category) {
          results.resultSets = results.resultSets.filter(
            (rs) => rs.id === category || rs.category === category,
          );
        }

        return results;
      } catch (error) {
        if (error instanceof TimingServiceError) {
          switch (error.reason) {
            case TimingServiceErrorReason.DatasetLoadFailed:
              throw trpcError.notFound(TIMING_TRPC_MESSAGES.EVENT_NOT_FOUND);
            case TimingServiceErrorReason.DatasetMalformed:
              throw trpcError.badRequest(
                String(TIMING_MESSAGES.DATASET_MALFORMED),
              );
            default:
              throw trpcError.internal(String(TIMING_MESSAGES.FETCH_FAILED));
          }
        }

        throw trpcError.internal(String(TIMING_MESSAGES.FETCH_FAILED));
      }
    }),
});
