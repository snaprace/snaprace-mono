"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  trackEventPageVisit,
  trackCampaignVisit,
  trackTimeSpent,
  trackPerformance,
} from "@/lib/analytics";

export function useAnalyticsTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startTimeRef = useRef<number>(Date.now());
  const lastPathnameRef = useRef<string>("");

  useEffect(() => {
    const currentTime = Date.now();

    // Track time spent on previous page
    if (lastPathnameRef.current && lastPathnameRef.current !== pathname) {
      const timeSpent = Math.round((currentTime - startTimeRef.current) / 1000);
      if (timeSpent > 0 && timeSpent < 3600) {
        // Only track reasonable time spans (0-1 hour)
        trackTimeSpent(lastPathnameRef.current, timeSpent);
      }
    }

    // Update refs for next page
    startTimeRef.current = currentTime;
    lastPathnameRef.current = pathname;

    // UTM 파라미터 추적 (이메일 캠페인에서 유입 시)
    const utmSource = searchParams.get("utm_source");
    const utmMedium = searchParams.get("utm_medium");
    const utmCampaign = searchParams.get("utm_campaign");

    if (utmSource) {
      trackCampaignVisit(
        utmSource,
        utmMedium || undefined,
        utmCampaign || undefined,
        pathname,
      );
    }

    // 페이지별 특별 추적
    if (pathname.includes("/events/")) {
      const pathParts = pathname.split("/");
      if (pathParts.length >= 4) {
        const eventId = pathParts[2];
        const bibNumber = pathParts[3];

        if (eventId) {
          trackEventPageVisit(
            eventId,
            bibNumber !== "null" ? bibNumber : undefined,
            bibNumber === "null",
          );
        }
      }
    }
    // 일반 페이지는 GA4 기본 페이지뷰로 충분
  }, [pathname, searchParams]);

  // Cleanup: track time spent when component unmounts
  useEffect(() => {
    return () => {
      if (lastPathnameRef.current) {
        const timeSpent = Math.round(
          (Date.now() - startTimeRef.current) / 1000,
        );
        if (timeSpent > 0 && timeSpent < 3600) {
          trackTimeSpent(lastPathnameRef.current, timeSpent);
        }
      }
    };
  }, []);
}

// Hook for tracking performance metrics
export function usePerformanceTracking() {
  useEffect(() => {
    if (typeof window === "undefined") return; // Core Web Vitals (LCP, INP, CLS + FID/FCP/TTFB)
    void (async () => {
      try {
        const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import(
          "web-vitals"
        );
        const send = (metric: { name: string; value: number }) => {
          // Round to integer for consistency in GA
          trackPerformance({
            name: metric.name,
            value: Math.round(metric.value),
          });
        };
        onCLS(send);
        onFCP(send);
        onINP(send);
        onLCP(send);
        onTTFB(send);
      } catch (error) {
        console.warn("Performance tracking error:", error);
      }
    })();
  }, []);
}
