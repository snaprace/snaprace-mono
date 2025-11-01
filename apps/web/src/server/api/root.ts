import { galleriesRouter } from "@/server/api/routers/galleries";
import { eventsRouter } from "@/server/api/routers/events";
import { photosRouter } from "@/server/api/routers/photos";
import { organizationsRouter } from "@/server/api/routers/organizations";
import { resultsRouter } from "@/server/api/routers/results";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  galleries: galleriesRouter,
  events: eventsRouter,
  photos: photosRouter,
  organizations: organizationsRouter,
  results: resultsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
