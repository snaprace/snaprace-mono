"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, X } from "lucide-react";
import {
  FacebookShareButton,
  TwitterShareButton,
  WhatsappShareButton,
  FacebookIcon,
  TwitterIcon,
  ThreadsShareButton,
  WhatsappIcon,
  ThreadsIcon,
} from "react-share";
import {
  generateShareablePhotoUrl,
  sharePhotoWithOptions,
} from "@/utils/photo";
import { toast } from "sonner";
import {
  trackSocialShareClick,
  trackShareComplete,
  trackShareLinkCopy,
} from "@/lib/analytics";
import { useTranslations } from "next-intl";

interface ShareMenuProps {
  photoUrl: string;
  filename: string;
  isMobile: boolean;
  children: React.ReactNode;
  shareOptions?: {
    organizerId?: string;
    eventId?: string;
    bibNumber?: string;
    baseUrl?: string;
  };
}

export function ShareMenu({
  photoUrl,
  filename,
  isMobile,
  children,
  shareOptions,
}: ShareMenuProps) {
  const t = useTranslations("toast");
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shareableUrl = generateShareablePhotoUrl(photoUrl, shareOptions);

  // Extract analytics parameters
  const eventId = shareOptions?.eventId || "";
  const bibNumber = shareOptions?.bibNumber || "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      // Track successful link copy
      if (eventId) {
        trackShareLinkCopy(eventId, bibNumber, true);
      }
      toast.success(t("linkCopied"));
      setIsOpen(false);
    } catch {
      // Track failed link copy
      if (eventId) {
        trackShareLinkCopy(eventId, bibNumber, false);
      }
      toast.error(t("linkCopyFailed"));
    }
  };

  const handleMoreShare = async () => {
    // Track "More" button click
    if (eventId) {
      trackSocialShareClick(eventId, bibNumber, "more");
    }

    const result = await sharePhotoWithOptions(
      photoUrl,
      shareableUrl,
      filename,
      isMobile,
    );

    if (result.success) {
      // Track successful share
      if (eventId) {
        trackShareComplete(eventId, bibNumber, result.method || "more", true);
      }

      switch (result.method) {
        case "native_file":
          toast.success(t("sharedWithFile"));
          break;
        case "native_url":
          toast.success(t("sharedSuccess"));
          break;
        case "clipboard":
          toast.success(t("linkCopied"));
          break;
      }
    } else if (result.method !== "cancelled") {
      // Track failed share (only if not cancelled)
      if (eventId) {
        trackShareComplete(eventId, bibNumber, "more", false);
      }
      toast.error(t("shareFailed"));
    }

    setIsOpen(false);
  };

  const handleSocialShare = (platform: string) => {
    // Track social platform click
    if (eventId) {
      trackSocialShareClick(eventId, bibNumber, platform);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative z-50" ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{children}</div>

      {isOpen && (
        <div className="absolute right-0 bottom-full z-50 mb-2 w-64 rounded-lg border bg-white p-4 shadow-lg">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">SHARE</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Copy Link */}
          <div className="mb-4 flex items-center gap-2">
            <input
              type="text"
              value={shareableUrl}
              readOnly
              className="flex-1 rounded border bg-gray-50 px-3 py-2 text-sm text-gray-600"
            />
            <button
              onClick={handleCopyLink}
              className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              COPY
            </button>
          </div>

          {/* Social Share Icons */}
          <div className="mb-4 grid grid-cols-4 gap-3">
            {/* Messenger */}
            <div className="flex flex-col items-center">
              <div
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-blue-600"
                onClick={() => handleSocialShare("messenger")}
              >
                <svg
                  className="h-6 w-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.477 2 2 6.145 2 11.5c0 2.438.895 4.664 2.366 6.362V22l3.942-2.171C9.474 20.252 10.714 20.5 12 20.5c5.523 0 10-4.145 10-9.5S17.523 2 12 2zm1.2 12.8L11 12.4 8.8 14.8 6 11.5l2.2 2.4L11 11.5l2.2 2.4L16 11.5l-2.8 3.3z" />
                </svg>
              </div>
              <span className="mt-1 text-xs text-gray-600">Messenger</span>
            </div>

            {/* WhatsApp */}
            <div className="flex flex-col items-center">
              <WhatsappShareButton
                url={shareableUrl}
                title="Check out this race photo!"
                onClick={() => handleSocialShare("whatsapp")}
              >
                <WhatsappIcon size={48} round />
                <span className="mt-1 text-xs text-gray-600">WhatsApp</span>
              </WhatsappShareButton>
            </div>

            {/* Facebook */}
            <div className="flex flex-col items-center">
              <FacebookShareButton
                url={shareableUrl}
                onClick={() => handleSocialShare("facebook")}
              >
                <FacebookIcon size={48} round />
                <span className="mt-1 text-xs text-gray-600">Facebook</span>
              </FacebookShareButton>
            </div>

            {/* Email */}
            <div className="flex flex-col items-center">
              <a
                href={`mailto:?subject=Race Photo&body=Check out this race photo: ${shareableUrl}`}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-600"
                onClick={() => handleSocialShare("email")}
              >
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </a>
              <span className="mt-1 text-xs text-gray-600">Email</span>
            </div>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-4 gap-3">
            {/* X (Twitter) */}
            <div className="flex flex-col items-center">
              <TwitterShareButton
                url={shareableUrl}
                title="Check out this race photo!"
                onClick={() => handleSocialShare("twitter")}
              >
                <TwitterIcon size={48} round />
                <span className="mt-1 text-xs text-gray-600">X (Twitter)</span>
              </TwitterShareButton>
            </div>

            {/* Pinterest */}
            <div className="flex flex-col items-center">
              <div
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-red-600"
                onClick={() => handleSocialShare("pinterest")}
              >
                <svg
                  className="h-6 w-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.805-2.425 1.809-2.425.853 0 1.264.641 1.264 1.408 0 .858-.546 2.14-.828 3.33-.236.995.499 1.807 1.481 1.807 1.778 0 3.144-1.874 3.144-4.579 0-2.394-1.72-4.068-4.177-4.068-2.845 0-4.515 2.135-4.515 4.34 0 .859.331 1.781.744 2.281a.3.3 0 01.069.288l-.278 1.133c-.044.183-.145.223-.334.135-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.97-.527-2.297-1.155l-.624 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                </svg>
              </div>
              <span className="mt-1 text-xs text-gray-600">Pinterest</span>
            </div>

            {/* Threads */}
            <div className="flex flex-col items-center">
              <ThreadsShareButton
                url={shareableUrl}
                title="Check out this race photo!"
                onClick={() => handleSocialShare("threads")}
              >
                <ThreadsIcon size={48} round />
                <span className="mt-1 text-xs text-gray-600">Threads</span>
              </ThreadsShareButton>
            </div>

            {/* More */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleMoreShare}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700"
              >
                <MoreHorizontal className="h-6 w-6 text-white" />
              </button>
              <span className="mt-1 text-xs text-gray-600">More</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
