import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { PhotoService } from "@/server/services/photos";

type DatabaseClient = SupabaseClient<Database>;

export class PhotographerService {
  static async getPhotographersByEvent({
    supabase,
    eventId,
  }: {
    supabase: DatabaseClient;
    eventId: string;
  }) {
    const { data, error } = await supabase
      .from("event_photographers")
      .select(
        `
        instagram_handle,
        note,
        photographers (
          name,
          instagram_handle
        )
      `,
      )
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (error) {
      throw error;
    }

    const photographersWithCounts = await Promise.all(
      data.map(async (item) => {
        let imageCount = 0;
        if (item.instagram_handle) {
          imageCount = await PhotoService.getPhotoCountByPhotographer({
            eventId,
            instagramHandle: item.instagram_handle,
          });
        }

        return {
          instagramHandle: item.instagram_handle,
          name: item.photographers?.name,
          imageCount,
        };
      }),
    );

    return photographersWithCounts;
  }
}
