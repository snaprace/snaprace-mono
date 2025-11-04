"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Search,
  Trophy,
  Camera,
  Sparkles,
  Download,
  Share2,
  Zap,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
  Star,
  Image as ImageIcon,
  Upload,
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
import { motion } from "framer-motion";

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

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white px-4 py-16 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 sm:py-24 lg:py-32">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-200/20 blur-3xl dark:bg-blue-900/20" />
          <div className="absolute right-0 top-1/4 h-[300px] w-[300px] rounded-full bg-purple-200/20 blur-3xl dark:bg-purple-900/20" />
        </div>

        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
            >
              <Sparkles className="h-4 w-4" />
              Face recognition-powered gallery
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-6 whitespace-pre-wrap text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {heroTitle}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto mb-12 max-w-2xl text-lg text-gray-600 dark:text-gray-300 sm:text-xl"
            >
              {heroDescription}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button
                size="lg"
                className="h-14 w-full bg-blue-600 px-8 text-lg font-semibold hover:bg-blue-700 sm:w-auto"
                asChild
              >
                <Link href="/contact">Request a demo</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 w-full border-2 px-8 text-lg font-semibold sm:w-auto"
                asChild
              >
                <Link href="/events">Explore live gallery</Link>
              </Button>
            </motion.div>

            {/* Hero Image/Video Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="relative mx-auto max-w-5xl"
            >
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-2xl dark:border-gray-800 dark:bg-gray-800">
                <div className="aspect-video w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center text-white">
                      <ImageIcon className="mx-auto mb-4 h-20 w-20 opacity-50" />
                      <p className="text-xl font-semibold">
                        Demo Video / Hero Image
                      </p>
                      <p className="text-sm opacity-75">
                        Replace with actual content
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating elements */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-4 top-8 hidden rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800 lg:block"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Photo Found!
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      12 photos matched
                    </p>
                  </div>
                </div>
              </motion.div>
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
                className="absolute -left-4 top-32 hidden rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800 lg:block"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
                    <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      2.3 seconds
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      AI processing time
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-900">
        <div className="container mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 gap-8 md:grid-cols-3"
          >
            {[
              { label: "Face recognition accuracy", value: "98%", icon: CheckCircle2 },
              { label: "Average search time", value: "12s", icon: Clock },
              { label: "Photos processed monthly", value: "450k", icon: ImageIcon },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <stat.icon className="mx-auto mb-2 h-8 w-8 text-blue-600 dark:text-blue-400" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Problem & Solution Section */}
      <section className="bg-gray-50 px-4 py-20 dark:bg-gray-950 sm:py-24">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <span className="text-primary mb-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:bg-primary/20">
              Problem → Solution
            </span>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl md:text-5xl">
              SnapRace solves the biggest headaches for organizers and runners
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              The number-one post-race question is "Where are my photos?" SnapRace blends face recognition and race data to automate photo discovery, results, and reporting.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-3">
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
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900"
              >
                <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="bg-white px-4 py-20 dark:bg-gray-900 sm:py-24">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <span className="text-primary mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase dark:bg-primary/20">
              <Sparkles className="h-4 w-4" /> Core features
            </span>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl md:text-5xl">
              Face recognition builds personalized galleries the moment you upload
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              Photos are matched in real time using Rekognition and paired with split data to recreate every step of the race.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2">
            {[
              {
                icon: Upload,
                title: "Live uploads",
                description:
                  "Photographers upload on-site and SnapRace instantly runs recognition and sends alerts to runners.",
              },
              {
                icon: Sparkles,
                title: "Data-driven recommendations",
                description:
                  "Missed shots resurface automatically, matched by timing and location data.",
              },
              {
                icon: Trophy,
                title: "Sponsor activation",
                description:
                  "Targeted CTAs and offers personalize the download journey and amplify sponsor campaigns.",
              },
              {
                icon: Users,
                title: "Team & community view",
                description:
                  "Auto-generated team galleries and highlight reels ignite community sharing.",
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-800"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gray-50 px-4 py-20 dark:bg-gray-950 sm:py-24">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <span className="text-primary mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase dark:bg-primary/20">
              <Star className="h-4 w-4" /> Customer testimonials
            </span>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl md:text-5xl">
              Proof from race-day partners and runners alike
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              Leading marathons, trail runs, and corporate wellness races rely on SnapRace to elevate the participant journey and streamline operations.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
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
            ].map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900"
              >
                <p className="mb-6 text-gray-700 dark:text-gray-300">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
                <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">
                    {testimonial.role}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section
        id="search-section"
        className="bg-gradient-to-b from-blue-50 to-white px-4 py-20 dark:from-gray-950 dark:to-gray-900 sm:py-24"
      >
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl md:text-5xl">
              Jump into your gallery
            </h2>
            <p className="mb-12 text-lg text-gray-600 dark:text-gray-400">
              Choose your event and bib number to open a personalized gallery.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-800"
            >
              <form onSubmit={handleSearch} className="space-y-6">
                {/* Event Selection */}
                {eventsQuery.isLoading ? (
                  <EventSelectSkeleton />
                ) : (
                  <div className="space-y-2 text-left">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Trophy className="h-4 w-4" />
                      Select event
                    </label>
                    <Select
                      value={selectedEventId}
                      onValueChange={setSelectedEventId}
                    >
                      <SelectTrigger
                        disabled={events.length === 0}
                        className="h-14 w-full border-gray-300 text-base font-medium dark:border-gray-700"
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
                <div className="space-y-2 text-left">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Search className="h-4 w-4" />
                    Bib number
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. 1234"
                    value={bibNumber}
                    onChange={(e) => setBibNumber(e.target.value)}
                    disabled={events.length === 0}
                    className="h-14 border-gray-300 text-base font-medium dark:border-gray-700"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="h-14 w-full bg-blue-600 text-lg font-semibold hover:bg-blue-700"
                  disabled={!bibNumber.trim() || !selectedEventId}
                >
                  <Search className="mr-2 h-5 w-5" />
                  Find my photos
                </Button>
              </form>

              <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                Don&apos;t know your bib?{" "}
                <Link
                  href="/events"
                  className="font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
                >
                  Browse all events
                </Link>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative overflow-hidden bg-white px-4 py-20 dark:bg-gray-900">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="container mx-auto max-w-4xl text-center"
        >
          <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl md:text-5xl">
            Reimagine your post-race experience with SnapRace
          </h2>
          <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
            Request a demo and our onboarding team will prepare your event data and galleries within 14 days.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-lg">
              <Link href="/contact">Request a demo</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 px-8 text-lg"
            >
              <Link href="/events">Explore live gallery</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
