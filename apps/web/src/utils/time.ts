export function formatDuration(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0",
    )}`;
  }

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatPace(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

