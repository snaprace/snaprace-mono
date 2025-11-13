import type { MetadataRoute } from "next";
import { env } from "@/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", // API 엔드포인트는 크롤링 방지
          "/_next/", // Next.js 내부 파일
          "/admin/", // 관리자 페이지 (향후 추가될 경우)
        ],
      },
      {
        // Good bots
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
        crawlDelay: 0,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

