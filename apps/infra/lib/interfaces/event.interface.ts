export interface EventItem {
  PK: string;                    // "ORG#organizer123"
  SK: string;                    // "EVT#event456"

  organizer_id: string;
  event_id: string;
  event_name: string;
  event_date: string;
  event_location?: string;
  rekognition_collection_id: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

