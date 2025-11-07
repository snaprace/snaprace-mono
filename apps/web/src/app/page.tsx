"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Camera,
  Clock3,
  PlayCircle,
  Quote,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import { EventSelectSkeleton } from "@/components/states/EventsSkeleton";
import { useOrganizationHelper } from "@/hooks/useOrganizationHelper";
import { Footer } from "@/components/Footer";

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export default function HomePage() {
  const [bibNumber, setBibNumber] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const router = useRouter();
  const org = useOrganizationHelper();

  const eventsQuery = api.events.getAll.useQuery();

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0]?.event_id ?? "");
    }
  }, [events, selectedEventId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (bibNumber.trim() && selectedEventId) {
      router.push(`/events/${selectedEventId}/${bibNumber.trim()}`);
    }
  };

  const heroTitle = org.subdomain
    ? `${org.name}\nRelive your race moments`
    : "Every race moment in one place";

  const heroDescription =
    org.welcomeMessage ||
    "Find your photos and results instantly with face recognition.";

  const uspHighlights = [
    {
      icon: Sparkles,
      title: "Instant face recognition search",
      description:
        "Discover your photos within seconds, even across thousands of images.",
    },
    {
      icon: Camera,
      title: "Live photo feed",
      description:
        "Photos go live the moment they are uploaded, ready to review right after the finish line.",
    },
    {
      icon: Clock3,
      title: "Connected race data",
      description:
        "View results, splits, and team standings together on a single page.",
    },
  ];

  const painPoints = [
    {
      title: "Searching takes too long",
      description:
        "Digging through endless galleries dulls the excitement of finishing your race.",
    },
    {
      title: "Photos and results live apart",
      description:
        "No more juggling photos by email and results in spreadsheets—see everything together.",
    },
    {
      title: "Participants expect personalization",
      description:
        "Deliver sponsor messages, team badges, and community highlights tailored to each runner.",
    },
  ];

  const testimonials = [
    {
      quote:
        "We found and shared team photos immediately after the race—participant satisfaction jumped overnight.",
      name: "Soojin Chung",
      role: "Race Director, Seoul Running Festival",
    },
    {
      quote:
        "Having results and media in one place cut our sponsor reporting time dramatically.",
      name: "Minjae Kim",
      role: "Sports Marketing Manager",
    },
    {
      quote:
        "Face recognition lets runners self-serve their photos and convert seamlessly into purchases.",
      name: "Eunji Park",
      role: "Event Organizer, Trail One",
    },
  ];

  const stats = [
    { label: "Face recognition accuracy", value: "98%" },
    { label: "Average search time", value: "12s" },
    { label: "Photos processed monthly", value: "450k" },
  ];

  const heroAccentHighlights = [
    "AI face matching in seconds",
    "Live gallery updates",
    "Data-rich racer insights",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="container mx-auto flex flex-col gap-12 px-4 pb-32 pt-24 sm:px-6 md:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[40px] border border-border/60 bg-card/40 shadow-[0_40px_120px_-50px] shadow-primary/50"
        >
          <Image
            src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2400"
            alt="Runners celebrating at the finish line"
            fill
            priority
            className="object-cover brightness-[0.85]"
            sizes="(min-width: 1280px) 1200px, 100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-primary/40 to-background/20" />
          <motion.span
            aria-hidden
            className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-primary/40 blur-3xl"
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden
            className="absolute -bottom-24 right-[-10%] h-96 w-96 rounded-full bg-secondary/40 blur-[100px]"
            animate={{ opacity: [0.25, 0.55, 0.25], scale: [1.05, 0.95, 1.05] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative z-10 flex h-full flex-col justify-between gap-12 p-8 text-white sm:p-12 lg:p-16">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 shadow-[0_12px_30px_-20px_rgba(255,255,255,0.8)] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Face recognition-powered gallery
              </span>
              <h1 className="whitespace-pre-wrap text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
                {heroTitle}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
                {heroDescription}
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {heroAccentHighlights.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 shadow-[0_10px_35px_-22px_rgba(255,255,255,0.75)] backdrop-blur"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-[0_18px_55px_-25px_rgba(59,130,246,0.95)] transition hover:bg-primary/90 hover:shadow-[0_20px_60px_-24px_rgba(59,130,246,0.9)]"
                >
                  <Link href="/contact">Request a demo</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/60 bg-white/10 px-8 text-base font-semibold text-white shadow-[0_14px_40px_-28px_rgba(15,23,42,0.65)] backdrop-blur hover:border-white/80 hover:bg-white/20"
                >
                  <Link href="/events">Explore live gallery</Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={fadeIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
          className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px]"
        >
          <div className="space-y-6">
            <div className="grid gap-4 rounded-3xl border border-border/50 bg-card/70 p-6 backdrop-blur lg:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-background/90 via-background/60 to-primary/10 p-6 text-center shadow-[0_28px_90px_-60px_rgba(59,130,246,0.75)]"
                >
                  <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                  <p className="text-3xl font-semibold tracking-tight text-primary drop-shadow-sm sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs font-medium uppercase tracking-wide">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="grid gap-5 sm:grid-cols-2"
            >
              {uspHighlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="group relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-background/95 via-primary/5 to-secondary/10 p-6 shadow-[0_32px_90px_-55px_rgba(59,130,246,0.7)] transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-[0_32px_95px_-50px_rgba(59,130,246,0.9)]"
                >
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_15px_40px_-30px_rgba(59,130,246,0.7)]">
                    <highlight.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold leading-tight">
                    {highlight.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    {highlight.description}
                  </p>
                  <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-background opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
            className="group relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-background/95 via-background/80 to-primary/15 p-6 shadow-[0_40px_120px_-60px_rgba(59,130,246,0.75)] backdrop-blur"
          >
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="pointer-events-none absolute -right-16 top-24 h-40 w-40 rounded-full bg-primary/25 blur-[120px] transition-opacity duration-300 group-hover:opacity-90" />
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Search className="h-5 w-5" />
              Jump into your gallery
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Choose your event and bib number to open a personalized gallery.
            </p>
            <form onSubmit={handleSearch} className="mt-6 space-y-5">
              {eventsQuery.isLoading ? (
                <EventSelectSkeleton />
              ) : (
                <div className="space-y-3">
                  <label className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    <Trophy className="h-4 w-4" />
                    Select event
                  </label>
                  <Select
                    value={selectedEventId}
                    onValueChange={setSelectedEventId}
                  >
                    <SelectTrigger
                      disabled={events.length === 0}
                      className="border-border/70 h-14 w-full rounded-2xl bg-background/80 text-sm font-medium"
                    >
                      <SelectValue
                        placeholder={
                          events.length === 0
                            ? "No events available"
                            : "Choose an event"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {events.length > 0 &&
                        events.map((event) => (
                          <SelectItem
                            key={event.event_id}
                            value={event.event_id}
                            className="!h-12"
                          >
                            {event.event_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <Search className="h-4 w-4" />
                  Bib number
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 1234"
                  value={bibNumber}
                  onChange={(e) => setBibNumber(e.target.value)}
                  disabled={events.length === 0}
                  className="border-border/70 h-14 rounded-2xl bg-background/80 text-sm font-medium md:text-lg"
                  style={{ fontSize: "15px" }}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 w-full rounded-2xl text-base font-semibold shadow-lg hover:shadow-xl"
                disabled={!bibNumber.trim() || !selectedEventId}
              >
                <Search className="mr-2 h-5 w-5" />
                Find my photos
              </Button>
            </form>

            <p className="text-muted-foreground mt-4 text-xs">
              Don&apos;t know your bib?
              <Link
                href="/events"
                className="text-primary pl-1 font-medium underline-offset-4 hover:underline"
              >
                Browse all events
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </section>

      <section className="container mx-auto px-4 py-24 sm:px-6 md:px-8">
        <motion.div
          className="grid gap-12 xl:grid-cols-[420px_minmax(0,1fr)] xl:items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="space-y-6">
            <span className="text-primary inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Problem → Solution
            </span>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              SnapRace solves the biggest headaches for organizers and runners
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The number-one post-race question is “Where are my photos?” SnapRace blends face recognition and race data to automate photo discovery, results, and reporting.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {painPoints.map((item) => (
              <motion.div
                key={item.title}
                variants={fadeIn}
                transition={{ duration: 0.5 }}
                className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="bg-muted/30">
        <div className="container mx-auto px-4 py-24 sm:px-6 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="grid gap-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center"
          >
            <div className="space-y-10">
              <div className="space-y-4">
                <span className="text-primary inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase">
                  <Sparkles className="h-4 w-4" /> Core features
                </span>
                <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                  Face recognition builds personalized galleries the moment you upload
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Photos are matched in real time using Rekognition and paired with split data to recreate every step of the race.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-3xl border border-border/60 bg-background/80 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Live uploads</h3>
                  <p className="text-muted-foreground mt-3 text-sm">
                    Photographers upload on-site and SnapRace instantly runs recognition and sends alerts to runners.
                  </p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Data-driven recommendations</h3>
                  <p className="text-muted-foreground mt-3 text-sm">
                    Missed shots resurface automatically, matched by timing and location data.
                  </p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Sponsor activation</h3>
                  <p className="text-muted-foreground mt-3 text-sm">
                    Targeted CTAs and offers personalize the download journey and amplify sponsor campaigns.
                  </p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Team & community view</h3>
                  <p className="text-muted-foreground mt-3 text-sm">
                    Auto-generated team galleries and highlight reels ignite community sharing.
                  </p>
                </div>
              </div>
            </div>

            <motion.div
              variants={fadeInUp}
              transition={{ delay: 0.15, duration: 0.7, ease: "easeOut" }}
              className="relative flex aspect-[4/5] w-full max-w-md items-center justify-center overflow-hidden rounded-[32px] border border-border/60 bg-background/60 p-6 shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
              <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 rounded-[28px] border border-border/60 bg-card/80 p-6 text-center">
                <div className="relative h-48 w-full overflow-hidden rounded-3xl bg-muted">
                  <Image
                    src="https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200"
                    alt="Runner placeholder image"
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 400px, 100vw"
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium uppercase tracking-wide text-primary">
                    Face recognition in progress
                  </p>
                  <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full w-full origin-left rounded-full bg-primary"
                      animate={{ scaleX: [0.15, 1, 0.5] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Uploads are organized automatically while personalized galleries build in the background.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-left text-sm">
                  <Sparkles className="text-primary h-5 w-5" />
                  <span>300 new photos are landing in your gallery</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-24 sm:px-6 md:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center"
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="text-primary inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase">
                <PlayCircle className="h-4 w-4" /> Live gallery demo
              </span>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Video, highlight reels, and stories on a single page
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Upload finish-line footage and SnapRace generates thumbnails and segment tags automatically. Runners jump straight to their moments when they enter a bib number.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Aftermovie slot</h3>
                <p className="text-muted-foreground mt-3 text-sm">
                  Organizers upload featured videos with dynamic thumbnails and configurable CTAs.
                </p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Custom CTAs</h3>
                <p className="text-muted-foreground mt-3 text-sm">
                  Drive downloads, donations, or next-race signups with tailored action buttons.
                </p>
              </div>
            </div>
          </div>

          <motion.div
            variants={fadeInUp}
            transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/60 p-4 shadow-xl"
          >
            <div className="relative aspect-video overflow-hidden rounded-3xl bg-muted">
              <Image
                src="https://images.unsplash.com/photo-1526232769889-ff5c5a0f84ce?q=80&w=1600"
                alt="Highlight video placeholder"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 480px, 100vw"
              />
              <Button
                size="lg"
                className="bg-primary text-primary-foreground absolute inset-0 m-auto h-16 w-16 rounded-full p-0 shadow-lg"
                aria-label="Play video"
              >
                <PlayCircle className="h-8 w-8" />
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Sample aftermovie
                </p>
                <p className="text-lg font-semibold">SnapRace Finish Line Highlights</p>
              </div>
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link href="/events">Preview gallery</Link>
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto px-4 py-24 sm:px-6 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-12"
          >
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-primary inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase">
                <Quote className="h-4 w-4" /> Customer testimonials
              </span>
              <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                Proof from race-day partners and runners alike
              </h2>
              <p className="text-muted-foreground mt-4 text-sm sm:text-base">
                Leading marathons, trail runs, and corporate wellness races rely on SnapRace to elevate the participant journey and streamline operations.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <motion.div
                  key={testimonial.name}
                  variants={fadeIn}
                  transition={{ duration: 0.5 }}
                  className="flex h-full flex-col justify-between rounded-3xl border border-border/60 bg-card/70 p-8 text-left shadow-sm"
                >
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    “{testimonial.quote}”
                  </p>
                  <div className="mt-6 border-t border-border/40 pt-4">
                    <p className="text-sm font-semibold">{testimonial.name}</p>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      {testimonial.role}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-background to-secondary/20" />
        <div className="container mx-auto flex flex-col items-center gap-8 px-4 py-24 text-center sm:px-6 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-2xl space-y-4"
          >
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Reimagine your post-race experience with SnapRace
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Request a demo and our onboarding team will prepare your event data and galleries within 14 days.
            </p>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/contact">Request a demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8">
              <Link href="/events">Explore live gallery</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
