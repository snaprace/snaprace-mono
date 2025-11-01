/**
 * Animation utilities for photo viewer
 */

import type { Variants } from "framer-motion";

export interface PhotoPosition {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AnimationConfig {
  duration: number;
  easing: string;
  maxScale: number;
}

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  duration: 0.4,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  maxScale: 3,
};

/**
 * Calculate transform values for photo animation
 */
export function calculatePhotoTransform(
  originRect: DOMRect,
  config: AnimationConfig = DEFAULT_ANIMATION_CONFIG
) {
  const startX = originRect.left + originRect.width / 2;
  const startY = originRect.top + originRect.height / 2;
  const endX = window.innerWidth / 2;
  const endY = window.innerHeight / 2;

  const maxWidth = window.innerWidth * 0.9;
  const maxHeight = window.innerHeight * 0.9;
  const scale = Math.min(
    maxWidth / originRect.width,
    maxHeight / originRect.height,
    config.maxScale
  );

  return {
    startX,
    startY,
    endX,
    endY,
    scale,
    translateX: startX - endX,
    translateY: startY - endY,
  };
}

/**
 * Animation timing configuration
 */
export const ANIMATION_TIMINGS = {
  PHOTO_MOVEMENT: 400,
  OVERLAY_DELAY: 250,
  OVERLAY_FADE: 300,
  CLOSING_DELAY: 100,
  TOTAL_CLOSE_TIME: 550,
} as const;

/**
 * Framer Motion animation variants for photo modal
 */
export const photoModalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

/**
 * Framer Motion animation variants for overlay elements
 */
export const overlayVariants: Record<string, Variants> = {
  header: {
    hidden: {
      opacity: 0,
      y: -8,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        delay: 0.1,
      },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    },
  },
  leftArrow: {
    hidden: {
      opacity: 0,
      x: -16,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        delay: 0.15,
      },
    },
    exit: {
      opacity: 0,
      x: -16,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    },
  },
  rightArrow: {
    hidden: {
      opacity: 0,
      x: 16,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        delay: 0.15,
      },
    },
    exit: {
      opacity: 0,
      x: 16,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    },
  },
  bottomInfo: {
    hidden: {
      opacity: 0,
      y: 16,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        delay: 0.2,
      },
    },
    exit: {
      opacity: 0,
      y: 16,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    },
  },
};