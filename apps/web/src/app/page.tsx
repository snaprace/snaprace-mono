"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Trophy,
  Camera,
  Zap,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Star,
  Play,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { EventSelectSkeleton } from "@/components/states/EventsSkeleton";
import { useOrganizationHelper } from "@/hooks/useOrganizationHelper";
import { Footer } from "@/components/Footer";
import { motion, useScroll, useTransform } from "framer-motion";

export default function HomePage() {
  const [bibNumber, setBibNumber] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const router = useRouter();
  const org = useOrganizationHelper();

  const eventsQuery = api.events.getAll.useQuery();
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

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

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" },
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-background via-background to-muted/20 relative overflow-hidden px-4 py-12 sm:py-20 md:py-28">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              x: [0, -30, 0],
              y: [0, -50, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <motion.div
          style={{ opacity, scale }}
          className="container relative z-10 mx-auto max-w-6xl"
        >
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="text-center"
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <motion.span
                className="text-primary inline-flex items-center gap-2 rounded-full border bg-primary/10 px-4 py-2 text-sm font-medium backdrop-blur-sm"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Sparkles className="h-4 w-4" />
                Face recognition-powered gallery
              </motion.span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-foreground mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {org.subdomain ? (
                <>
                  {org.name}
                  <br />
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Relive your race moments
                  </span>
                </>
              ) : (
                <>
                  Every race moment
                  <br />
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    in one place
                  </span>
                </>
              )}
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-muted-foreground mx-auto mb-12 max-w-2xl text-lg sm:text-xl"
            >
              {org.subdomain
                ? org.welcomeMessage
                : "Find your photos and results instantly with face recognition."}
            </motion.p>

            {/* Main Search */}
            <motion.div variants={fadeInUp} className="mx-auto max-w-2xl">
              <form
                onSubmit={handleSearch}
                className="bg-card/50 backdrop-blur-xl rounded-2xl border p-6 shadow-xl sm:p-8"
              >
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Search className="h-5 w-5" />
                    Jump into your gallery
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Choose your event and bib number to open a personalized gallery.
                  </p>
                  {/* Event Selection */}
                  {eventsQuery.isLoading ? (
                    <EventSelectSkeleton />
                  ) : (
                    <div className="space-y-2">
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
                        className="bg-background border-border h-14 w-full text-sm font-medium"
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
                              className="h-14"
                            >
                              {event.event_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Bib Number Input */}
                  <div className="space-y-2">
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
                      className="bg-background border-border h-14 text-base font-medium"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 w-full text-lg font-semibold shadow-lg transition-all hover:shadow-xl"
                    disabled={!bibNumber.trim() || !selectedEventId}
                  >
                    <Search className="mr-2 h-5 w-5" />
                    Find my photos
                  </Button>
                </div>
              </form>

              <p className="text-muted-foreground mt-4 text-sm">
                Don&apos;t know your bib?{" "}
                <Link
                  href="/events"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Browse all events
                </Link>
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Problem & Solution Section */}
      <section className="bg-background border-y py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid gap-12 xl:grid-cols-[420px_minmax(0,1fr)] xl:items-center"
          >
            <motion.div variants={fadeInUp} className="space-y-6">
              <span className="text-primary inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                Problem → Solution
              </span>
              <h2 className="text-foreground text-3xl font-semibold leading-tight sm:text-4xl">
                SnapRace solves the biggest headaches for organizers and runners
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The number-one post-race question is &quot;Where are my photos?&quot; SnapRace blends face recognition and race data to automate photo discovery, results, and reporting.
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
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
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeInUp}
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
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center"
          >
            <motion.div
              variants={fadeInUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
            >
              <Sparkles className="h-4 w-4" />
              Core Features
            </motion.div>
            <motion.h2
              variants={fadeInUp}
              className="text-foreground mb-4 text-3xl font-semibold leading-tight sm:text-4xl"
            >
              Face recognition builds personalized galleries the moment you upload
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-muted-foreground mb-12 leading-relaxed"
            >
              Photos are matched in real time using Rekognition and paired with split data to recreate every step of the race.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-6 sm:grid-cols-2"
          >
            {[
              {
                icon: Camera,
                title: "Live uploads",
                description:
                  "Photographers upload on-site and SnapRace instantly runs recognition and sends alerts to runners.",
                color: "text-blue-500",
                bgColor: "bg-blue-100 dark:bg-blue-900/20",
              },
              {
                icon: Zap,
                title: "Data-driven recommendations",
                description:
                  "Missed shots resurface automatically, matched by timing and location data.",
                color: "text-purple-500",
                bgColor: "bg-purple-100 dark:bg-purple-900/20",
              },
              {
                icon: Trophy,
                title: "Sponsor activation",
                description:
                  "Targeted CTAs and offers personalize the download journey and amplify sponsor campaigns.",
                color: "text-orange-500",
                bgColor: "bg-orange-100 dark:bg-orange-900/20",
              },
              {
                icon: Users,
                title: "Team & community view",
                description:
                  "Auto-generated team galleries and highlight reels ignite community sharing.",
                color: "text-green-500",
                bgColor: "bg-green-100 dark:bg-green-900/20",
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="bg-card group relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-lg"
              >
                <div
                  className={`${feature.bgColor} mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg transition-transform group-hover:scale-110`}
                >
                  <feature.icon className={`${feature.color} h-6 w-6`} />
                </div>
                <h3 className="text-foreground mb-2 text-xl font-semibold">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Visual Showcase Section */}
      <section className="bg-background py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid gap-12 lg:grid-cols-2 lg:items-center"
          >
            <motion.div variants={fadeInUp} className="space-y-6">
              <span className="text-primary inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase">
                <Play className="h-4 w-4" /> Live gallery demo
              </span>
              <h2 className="text-foreground text-3xl font-semibold leading-tight sm:text-4xl">
                Video, highlight reels, and stories on a single page
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Upload finish-line footage and SnapRace generates thumbnails and segment tags automatically. Runners jump straight to their moments when they enter a bib number.
              </p>
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
              <div className="space-y-6">
                {[
                  {
                    step: "01",
                    title: "Select Event",
                    description: "Choose the race event you participated in.",
                  },
                  {
                    step: "02",
                    title: "Enter Bib Number or Upload Selfie",
                    description:
                      "Enter your bib number or upload a selfie.",
                  },
                  {
                    step: "03",
                    title: "View and Download Photos",
                    description:
                      "Review all photos found by AI and download them.",
                  },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    variants={fadeInUp}
                    className="flex gap-4"
                  >
                    <div className="text-primary flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-foreground mb-1 text-lg font-semibold">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {item.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
            >
              {/* Placeholder for video/image */}
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Play className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                  <p className="text-muted-foreground text-sm">
                    Demo Video or Screenshot
                  </p>
                </div>
              </div>
              {/* Replace with actual image/video when available */}
              {/* <Image
                src="/placeholder-demo.jpg"
                alt="SnapRace Demo"
                fill
                className="object-cover"
              /> */}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center"
          >
            <motion.div
              variants={fadeInUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
            >
              <Quote className="h-4 w-4" />
              Customer testimonials
            </motion.div>
            <motion.h2
              variants={fadeInUp}
              className="text-foreground mb-4 text-3xl font-semibold leading-tight sm:text-4xl"
            >
              Proof from race-day partners and runners alike
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-muted-foreground mb-12 text-sm sm:text-base"
            >
              Leading marathons, trail runs, and corporate wellness races rely on SnapRace to elevate the participant journey and streamline operations.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-6 lg:grid-cols-3"
          >
            {[
              {
                name: "Soojin Chung",
                role: "Race Director, Seoul Running Festival",
                content:
                  "We found and shared team photos immediately after the race—participant satisfaction jumped overnight.",
              },
              {
                name: "Minjae Kim",
                role: "Sports Marketing Manager",
                content:
                  "Having results and media in one place cut our sponsor reporting time dramatically.",
              },
              {
                name: "Eunji Park",
                role: "Event Organizer, Trail One",
                content:
                  "Face recognition lets runners self-serve their photos and convert seamlessly into purchases.",
              },
            ].map((testimonial, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="flex h-full flex-col justify-between rounded-3xl border border-border/60 bg-card/70 p-8 text-left shadow-sm"
              >
                <p className="text-muted-foreground text-sm leading-relaxed">
                  &quot;{testimonial.content}&quot;
                </p>
                <div className="mt-6 border-t border-border/40 pt-4">
                  <p className="text-sm font-semibold">
                    {testimonial.name}
                  </p>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    {testimonial.role}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Image Gallery Preview Section */}
      <section className="bg-background py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center"
          >
            <motion.div
              variants={fadeInUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
            >
              <Camera className="h-4 w-4" />
              Photo Gallery
            </motion.div>
            <motion.h2
              variants={fadeInUp}
              className="text-foreground mb-12 text-3xl font-bold sm:text-4xl"
            >
              Your Special Moments
            </motion.h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {Array.from({ length: 8 }).map((_, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
              >
                <div className="flex h-full items-center justify-center">
                  <Camera className="text-muted-foreground h-12 w-12 opacity-50" />
                </div>
                {/* Replace with actual images when available */}
                {/* <Image
                  src={`/placeholder-gallery-${idx + 1}.jpg`}
                  alt={`Gallery image ${idx + 1}`}
                  fill
                  className="object-cover transition-transform group-hover:scale-110"
                /> */}
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="mt-12 text-center"
          >
            <Link href="/events">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground group gap-2"
              >
                View All Gallery
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-16 sm:py-24">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="space-y-6"
          >
            <motion.h2
              variants={fadeInUp}
              className="text-foreground text-3xl font-semibold leading-tight sm:text-4xl"
            >
              Reimagine your post-race experience with SnapRace
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-muted-foreground mx-auto max-w-2xl text-sm sm:text-base"
            >
              Request a demo and our onboarding team will prepare your event data and galleries within 14 days.
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="/contact">Request a demo</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                <Link href="/events">Explore live gallery</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
