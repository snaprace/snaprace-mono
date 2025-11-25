"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

export function JingleBellBanner() {
  const handleCopy = () => {
    trackEvent("jingle_bell_promo_copy", {
      event_category: "engagement",
      event_label: "JINGLE2025",
      promo_code: "JINGLE2025",
    });
    void navigator.clipboard.writeText("JINGLE2025").then(() => {
      toast.success("Promo code copied to clipboard!");
    });
  };

  const handleRegisterClick = () => {
    trackEvent("jingle_bell_register_click", {
      event_category: "conversion",
      event_label: "hoboken_jingle_bell_5k",
      destination_url:
        "https://runsignup.com/Race/NJ/Hoboken/HobokenJingleBell5K",
    });
  };

  return (
    <div className="relative w-full overflow-hidden bg-slate-900">
      {/* Hero Background with Gradient Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hoboken-jingble-hero.jpg"
          alt="Hoboken Jingle Bell 5K Hero"
          fill
          className="object-cover opacity-50 grayscale-30"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-r from-red-900/95 via-red-900/80 to-green-900/80 mix-blend-multiply" />
        {/* Additional shimmer/gradient for depth */}
        <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto flex flex-col items-center justify-between gap-6 px-4 py-5 sm:px-6 md:flex-row lg:px-8">
        {/* Left Content: Logo & Text */}
        <div className="flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
          {/* Logo with Animation */}
          <motion.div
            className="relative h-20 w-20 shrink-0 drop-shadow-2xl md:h-22 md:w-22"
            animate={{
              rotate: [0, -10, 10, -5, 5, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              repeatDelay: 1,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/images/hoboken-jinglebel-logo.png"
              alt="Jingle Bell Logo"
              fill
              className="object-contain"
            />
          </motion.div>

          {/* Concise Text */}
          <div className="flex flex-col gap-1">
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-lg leading-tight font-bold text-white text-shadow-sm md:text-xl"
            >
              Hoboken Turkey Trot Runners, <br />{" "}
              <span className="text-yellow-400">Keep the cheer going!</span>
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-sm font-medium text-red-100 md:text-base"
            >
              Save <span className="font-bold text-yellow-400">$10</span> on
              Hoboken Jingle Bell 5K on December 13th with code{" "}
              <button
                onClick={handleCopy}
                className="inline-block cursor-pointer rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono font-bold tracking-wider text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-95"
                title="Click to copy"
              >
                <span className="inline-block whitespace-nowrap">
                  JINGLE2025
                </span>
              </button>
            </motion.p>
          </div>
        </div>

        {/* Right Content: CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link
            href="https://runsignup.com/Race/NJ/Hoboken/HobokenJingleBell5K"
            target="_blank"
            onClick={handleRegisterClick}
            className="group relative inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 font-bold text-black shadow-lg shadow-yellow-900/30 transition-all hover:-translate-y-0.5 hover:bg-yellow-500 hover:shadow-yellow-500/40 focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-yellow-900 focus:outline-none"
          >
            <motion.div
              animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 1,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/images/jinglebell.png"
                alt="Jingle Bell"
                width={24}
                height={24}
              />
            </motion.div>
            {/* <Sparkles className="h-4 w-4 animate-pulse text-yellow-300" /> */}
            <span className="whitespace-nowrap">Register Now</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
