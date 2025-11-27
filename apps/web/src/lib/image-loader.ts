"use client";

interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps) {
  // If src is already a full URL (e.g. external), return it as is
  if (src.startsWith("http") || src.startsWith("https")) return src;

  // Local static images (starting with /) should return as is
  if (src.startsWith("/")) return src;

  const IMAGE_HANDLER_URL = process.env.NEXT_PUBLIC_IMAGE_HANDLER_URL;
  const BUCKET_NAME = process.env.NEXT_PUBLIC_IMAGE_BUCKET;

  if (!IMAGE_HANDLER_URL || !BUCKET_NAME) {
    console.warn("Missing env vars for image loader");
    return src;
  }

  const imageRequest = {
    bucket: BUCKET_NAME,
    key: src,
    edits: {
      resize: {
        width: width,
        fit: "inside",
      },
      toFormat: "webp",
      webp: {
        quality: quality || 75,
      },
    },
  };

  const json = JSON.stringify(imageRequest);
  // Safe base64 encoding for Unicode characters
  const encoded = btoa(
    encodeURIComponent(json).replace(
      /%([0-9A-F]{2})/g,
      (_match: string, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
    ),
  );
  return `${IMAGE_HANDLER_URL}/${encoded}`;
}
