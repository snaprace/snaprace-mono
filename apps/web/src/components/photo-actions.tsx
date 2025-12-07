"use client";

import { useState } from "react";
import {
  Download,
  Share2,
  Facebook,
  Twitter,
  Instagram,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface PhotoActionsProps {
  photo: {
    id: string;
    url: string;
    location?: string;
    photographer?: string;
  };
  bibNumber?: string;
  compact?: boolean;
  className?: string;
}

export function PhotoActions({
  photo,
  bibNumber,
  compact = false,
  className = "",
}: PhotoActionsProps) {
  const t = useTranslations("toast");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}${bibNumber ? `/bib/${bibNumber}` : ""}#photo-${photo.id}`;
  const shareText = bibNumber
    ? `Check out my race photo from bib #${bibNumber}! 📸🏃‍♂️ #RacePhotos #SnapRace`
    : `Check out this amazing race photo! 📸🏃‍♂️ #RacePhotos #SnapRace`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Create a download link
      const link = document.createElement("a");
      link.href = photo.url;
      link.download = `race-photo-${photo.id}${bibNumber ? `-bib-${bibNumber}` : ""}.jpg`;

      // For external URLs, we might need to fetch and create blob
      if (photo.url.startsWith("http")) {
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          link.href = blobUrl;
        } catch {
          // Fallback to opening in new tab if CORS issues
          window.open(photo.url, "_blank");
          toast.success(t("openedInNewTabDownload"));
          return;
        }
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup blob URL if created
      if (link.href.startsWith("blob:")) {
        URL.revokeObjectURL(link.href);
      }

      toast.success(t("downloadStarted"));
    } catch (error) {
      console.error("Download failed:", error);
      toast.error(t("downloadFailedRetry"));
    } finally {
      setDownloading(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Race Photo - SnapRace",
          text: shareText,
          url: shareUrl,
        });
        toast.success(t("photoSharedSuccess"));
      } catch {
        toast.error(t("nativeShareFailed"));
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t("linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("linkCopyFailed"));
    }
  };

  const handleSocialShare = async (platform: {
    action?: () => Promise<void>;
    url: string;
  }) => {
    if (platform.action) {
      await platform.action();
    } else {
      window.open(platform.url, "_blank", "width=600,height=400");
    }
  };

  const socialShares = [
    {
      name: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
      color: "hover:text-blue-600",
    },
    {
      name: "Twitter",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      color: "hover:text-sky-500",
    },
    {
      name: "Instagram",
      icon: Instagram,
      url: shareUrl, // Instagram doesn't support direct URL sharing, so we'll copy link
      color: "hover:text-pink-600",
      action: () => handleCopyLink(),
    },
  ];

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {/* Download Button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
          onClick={handleDownload}
          disabled={downloading}
        >
          <Download className="h-4 w-4" />
        </Button>

        {/* Share Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Share Photo</h4>

              {/* Native Share (mobile) */}
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  onClick={handleNativeShare}
                  className="w-full justify-start"
                  variant="outline"
                  size="sm"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              )}

              {/* Social Media Links */}
              <div className="grid grid-cols-3 gap-2">
                {socialShares.map((platform) => (
                  <Button
                    key={platform.name}
                    variant="outline"
                    size="sm"
                    className={`flex h-auto flex-col items-center gap-1 py-2 ${platform.color}`}
                    onClick={() => handleSocialShare(platform)}
                  >
                    <platform.icon className="h-4 w-4" />
                    <span className="text-xs">{platform.name}</span>
                  </Button>
                ))}
              </div>

              {/* Copy Link */}
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Download Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        {downloading ? "Downloading..." : "Download"}
      </Button>

      {/* Share Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Your Race Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo Preview */}
            <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Race photo ${photo.location ? `from ${photo.location}` : ""}`}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Photo Info */}
            <div className="text-muted-foreground text-sm">
              {photo.location && <p>📍 {photo.location}</p>}
              {photo.photographer && <p>📷 {photo.photographer}</p>}
              {bibNumber && <p>🏃‍♂️ Bib #{bibNumber}</p>}
            </div>

            {/* Native Share (mobile) */}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button onClick={handleNativeShare} className="w-full">
                <Share2 className="mr-2 h-4 w-4" />
                Share Photo
              </Button>
            )}

            {/* Social Media Grid */}
            <div className="grid grid-cols-3 gap-3">
              {socialShares.map((platform) => (
                <Button
                  key={platform.name}
                  variant="outline"
                  className={`flex h-16 flex-col items-center gap-2 ${platform.color}`}
                  onClick={() => handleSocialShare(platform)}
                >
                  <platform.icon className="h-5 w-5" />
                  <span className="text-xs">{platform.name}</span>
                </Button>
              ))}
            </div>

            {/* Copy Link */}
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="w-full justify-start"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Photo Link
                </>
              )}
            </Button>

            {/* Direct Link */}
            <div className="text-muted-foreground text-xs">
              Direct link:{" "}
              <code className="bg-muted rounded px-1 text-xs">{shareUrl}</code>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
