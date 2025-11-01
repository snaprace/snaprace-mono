"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ErrorState({ 
  title = "Something went wrong",
  message = "An error occurred while loading the data",
  onRetry,
  showRetry = true
}: ErrorStateProps) {
  return (
    <div className="py-12 text-center">
      <div className="mb-4 flex justify-center">
        <div className="bg-destructive/10 p-3 rounded-full">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {title}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {message}
      </p>
      {showRetry && onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}

export function SimpleErrorState({ 
  message = "Failed to load", 
  onRetry 
}: { 
  message?: string; 
  onRetry?: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <p className="text-destructive mb-4">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="text-primary hover:underline text-sm"
        >
          Try again
        </button>
      )}
    </div>
  );
}