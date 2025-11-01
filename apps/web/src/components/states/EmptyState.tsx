"use client";

import { Camera, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      {icon && (
        <div className="mb-6 flex justify-center">
          <div className="bg-muted rounded-full p-4">{icon}</div>
        </div>
      )}
      <h3 className="text-foreground mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground mx-auto mb-6 max-w-md">{message}</p>
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NoEventsState() {
  return (
    <EmptyState
      icon={<Calendar className="text-muted-foreground h-10 w-10" />}
      title="No Events Available"
      message="There are no events available at the moment. Please check back later."
    />
  );
}

export function NoPhotosState({
  isAllPhotos = false,
  bibNumber = "",
  onViewAllPhotos,
}: {
  isAllPhotos?: boolean;
  bibNumber?: string;
  onViewAllPhotos?: () => void;
}) {
  if (isAllPhotos) {
    return (
      <EmptyState
        icon={<Camera className="text-muted-foreground h-10 w-10" />}
        title="No Photos Available"
        message="Photos for this event haven't been uploaded yet. Please check back later."
      />
    );
  }

  return (
    <EmptyState
      icon={<User className="text-muted-foreground h-10 w-10" />}
      title="No Photos Found"
      message={`No photos found for bib number #${bibNumber}. Please try a different bib number.`}
      action={
        onViewAllPhotos
          ? {
              label: "View All Event Photos",
              onClick: onViewAllPhotos,
            }
          : undefined
      }
    />
  );
}
