"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface FacialRecognitionConsentModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when user agrees to facial recognition */
  onAgree: () => void;
  /** Callback when user denies consent */
  onDeny?: () => void;
  /** Event name for context */
  eventName?: string;
  /** Whether this is a required consent (affects button text) */
  isRequired?: boolean;
}

export function FacialRecognitionConsentModal({
  isOpen,
  onClose,
  onAgree,
  onDeny,
  eventName,
  isRequired = false,
}: FacialRecognitionConsentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAgree = async () => {
    setIsProcessing(true);
    try {
      onAgree();
      onClose();
    } catch (error) {
      console.error("Failed to process consent:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = () => {
    onDeny?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[85vh] w-[95vw] max-w-2xl overflow-y-auto sm:w-full lg:min-w-[600px]"
        style={{
          scrollbarWidth: "thin",
        }}
      >
        <DialogHeader className="space-y-2 sm:space-y-3">
          <DialogTitle className="text-lg sm:text-xl">
            Facial Recognition Consent
          </DialogTitle>
          <DialogDescription className="md:text-md text-xs leading-relaxed sm:text-base">
            To find your photos, SnapRace will scan the geometry of the face in
            your selfie. For more details, please review our{" "}
            <Link
              href="/privacy-policy"
              className="font-medium text-blue-600 hover:underline"
            >
              Privacy Policy
            </Link>
            .<br />
            Photos are for personal use only — no commercial use allowed.
            <br />
            Please credit photographers when sharing.
          </DialogDescription>
        </DialogHeader>

        {/* Minimal, simplified content only */}

        <DialogFooter className="flex flex-col gap-2 pt-3 sm:flex-row sm:gap-3 sm:pt-4 lg:justify-center">
          {/* <Button
            variant="outline"
            onClick={handleDeny}
            disabled={isProcessing}
            className="order-2 h-10 text-sm sm:order-1 sm:h-11 sm:text-base"
          >
            {isRequired ? "Cancel" : "No Thanks"}
          </Button> */}
          <Button
            onClick={handleAgree}
            disabled={isProcessing}
            className="order-1 h-10 min-w-[120px] text-sm sm:order-2 sm:h-11 sm:min-w-[140px] sm:text-base"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="border-background h-3 w-3 animate-spin rounded-full border-2 border-t-transparent sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">Processing...</span>
              </div>
            ) : (
              "I Agree & Upload"
            )}
          </Button>
        </DialogFooter>

        {isRequired && (
          <p className="text-muted-foreground mt-3 text-xs sm:mt-4 sm:text-sm">
            Facial recognition consent is required to use our selfie search
            feature and find your photos automatically.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
