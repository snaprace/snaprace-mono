/**
 * Database (DynamoDB) 관련 인터페이스 정의
 */

export interface DynamoDBTableConfig {
  tableName: string;
  partitionKey: string;
  sortKey?: string;
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';
  pointInTimeRecovery?: boolean;
}

export interface PhotoItem {
  PK: string; // "EVT#organizer123#event456"
  SK: string; // "IMG#IMG_001.jpg"
  GSI1PK: string; // "EVT_BIB#organizer123#event456#bib789" or "EVT_BIB#organizer123#event456#NONE"
  GSI1SK: string; // "2024-01-15T10:30:00Z"
  organizer_id: string;
  event_id: string;
  image_key: string;
  raw_s3_key: string;
  cloudfront_url: string;
  bib_number?: string; // 확정된 bib 또는 "NONE"
  detected_bibs: string[]; // OCR에서 감지된 bib 후보들
  face_ids: string[]; // 감지된 얼굴 ID들 (참조용)
  processing_status: ProcessingStatus;
  created_at: string;
}

export enum ProcessingStatus {
  UPLOADED = 'UPLOADED',
  TEXT_DETECTED = 'TEXT_DETECTED',
  FACES_INDEXED = 'FACES_INDEXED',
  BIB_CONFIRMED = 'BIB_CONFIRMED',
  NO_FACES = 'NO_FACES',
}

export interface PhotoFaceItem {
  PK: string; // "FACE#face-abc123"
  SK: string; // "IMG#IMG_001.jpg"
  organizer_id: string;
  event_id: string;
  image_key: string;
  bib_number?: string; // 확정된 bib
  created_at: string;
}

