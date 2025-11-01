import { TRPCError } from "@trpc/server";

export const ERROR_MESSAGES = {
  INTERNAL: "An unexpected error occurred.",
  BAD_REQUEST: "The request could not be processed.",
  NOT_FOUND: "The requested resource was not found.",
};

export const trpcError = {
  internal: (message: string = ERROR_MESSAGES.INTERNAL) =>
    new TRPCError({ code: "INTERNAL_SERVER_ERROR", message }),
  badRequest: (message: string = ERROR_MESSAGES.BAD_REQUEST) =>
    new TRPCError({ code: "BAD_REQUEST", message }),
  notFound: (message: string = ERROR_MESSAGES.NOT_FOUND) =>
    new TRPCError({ code: "NOT_FOUND", message }),
};
