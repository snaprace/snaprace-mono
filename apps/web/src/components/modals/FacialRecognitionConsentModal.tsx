"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  onDeny: _onDeny,
  eventName: _eventName,
  isRequired = false,
}: FacialRecognitionConsentModalProps) {
  const t = useTranslations("consent");
  const tCommon = useTranslations("common");
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[85vh] w-[95vw] max-w-2xl overflow-y-auto sm:w-full lg:min-w-[600px]"
        style={{
          scrollbarWidth: "thin",
        }}
      >
        <DialogHeader className="space-y-2 sm:space-y-3">
          <DialogTitle className="text-center text-lg sm:text-xl">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-center text-[10px] leading-relaxed whitespace-pre-wrap md:text-base">
            {t("description")}{" "}
            <Link
              href="/privacy-policy"
              className="font-medium text-blue-600 hover:underline"
            >
              {t("privacyPolicyLink")}
            </Link>
            .<br />
            {t("photoUsage")}
            <br />
            {t("creditPhotographers")}
          </DialogDescription>
        </DialogHeader>

        {/* Minimal, simplified content only */}

        <DialogFooter className="flex flex-col gap-2 pt-3 sm:flex-row sm:gap-3 sm:pt-4 lg:justify-center">
          <Button
            onClick={handleAgree}
            disabled={isProcessing}
            className="order-1 h-10 min-w-[120px] text-sm sm:order-2 sm:h-11 sm:min-w-[140px] sm:text-base"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="border-background h-3 w-3 animate-spin rounded-full border-2 border-t-transparent sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">
                  {tCommon("processing")}
                </span>
              </div>
            ) : (
              t("agreeAndSearch")
            )}
          </Button>
        </DialogFooter>

        {isRequired && (
          <p className="text-muted-foreground mt-3 text-xs sm:mt-4 sm:text-sm">
            {t("requiredNote")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
