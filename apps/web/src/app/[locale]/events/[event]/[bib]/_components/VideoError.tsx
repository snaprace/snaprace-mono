import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface VideoErrorProps {
  onRetry: () => void;
}

export function VideoError({ onRetry }: VideoErrorProps) {
  return (
    <div className="bg-muted flex aspect-video w-full flex-col items-center justify-center rounded-lg p-6 text-center">
      <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
      <h3 className="text-foreground mb-2 font-semibold">
        Unable to load video
      </h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Please try again later
      </p>
      <Button onClick={onRetry} variant="outline" size="sm">
        Retry
      </Button>
    </div>
  );
}

