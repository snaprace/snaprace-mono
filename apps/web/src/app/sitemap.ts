import type { MetadataRoute } from "next";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient, TABLES } from "@/lib/dynamodb";
import { env } from "@/env";

interface Event {
  event_id: string;
  event_name: string;
  event_date: string;
  organization_id: string;
}

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
    const command = new ScanCommand({
      TableName: TABLES.EVENTS,
    });
    const result = await dynamoClient.send(command);
    const events = (result.Items ?? []) as Event[];

    const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
      url: `${baseUrl}/events/${event.event_id}/null`,
      lastModified: event.event_date
        ? new Date(event.event_date)
        : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticPages, ...eventPages];
  } catch (error) {
    console.error("Failed to generate dynamic sitemap:", error);
    return staticPages;
  }
}

