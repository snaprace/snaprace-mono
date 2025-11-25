import React from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
  ArrowDownToLine,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Forward,
} from "lucide-react";
import NextJsImage from "./NextJsImage";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import { useImageDownloader } from "@/hooks/useImageDownloader";
import { ShareDialog } from "@/components/ShareDialog";
import { trackPhotoDownload } from "@/lib/analytics";

// Extend module definition for Lightbox
declare module "yet-another-react-lightbox" {
  interface GenericSlide {
    pid?: string;
    blurDataURL?: string;
    eventId?: string;
    organizerId?: string;
  }
}

interface GalleryLightboxProps {
  open: boolean;
  index: number;
  photos: Photo[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onView: (index: number) => void;
  isMobile: boolean;
}

export function GalleryLightbox({
  open,
  index,
  photos,
  onClose,
  onPrev,
  onNext,
  onView,
  isMobile,
}: GalleryLightboxProps) {
  const { downloadImage } = useImageDownloader({ isMobile });
  const currentPhoto = photos[index];
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPhoto) {
      // Extract ULID from pid
      const ulid = currentPhoto.pid;

      trackPhotoDownload({
        event_id: currentPhoto.eventId,
        bib_number: "",
        download_type: "single",
        photo_count: 1,
        device_type: isMobile ? "mobile" : "desktop",
      });

      await downloadImage(
        currentPhoto.src,
        `${currentPhoto.organizerId}-${currentPhoto.eventId}-${ulid}.jpg`,
      );
    }
  };

  return (
    <Lightbox
      open={open}
      index={index}
      close={onClose}
      carousel={{
        padding: isMobile ? 16 : 80,
      }}
      slides={photos.map((photo) => ({
        src: photo.src,
        width: photo.width,
        height: photo.height,
        pid: photo.pid,
        blurDataURL: photo.blurDataURL,
        eventId: photo.eventId,
        organizerId: photo.organizerId,
      }))}
      render={{
        slide: NextJsImage,
        buttonPrev: () => null,
        buttonNext: () => null,
        slideContainer: ({ children }) => (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* Previous Click Area */}
            <div
              className="group"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "33.33%",
                height: "100%",
                cursor: "pointer",
                zIndex: 2,
              }}
              onClick={onPrev}
            >
              {!isMobile && (
                <div className="absolute top-1/2 left-[-10%] -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <ChevronLeftIcon
                    size={30}
                    strokeWidth={1}
                    className="text-gray-500 drop-shadow-md hover:text-gray-800"
                  />
                </div>
              )}
            </div>

            {/* Next Click Area */}
            <div
              className="group"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: "33.33%",
                height: "100%",
                cursor: "pointer",
                zIndex: 2,
              }}
              onClick={onNext}
            >
              {!isMobile && (
                <div className="absolute top-1/2 right-[-10%] -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <ChevronRightIcon
                    size={30}
                    strokeWidth={1}
                    className="text-gray-500 drop-shadow-md hover:text-gray-800"
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                position: "relative",
                zIndex: 1,
              }}
            >
              {children}
            </div>
          </div>
        ),
      }}
      on={{ view: ({ index }) => onView(index) }}
      styles={{
        root: {
          "--yarl__color_backdrop": "#fff",
          "--yarl__button_filter": "none",
          "--yarl__portal_zindex": 1000,
        },
      }}
      animation={{
        fade: 0.4,
        swipe: 0.4,
        navigation: 0.4,
        easing: {
          fade: "cubic-bezier(0.4, 0, 0.2, 1)",
          swipe: "cubic-bezier(0.4, 0, 0.2, 1)",
          navigation: "cubic-bezier(0.4, 0, 0.2, 1)",
        },
      }}
      toolbar={{
        buttons: [
          <button
            key="custom-close"
            className="cursor-pointer rounded-full p-2 text-gray-400 transition-colors duration-300"
            style={{
              position: "fixed",
              top: 20,
              left: isMobile ? 0 : 20,
              zIndex: 1000,
            }}
            onClick={onClose}
          >
            <ArrowLeftIcon size={22} strokeWidth={1.5} />
          </button>,
          <div
            key="actions"
            className="flex gap-2"
            style={{
              position: "fixed",
              top: 20,
              right: isMobile ? 16 : 40,
              zIndex: 1000,
            }}
          >
            <button
              className="flex h-10 w-10 cursor-pointer items-center justify-center text-gray-400"
              onClick={handleDownload}
            >
              <ArrowDownToLine size={18} strokeWidth={1.5} />
            </button>
            {currentPhoto && (
              <ShareDialog
                pid={currentPhoto.pid ?? ""}
                photoUrl={currentPhoto.src}
                filename={`${currentPhoto.organizerId}-${currentPhoto.eventId}-${currentPhoto.pid}.jpg`}
                isMobile={isMobile}
                shareOptions={{
                  eventId: currentPhoto.eventId,
                  organizerId: currentPhoto.organizerId,
                }}
              >
                <button
                  className="flex h-10 w-10 cursor-pointer items-center justify-center text-gray-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Forward size={18} strokeWidth={1.5} />
                </button>
              </ShareDialog>
            )}
          </div>,
        ],
      }}
    />
  );
}
