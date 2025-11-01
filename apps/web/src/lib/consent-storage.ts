/**
 * Utility functions for managing consent storage
 */

import type { FacialRecognitionConsent } from '@/types/consent';

const STORAGE_KEYS = {
  FACIAL_RECOGNITION_CONSENT: 'snaprace_facial_recognition_consent',
} as const;


/**
 * Stores facial recognition consent in localStorage
 */
export function storeFacialRecognitionConsent(
  hasConsented: boolean,
  eventId?: string
): void {
  if (typeof window === 'undefined') return;

  const consent: FacialRecognitionConsent = {
    hasConsented,
    timestamp: new Date().toISOString(),
    sessionId: generateSessionId(),
    eventId,
  };

  try {
    localStorage.setItem(
      STORAGE_KEYS.FACIAL_RECOGNITION_CONSENT,
      JSON.stringify(consent)
    );
  } catch (error) {
    console.error('Failed to store facial recognition consent:', error);
  }
}

/**
 * Retrieves facial recognition consent from localStorage
 */
export function getFacialRecognitionConsent(
  eventId?: string
): FacialRecognitionConsent | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FACIAL_RECOGNITION_CONSENT);
    if (!stored) return null;

    const consent = JSON.parse(stored) as FacialRecognitionConsent;

    // Check if consent is event-specific and matches
    if (eventId && consent.eventId && consent.eventId !== eventId) {
      return null;
    }

    // Check if consent is still valid (not older than 1 year)
    const consentDate = new Date(consent.timestamp);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (consentDate < oneYearAgo) {
      clearFacialRecognitionConsent();
      return null;
    }

    return consent;
  } catch (error) {
    console.error('Failed to retrieve facial recognition consent:', error);
    return null;
  }
}

/**
 * Clears facial recognition consent from localStorage
 */
export function clearFacialRecognitionConsent(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEYS.FACIAL_RECOGNITION_CONSENT);
  } catch (error) {
    console.error('Failed to clear facial recognition consent:', error);
  }
}

/**
 * Clears all consent data from localStorage
 */
export function clearAllConsent(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEYS.FACIAL_RECOGNITION_CONSENT);
  } catch (error) {
    console.error('Failed to clear consent data:', error);
  }
}

/**
 * Generates a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Checks if user has given facial recognition consent
 */
export function hasFacialRecognitionConsent(eventId?: string): boolean {
  const consent = getFacialRecognitionConsent(eventId);
  return consent?.hasConsented ?? false;
}

