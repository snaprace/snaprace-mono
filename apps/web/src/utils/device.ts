/**
 * Device detection utilities
 */

/**
 * Detect if device is mobile based on screen size and touch capability
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || "ontouchstart" in window;
}

/**
 * Calculate responsive column count based on screen width
 * 1550px+ = 5 columns, 1050px+ = 4 columns, 850px+ = 3 columns, below 850px = 2 columns
 */
export function calculateColumnCount(width: number): number {
  if (width >= 1550) return 5;
  if (width >= 1050) return 4;
  if (width >= 850) return 3;
  return 2;
}

/**
 * Debounce function for resize events
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Hook-like function to get window dimensions
 */
export function getWindowDimensions() {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
