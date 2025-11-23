import { thumbHashToDataURL } from "thumbhash";

/**
 * Converts a base64-encoded ThumbHash string to a Data URL.
 * useful for next/image placeholder="blur" and blurDataURL.
 */
export function getBlurDataURL(hashBase64?: string) {
  if (!hashBase64) return undefined;

  try {
    // Convert Base64 string to Uint8Array
    const binaryString = atob(hashBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate Data URL
    return thumbHashToDataURL(bytes);
  } catch (error) {
    console.error("Failed to decode ThumbHash:", error);
    return undefined;
  }
}

