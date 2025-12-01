import type { MetadataRoute } from "next";
import { env } from "@/env";
import { createServerClient } from "@repo/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic event pages
  try {
    const supabase = createServerClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
    );

    const { data: events } = await supabase
      .from("events")
      .select("event_id, event_date")
      .eq("is_active", true)
      .order("event_date", { ascending: false });

    const eventPages: MetadataRoute.Sitemap = (events ?? []).map((event) => ({
      url: `${baseUrl}/events/${event.event_id}/null`,
      lastModified: event.event_date ? new Date(event.event_date) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticPages, ...eventPages];
  } catch (error) {
    console.error("Failed to generate dynamic sitemap:", error);
    return staticPages;
  }
}
