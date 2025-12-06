"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ErrorState({ 
  title,
  message,
  onRetry,
  showRetry = true
}: ErrorStateProps) {
  const t = useTranslations("error");
  const displayTitle = title || t("title");
  const displayMessage = message || t("message");

  return (
    <div className="py-12 text-center">
      <div className="mb-4 flex justify-center">
        <div className="bg-destructive/10 p-3 rounded-full">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {displayTitle}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {displayMessage}
      </p>
      {showRetry && onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("tryAgain")}
        </Button>
      )}
    </div>
  );
}

export function SimpleErrorState({ 
  message, 
  onRetry 
}: { 
  message?: string; 
  onRetry?: () => void;
}) {
  const t = useTranslations("error");
  const displayMessage = message || t("failedToLoad");

  return (
    <div className="py-8 text-center">
      <p className="text-destructive mb-4">{displayMessage}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="text-primary hover:underline text-sm"
        >
          {t("tryAgain")}
        </button>
      )}
    </div>
  );
}