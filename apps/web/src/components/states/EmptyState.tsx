"use client";

import { Camera, Calendar, User } from "lucide-react";
import { useTranslations } from "next-intl";
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
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-6 flex justify-center">
          <div className="bg-muted rounded-full p-4">{icon}</div>
        </div>
      )}
      <h3 className="text-foreground mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground mx-auto mb-6 max-w-md whitespace-pre-wrap">
        {message}
      </p>
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NoEventsState() {
  const t = useTranslations("events");
  return (
    <EmptyState
      icon={<Calendar className="text-muted-foreground h-10 w-10" />}
      title={t("noEventsTitle")}
      message={t("noEventsMessage")}
    />
  );
}

export function NoPhotosState({
  isAllPhotos = false,
  bibNumber = "",
  onViewAllPhotos,
  actionLabel,
}: {
  isAllPhotos?: boolean;
  bibNumber?: string;
  onViewAllPhotos: () => void;
  actionLabel?: string;
}) {
  const t = useTranslations("photos");

  if (isAllPhotos) {
    return (
      <EmptyState
        icon={<Camera className="text-muted-foreground h-10 w-10" />}
        title={t("noPhotosAvailableTitle")}
        message={t("noPhotosAvailableMessage")}
        action={{
          label: t("viewAllEvents"),
          onClick: onViewAllPhotos,
        }}
      />
    );
  }

  const message = bibNumber
    ? t("noPhotosForBib", { bibNumber })
    : t("noPhotosFound");

  return (
    <EmptyState
      icon={<User className="text-muted-foreground h-10 w-10" />}
      title={t("noPhotosTitle")}
      message={message}
      action={
        onViewAllPhotos
          ? {
              label: actionLabel || t("viewAllEventPhotos"),
              onClick: onViewAllPhotos,
            }
          : undefined
      }
    />
  );
}
