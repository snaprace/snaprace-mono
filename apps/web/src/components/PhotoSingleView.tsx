"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useSwipeable } from "react-swipeable";
import { X, ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/ShareDialog";
import { trackPhotoDownload } from "@/lib/analytics";
import {
  extractInstagramId,
  getInstagramProfileUrl,
} from "@/utils/photographerUtils";

import {
  generatePhotoFilename,
  getNextPhotoIndex,
  getPreviousPhotoIndex,
  downloadPhotoEnhanced,
} from "@/utils/photo";
import { isMobileDevice } from "@/utils/device";

interface PhotoSingleViewProps {
  isOpen: boolean;
  onClose: () => void;
  photos: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  event?: string;
  bibNumber?: string;
  onPhotoChange?: (index: number) => void;
  selfieMatchedSet?: Set<string>;
  organizerId?: string;
}

export function PhotoSingleView({
  isOpen,
  onClose,
  photos,
  currentIndex,
  onIndexChange,
  event,
  bibNumber,
  onPhotoChange,
  selfieMatchedSet,
  organizerId,
}: PhotoSingleViewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  // Swipe handlers (react-swipeable will manage touch events

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sequential navigation (row-based: 1→2→3→4→5...)
  const handlePrevious = useCallback(() => {
    const newIndex = getPreviousPhotoIndex(currentIndex, photos.length);
    onIndexChange(newIndex);
    onPhotoChange?.(newIndex);
  }, [currentIndex, photos.length, onIndexChange, onPhotoChange]);

  const handleNext = useCallback(() => {
    const newIndex = getNextPhotoIndex(currentIndex, photos.length);
    onIndexChange(newIndex);
    onPhotoChange?.(newIndex);
  }, [currentIndex, photos.length, onIndexChange, onPhotoChange]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") handlePrevious();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") handleNext();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrevious, handleNext]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Animations removed

  // Reset image loaded state when photo changes
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  const currentPhoto = photos[currentIndex];
  const filename = generatePhotoFilename(event ?? "", bibNumber, currentIndex);

  console.log("currentPhoto", currentPhoto);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const swipeable = useSwipeable({
    onSwipedLeft: handleNext,
    onSwipedRight: handlePrevious,
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
    delta: 40,
  });
  const { ...swipeHandlers } = swipeable;

  if (!isOpen) return null;
  if (!currentPhoto) return null;

  return (
    <div {...swipeHandlers} className="fixed inset-0 z-50 bg-white">
      {/* Single View Content Layer */}
      <div className="relative h-full w-full">
        {/* Header with controls */}
        <div className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-gray-700 hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </Button>

          <div className="text-sm font-medium text-gray-700">
            {currentIndex + 1} / {photos.length}
          </div>

          <div className="flex items-center gap-2">
            <ShareDialog
              photoUrl={currentPhoto}
              filename={filename}
              isMobile={isMobile}
              shareOptions={{ organizerId, eventId: event, bibNumber }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-700 hover:bg-gray-100"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </ShareDialog>

            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                const result = await downloadPhotoEnhanced(
                  currentPhoto,
                  filename,
                  isMobile,
                );

                if (result.success) {
                  trackPhotoDownload({
                    event_id: event || "",
                    bib_number: bibNumber || "",
                    download_type: "single",
                    photo_count: 1,
                    device_type: isMobile ? "mobile" : "desktop",
                    download_method: result.method,
                  });
                  switch (result.method) {
                    case "native_share":
                      toast.success("Shared to save on device!");
                      break;
                    case "new_tab":
                      toast.info("Opened in new tab. Use browser save.");
                      break;
                    case "proxy":
                    case "direct":
                      toast.success("Photo download started!");
                      break;
                    case "newTab":
                      toast.info(
                        "Photo opened in new tab. Right-click to save.",
                      );
                      break;
                  }
                } else {
                  toast.error("Unable to download photo.");
                }
              }}
              className="text-gray-700 hover:bg-gray-100"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Desktop navigation arrows - appear on hover over left/right 1/3 */}
        {!isMobile && photos.length > 1 && (
          <>
            <div
              className="group absolute top-0 bottom-0 left-0 z-10 w-1/3 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
            >
              <div className="absolute top-1/2 left-4 -translate-y-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevious}
                  className="h-12 w-12 text-gray-700 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
                  disabled={false}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              </div>
              {/* Prevent clicks on the header close/share/download from bubbling to this zone */}
              <div
                className="absolute top-0 right-0 left-0 h-16"
                style={{ pointerEvents: "none" }}
              />
            </div>

            <div
              className="group absolute top-0 right-0 bottom-0 z-10 w-1/3 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
            >
              <div className="absolute top-1/2 right-4 -translate-y-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  className="h-12 w-12 text-gray-700 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
                  disabled={false}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </div>
              <div
                className="absolute top-0 right-0 left-0 h-16"
                style={{ pointerEvents: "none" }}
              />
            </div>
          </>
        )}

        {/* Main image container */}
        <div
          className="flex h-full w-full items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            ref={imageRef}
            className="relative inline-block"
            style={{
              transformOrigin: "center",
            }}
          >
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-700" />
              </div>
            )}

            <Image
              src={currentPhoto}
              alt={`Photo ${currentIndex + 1}`}
              width={1200}
              height={800}
              className="h-auto max-h-[85vh] w-auto max-w-[90vw] object-contain"
              onLoad={() => setImageLoaded(true)}
              priority
              unoptimized
            />
            {/* Selfie Badge - Top Left */}
            {selfieMatchedSet?.has(currentPhoto) && (
              <div className="absolute top-2 left-2 z-20">
                <Badge variant="default">
                  <span className="text-xs">Selfie</span>
                </Badge>
              </div>
            )}

            {/* Photographer Badge - Bottom Left */}
            {(() => {
              const instagramId = extractInstagramId(currentPhoto);
              if (instagramId) {
                return (
                  <div className="absolute bottom-2 left-2 z-20">
                    <a
                      href={getInstagramProfileUrl(instagramId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block"
                    >
                      <div className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-white shadow-sm transition-opacity hover:opacity-90">
                        <span className="text-xs font-medium">
                          @{instagramId}
                        </span>
                      </div>
                    </a>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* Mobile-specific bottom info */}
        {isMobile && (
          <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-gray-100/80 to-transparent p-4 text-center">
            <p className="text-sm text-gray-600">
              {(() => {
                const instagramId = extractInstagramId(currentPhoto);
                if (instagramId) {
                  // Extract actual filename from URL
                  const urlFilename = decodeURIComponent(
                    currentPhoto.split("/").pop() || "",
                  );
                  const atInstagram = `@${instagramId}`;

                  // Check if filename contains @instagramId
                  if (urlFilename.includes(atInstagram)) {
                    const parts = urlFilename.split(atInstagram);

                    return (
                      <>
                        {parts[0]}
                        <a
                          href={getInstagramProfileUrl(instagramId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-block text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {atInstagram}
                        </a>
                        {parts[1]}
                      </>
                    );
                  }
                  return urlFilename;
                }
                return filename;
              })()}
            </p>
          </div>
        )}

        {/* Mobile: swipe gestures handle navigation; no on-screen chevrons */}
      </div>
    </div>
  );
}
