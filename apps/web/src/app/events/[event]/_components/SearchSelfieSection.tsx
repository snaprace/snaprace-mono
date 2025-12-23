"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import {
  trackSelfieStart,
  trackSelfieUpload,
  trackSelfieResults,
  trackSelfieError,
  trackSelfieRetry,
  trackSelfieConsentOpen,
  trackSelfieConsentDecision,
} from "@/lib/analytics";
import { resizeImage } from "@/utils/photo";
import { FacialRecognitionConsentModal } from "@/components/modals/FacialRecognitionConsentModal";
import {
  storeFacialRecognitionConsent,
  hasFacialRecognitionConsent,
} from "@/lib/consent-storage";
import { Info } from "lucide-react";

interface SearchSelfieSectionProps {
  eventId: string;
  organizerId: string;
  eventName: string;
  bib?: string;
  onPhotosFound: (photos: Photo[] | null) => void; // null means reset/clear
}

export function SearchSelfieSection({
  eventId,
  organizerId,
  eventName,
  bib,
  onPhotosFound,
}: SearchSelfieSectionProps) {
  const t = useTranslations("selfieSearch");
  const tCommon = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const fileRef = useRef<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [showNoMatches, setShowNoMatches] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(uploadedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [uploadedFile]);

  const searchSelfieMutation = api.photos.searchBySelfie.useMutation({
    onSuccess: (data) => {
      const latencyMs = Math.round(performance.now() - startTimeRef.current);
      const matches = data.photos || [];
      setMatchedCount(matches.length);
      setIsUploading(false);

      trackSelfieUpload({
        event_id: eventId,
        bib_number: bib || "",
        success: true,
        matched_photos: matches.length,
        latency_ms: latencyMs,
        file_type: fileRef.current?.type,
        file_size_kb: fileRef.current
          ? Math.round(fileRef.current.size / 1024)
          : 0,
      });

      trackSelfieResults(eventId, bib || "", matches.length, {
        latency_ms: latencyMs,
      });

      if (matches.length === 0) {
        setShowNoMatches(true);
        onPhotosFound([]); // Empty array to indicate "search done but no results" if needed, or handle in UI
        toast.info(t("noMatchingPhotos"));
      } else {
        setShowNoMatches(false);
        const mappedPhotos: Photo[] = matches.map((p) => ({
          ...p,
          isSelfieMatch: true,
          organizerId: p.orgId,
        }));

        onPhotosFound(mappedPhotos);
        toast.success(t("foundMatchingPhotos", { count: matches.length }));
      }
    },
    onError: (error) => {
      console.error("Selfie search error:", error);
      setIsUploading(false);
      setHasError(true);

      trackSelfieUpload({
        event_id: eventId,
        bib_number: bib || "",
        success: false,
      });
      trackSelfieError(
        eventId,
        bib || "",
        error instanceof Error ? error.message : "Unknown error",
      );

      toast.error(t("failedToProcess"));
    },
  });

  const handleLabelClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (hasFacialRecognitionConsent(eventId)) {
      inputRef.current?.click();
    } else {
      trackSelfieConsentOpen(eventId, bib || "");
      setIsConsentModalOpen(true);
    }
  };

  const handleConsentAgree = () => {
    storeFacialRecognitionConsent(true, eventId);
    setIsConsentModalOpen(false);
    trackSelfieConsentDecision(eventId, bib || "", true);

    // Slight delay to ensure modal is closed before file picker opens
    setTimeout(() => {
      inputRef.current?.click();
    }, 100);
  };

  const handleConsentDeny = () => {
    setIsConsentModalOpen(false);
    trackSelfieConsentDecision(eventId, bib || "", false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setShowNoMatches(false);
    setHasError(false);
    setMatchedCount(0);
    onPhotosFound(null); // Reset parent state

    // Validate file size (e.g., 10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadedFile(null); // Reset file state
      fileRef.current = null;
      if (inputRef.current) {
        inputRef.current.value = ""; // Reset file input
      }
      toast.error(t("fileTooLarge"));
      return;
    }

    // Only set file if validation passes
    setUploadedFile(file);
    fileRef.current = file;
    setIsUploading(true);

    try {
      // Resize and compress image before upload
      // Use 800px max width and 0.8 quality for optimal performance
      const base64String = await resizeImage(file, {
        maxWidth: 800,
        quality: 0.8,
      });

      startTimeRef.current = performance.now();
      trackSelfieStart(
        eventId,
        bib || "",
        file.type,
        Math.round(file.size / 1024),
      );

      // Call API
      searchSelfieMutation.mutate({
        image: base64String,
        organizerId,
        eventId,
        bib, // Pass bib number if available
      });
    } catch (error) {
      console.error("Failed to process image:", error);
      setIsUploading(false);
      setHasError(true);
      setUploadedFile(null);
      fileRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
      toast.error(t("failedToProcessImage"));
    }
  };

  const handleRetry = () => {
    trackSelfieRetry(eventId, bib || "");
    setUploadedFile(null);
    fileRef.current = null;
    setMatchedCount(0);
    setShowNoMatches(false);
    setHasError(false);
    onPhotosFound(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const uploadDisabled = isUploading;

  return (
    <section className="border-border/60 bg-background/95 overflow-hidden rounded-2xl">
      <div className="grid gap-4">
        <div className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <input
                id="selfie-upload"
                type="file"
                accept="image/*"
                ref={inputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={uploadDisabled}
              />
              <label
                htmlFor="selfie-upload"
                className="block"
                onClick={!uploadedFile ? handleLabelClick : undefined}
              >
                <div
                  className={`group border-muted-foreground/30 relative overflow-hidden rounded-xl border border-dashed p-6 transition-all ${
                    uploadDisabled
                      ? "bg-muted/10 cursor-not-allowed opacity-60"
                      : uploadedFile
                        ? "border-primary/50 bg-primary/5 cursor-default"
                        : "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                  }`}
                >
                  {isUploading ? (
                    <div className="bg-background/80 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="border-primary/30 border-t-primary h-10 w-10 animate-spin rounded-full border-4" />
                        <p className="text-muted-foreground text-xs">
                          {t("searchingPhotos")}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Success UI - only show when we have matches */}
                  {uploadedFile &&
                  !isUploading &&
                  !hasError &&
                  !showNoMatches &&
                  matchedCount > 0 ? (
                    <div className="bg-background/90 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                          ✓
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">{t("selfieMatched")}</p>
                          <p className="text-muted-foreground text-xs">
                            {matchedCount !== 1
                              ? t("foundPhotosPlural", { count: matchedCount })
                              : t("foundPhotos", { count: matchedCount })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRetry();
                          }}
                        >
                          {t("uploadAnother")}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="relative h-20 w-20">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="Preview"
                          width={80}
                          height={80}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <Image
                          src="/images/selfie-upload.png"
                          alt="Upload selfie"
                          width={80}
                          height={80}
                          className="transition-all group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {uploadedFile
                          ? uploadedFile.name
                          : t("clickToSearch")}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {uploadedFile
                          ? `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB`
                          : t("fileFormat")}
                      </p>
                    </div>
                  </div>
                </div>
              </label>
            </div>

            {showNoMatches || hasError ? (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800/80 dark:bg-yellow-900/20 dark:text-yellow-200">
                <div className="flex items-start gap-2">
                  <Info size={16} className="my-auto" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {hasError ? t("processingError") : t("noMatchesTitle")}
                    </p>
                    <p className="text-xs">
                      {hasError
                        ? t("processingErrorMessage")
                        : t("noMatchesMessage")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRetry}
                    className="ml-auto text-xs"
                  >
                    {tCommon("tryAgain")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <FacialRecognitionConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onAgree={handleConsentAgree}
        onDeny={handleConsentDeny}
        eventName={eventName}
      />
    </section>
  );
}
