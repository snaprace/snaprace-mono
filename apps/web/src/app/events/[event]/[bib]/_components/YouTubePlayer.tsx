"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";

import { getYouTubeId } from "@/utils/video";

interface YouTubePlayerProps {
  url: string;
  startTime: number;
  thumbnail: string;
  onReady: () => void;
  onError: () => void;
}

export function YouTubePlayer({
  url,
  startTime,
  thumbnail,
  onReady,
  onError,
}: YouTubePlayerProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const videoId = getYouTubeId(url);
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startTime)}&rel=0&modestbranding=1`;

  const handleLoad = () => {
    setIframeLoaded(true);
    onReady();
  };

  return (
    <div className="relative h-full w-full">
      {/* Thumbnail placeholder */}
      {!iframeLoaded && (
        <div
          className="absolute inset-0 rounded-lg bg-cover bg-center"
          style={{ backgroundImage: `url(${thumbnail})` }}
        >
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <PlayCircle className="h-16 w-16 text-white/80" />
          </div>
        </div>
      )}

      {/* YouTube iframe */}
      <iframe
        src={embedUrl}
        className="h-full w-full rounded-lg"
        onLoad={handleLoad}
        onError={onError}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ display: iframeLoaded ? "block" : "none" }}
      />
    </div>
  );
}

