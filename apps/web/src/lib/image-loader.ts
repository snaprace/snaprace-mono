"use client";

interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps) {
  // If src is already a full URL (e.g. external), return it as is
  if (src.startsWith("http")) return src;

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
        fit: "cover",
      },
      toFormat: "webp",
    },
  };

  const json = JSON.stringify(imageRequest);
  // Safe base64 encoding for Unicode characters
  const encoded = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  );
  return `${IMAGE_HANDLER_URL}/${encoded}`;
}
