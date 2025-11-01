/**
 * Types for consent management system
 */

export interface ConsentRecord {
  /** Timestamp when consent was given */
  consentDate: string;
  /** Version of the policy that was consented to */
  policyVersion: string;
  /** Type of consent */
  consentType: 'facial_recognition';
  /** IP address of the user when consent was given */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
}

export interface FacialRecognitionConsent {
  /** Whether user has given consent */
  hasConsented: boolean;
  /** When consent was given or revoked */
  timestamp: string;
  /** Session ID for tracking */
  sessionId: string;
  /** Event ID if consent is event-specific */
  eventId?: string;
}

export interface ConsentModalState {
  /** Whether modal is open */
  isOpen: boolean;
  /** Type of consent being requested */
  type: 'facial_recognition';
  /** Callback when consent is given */
  onConsent?: () => void;
  /** Callback when consent is denied */
  onDeny?: () => void;
}