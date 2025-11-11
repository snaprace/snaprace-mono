"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { RefObject, ChangeEvent, MouseEvent } from "react";

interface SelfieUploadCardProps {
  bibNumber: string;
  disabled: boolean;
  isUploading: boolean;
  uploadedFile: File | null;
  selfieEnhanced: boolean;
  matchedCount: number;
  showNoMatches: boolean;
  hasError?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onLabelClick: (event: MouseEvent<HTMLLabelElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRetry: () => void;
}

export function SelfieUploadCard({
  bibNumber: _bibNumber,
  disabled,
  isUploading,
  uploadedFile,
  selfieEnhanced,
  matchedCount,
  showNoMatches,
  hasError = false,
  inputRef,
  onLabelClick,
  onFileChange,
  onRetry,
}: SelfieUploadCardProps) {
  const uploadDisabled = disabled || isUploading;

  return (
    <div className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4">
        <div className="space-y-1 text-left">
          <h4 className="text-base font-semibold md:text-lg">
            Face Match Selfie Upload
          </h4>
          <p className="text-muted-foreground text-sm">
            {disabled
              ? "Provide a bib number to enable face matching."
              : "Upload a selfie to find more photos instantly."}
          </p>
        </div>

        <div>
          <input
            id="selfie-upload"
            type="file"
            accept="image/*"
            ref={inputRef}
            onChange={onFileChange}
            className="hidden"
            disabled={uploadDisabled}
          />
          <label
            htmlFor="selfie-upload"
            className="block"
            onClick={onLabelClick}
          >
            <div
              className={`group border-muted-foreground/30 relative overflow-hidden rounded-xl border border-dashed p-6 transition-all ${
                uploadDisabled
                  ? "bg-muted/10 cursor-not-allowed opacity-60"
                  : "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              }`}
            >
              {isUploading ? (
                <div className="bg-background/80 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="border-primary/30 border-t-primary h-10 w-10 animate-spin rounded-full border-4" />
                    <p className="text-muted-foreground text-xs">loading...</p>
                  </div>
                </div>
              ) : null}

              {uploadedFile && selfieEnhanced && !isUploading && !hasError ? (
                <div className="bg-background/90 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                      ✓
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Selfie matched!</p>
                      <p className="text-muted-foreground text-xs">
                        Found {matchedCount} photo
                        {matchedCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRetry();
                      }}
                    >
                      Upload another
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative h-20 w-20">
                  <Image
                    src="/images/selfie-upload.png"
                    alt="Upload selfie"
                    width={80}
                    height={80}
                    className={`${uploadDisabled ? "grayscale" : ""} transition-all`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {disabled
                      ? "Bib number required"
                      : uploadedFile
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
              <span className="mt-0.5 text-lg">!</span>
              <div className="space-y-1">
                <p className="font-medium">No additional photos found.</p>
                <p className="text-xs">
                  Try uploading a different selfie with better lighting or a
                  clearer view of your face.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRetry}
                className="ml-auto text-xs"
              >
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
