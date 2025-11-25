"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import { getBlurDataURL } from "@/utils/thumbhash";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const fileRef = useRef<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [showNoMatches, setShowNoMatches] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  const searchSelfieMutation = api.photosV2.searchBySelfie.useMutation({
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
        toast.info("No matching photos found.");
      } else {
        setShowNoMatches(false);
        // 백엔드에서 이미 적절하게 파싱된 Photo 객체 배열을 내려주므로 그대로 사용
        const mappedPhotos: Photo[] = matches.map((p) => ({
          ...p,
          isSelfieMatch: true,
          src: p.url,
          organizerId: p.orgId,
          blurDataURL: getBlurDataURL(p.thumbHash ?? undefined),
        }));

        onPhotosFound(mappedPhotos);
        toast.success(`Found ${matches.length} new matching photos!`);
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

      toast.error("Failed to process selfie. Please try again.");
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
      toast.error("File size too large. Please upload an image under 10MB.");
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
      toast.error("Failed to process image. Please try again.");
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
            <div className="space-y-1 text-left">
              <h4 className="text-base font-semibold md:text-lg">
                Face Match Selfie Upload
              </h4>
              <p className="text-muted-foreground text-sm">
                Upload a selfie to find photos automatically.
              </p>
            </div>

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
                          Searching for matching photos...
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
                          <p className="text-sm font-medium">Selfie matched!</p>
                          <p className="text-muted-foreground text-xs">
                            Found {matchedCount} photo
                            {matchedCount !== 1 ? "s" : ""}
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
                          Upload another
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="relative h-20 w-20">
                      {uploadedFile ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={URL.createObjectURL(uploadedFile)}
                          alt="Preview"
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
                          : "Click to upload your selfie"}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {uploadedFile
                          ? `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB`
                          : "JPG, PNG, or HEIC • Max 10 MB"}
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
                      {hasError ? "Processing Error" : "No matches found"}
                    </p>
                    <p className="text-xs">
                      {hasError
                        ? "Something went wrong. Please try again."
                        : "Try uploading a different selfie with better lighting or a clearer view of your face."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRetry}
                    className="ml-auto text-xs"
                  >
                    Try again
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
