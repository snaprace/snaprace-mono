export interface PhotoMessage {
  organizer_id: string;
  event_id: string;
  image_key: string;
  raw_s3_key: string;
  bucket_name: string;
  detected_bibs?: string[];
  hasConfirmedBib: boolean;
  bib_number?: string;
}

export interface ProcessingResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

