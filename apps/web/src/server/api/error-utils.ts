import { TRPCError } from "@trpc/server";

export const ERROR_MESSAGES = {
  INTERNAL: "An unexpected error occurred.",
  BAD_REQUEST: "The request could not be processed.",
  NOT_FOUND: "The requested resource was not found.",
  ORGANIZATION: {
    NOT_FOUND: "Organization not found.",
    FETCH_FAILED: "Failed to fetch organization data.",
  },
  EVENT: {
    NOT_FOUND: "Event not found.",
    FETCH_FAILED: "Failed to fetch event data.",
    LIST_FAILED: "Failed to fetch events list.",
  },
  RESULTS: {
    NOT_FOUND: "Results not found.",
    FETCH_FAILED: "Failed to fetch race results.",
    BIB_NOT_FOUND: "No timing results were found for the provided bib number.",
  },
};

export const trpcError = {
  internal: (message: string = ERROR_MESSAGES.INTERNAL) =>
    new TRPCError({ code: "INTERNAL_SERVER_ERROR", message }),
  badRequest: (message: string = ERROR_MESSAGES.BAD_REQUEST) =>
    new TRPCError({ code: "BAD_REQUEST", message }),
  notFound: (message: string = ERROR_MESSAGES.NOT_FOUND) =>
    new TRPCError({ code: "NOT_FOUND", message }),
};
