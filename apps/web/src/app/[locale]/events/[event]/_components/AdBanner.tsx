"use client";

import { motion } from "framer-motion";
import { ArrowRight, Instagram } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

interface AdBannerProps {
  /** 배너 제목 */
  title: string;
  /** 배너 설명 (선택) */
  description?: string;
  /** 배경 이미지 URL */
  backgroundImage: string;
  /** CTA 버튼 링크 */
  ctaLink: string;
  /** CTA 버튼 텍스트 */
  ctaText?: string;
  /** 인스타그램 핸들 (@ 제외) */
  instagramHandle?: string;
  /** 로고 이미지 URL (선택) */
  logoImage?: string;
  /** 트래킹 이벤트 이름 */
  trackingEventName?: string;
  /** 그라데이션 색상 테마 */
  gradientTheme?: "dark" | "blue" | "purple" | "green";
}

const gradientThemes = {
  dark: "from-slate-900/95 via-slate-800/85 to-slate-900/90",
  blue: "from-blue-900/95 via-blue-700/85 to-sky-900/90",
  purple: "from-purple-900/95 via-purple-800/85 to-pink-900/90",
  green: "from-emerald-900/95 via-teal-800/85 to-cyan-900/90",
};

export function AdBanner({
  title,
  description,
  backgroundImage,
  ctaLink,
  ctaText = "Learn More",
  instagramHandle,
  logoImage,
  trackingEventName = "ad_banner_click",
  gradientTheme = "dark",
}: AdBannerProps) {
  const handleCtaClick = () => {
    trackEvent(trackingEventName, {
      event_category: "conversion",
      event_label: title,
      destination_url: ctaLink,
    });
  };

  const handleInstagramClick = () => {
    trackEvent(`${trackingEventName}_instagram`, {
      event_category: "social",
      event_label: instagramHandle,
    });
  };

  return (
    <div className="relative w-full overflow-hidden bg-slate-900">
      {/* Background Image with Gradient Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src={backgroundImage}
          alt={title}
          fill
          className="object-cover"
          priority
        />
        <div
          className={`absolute inset-0 bg-linear-to-r ${gradientThemes[gradientTheme]}`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto flex flex-col items-center justify-between gap-6 px-4 py-6 sm:px-6 md:flex-row lg:px-8">
        {/* Left Content: Logo & Text */}
        <div className="flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
          {/* Logo with Animation (optional) */}
          {logoImage && (
            <motion.div
              className="relative h-16 w-16 shrink-0 drop-shadow-2xl md:h-20 md:w-20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src={logoImage}
                alt={`${title} Logo`}
                fill
                className="object-contain"
              />
            </motion.div>
          )}

          {/* Text Content */}
          <div className="flex flex-col gap-2">
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xl leading-tight font-bold text-white md:text-2xl"
            >
              {title}
            </motion.h3>
            {description && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-full text-sm text-white/80 md:text-base"
              >
                {description}
              </motion.p>
            )}
          </div>
        </div>

        {/* Right Content: Actions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex shrink-0 items-center gap-3"
        >
          {/* Instagram Button */}
          {instagramHandle && (
            <Link
              href={`https://instagram.com/${instagramHandle}`}
              target="_blank"
              onClick={handleInstagramClick}
              className="group flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/20"
              aria-label={`Follow @${instagramHandle} on Instagram`}
            >
              <Instagram className="h-5 w-5 text-white transition-transform group-hover:scale-110" />
            </Link>
          )}

          {/* CTA Button */}
          <Link
            href={ctaLink}
            target="_blank"
            onClick={handleCtaClick}
            className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-slate-900 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-xl focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none"
          >
            <span className="whitespace-nowrap">{ctaText}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
