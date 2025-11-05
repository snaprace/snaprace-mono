/**
 * 공통 타입 정의
 */

import { FaceMatch } from "@aws-sdk/client-rekognition";

/**
 * 환경 변수 기본 인터페이스
 */
interface BaseEnvironment {
  [key: string]: string | undefined;
}

/**
 * Step Functions 입력 인터페이스
 */
export interface StepFunctionInput {
  bucket: string;
  objectKey: string;
  organizer: string;
  eventId: string;
  uploadTimestamp: number;
  imageWidth?: number;
  imageHeight?: number;
  detectedBibs?: string[];
  faceIds?: string[];
}

/**
 * 처리 상태 Enum
 */
export enum ProcessingStatus {
  PENDING = "PENDING",
  TEXT_DETECTED = "TEXT_DETECTED",
  FACES_INDEXED = "FACES_INDEXED",
  COMPLETED = "COMPLETED",
}

/**
 * EventPhotos 테이블 아이템 인터페이스
 */
export interface EventPhoto {
  // Primary Keys
  EventKey: string; // PK: "ORG#{organizer}#EVT#{eventId}"
  S3ObjectKey: string; // SK: S3 객체 경로

  // 메타데이터
  UploadTimestamp: number; // Unix timestamp
  ImageWidth?: number;
  ImageHeight?: number;
  RekognitionImageId?: string;

  // 처리 상태
  ProcessingStatus: ProcessingStatus;

  // 감지된 데이터
  DetectedBibs?: string[]; // 감지된 Bib Number 목록
  FaceIds?: string[]; // 감지된 얼굴 ID 목록
  isGroupPhoto?: boolean; // 그룹 사진 여부

  // 타임스탬프
  createdAt?: number;
  updatedAt?: number;
}

/**
 * PhotoBibIndex 테이블 아이템 인터페이스
 */
export interface PhotoBibIndex {
  // Primary Keys
  EventBibKey: string; // PK: "ORG#{organizer}#EVT#{eventId}#BIB#{bibNumber}"
  S3ObjectKey: string; // SK: S3 객체 경로

  // 메타데이터
  IndexedAt: number; // Unix timestamp
}

/**
 * RunnersV2 테이블 아이템 인터페이스 (기존)
 */

// 기존 RunnersV2 테이블 아이템 인터페이스
interface RunnerItem {
  // === 기본 키 (필수) ===
  pk: string; // "ORG#org123#EVT#event456"
  sk: string; // "BIB#0001" (제로 패딩)

  // === GSI 키 (GSI 사용 시 필수) ===
  gsi1pk?: string; // "RUNNER#runner789"
  gsi1sk?: string; // "EVT#org123#event456"

  // === 프로젝션된 속성 (GSI에서 사용) ===
  bib_number: string; // "1" (제로 패딩 제거된 실제 번호)
  name: string; // "John Doe"
  finish_time_sec?: number; // 3600 (1시간 = 3600초)
  event_id: string; // "event456"
  event_date: string; // "8/28/25"
  event_name: string; // "Happy Hour Hustle Week4 2025"

  // === 선택적 편의 필드 ===
  organizer_id?: string; // "org123" (pk에서 파싱 가능하지만 편의를 위해)
  runner_id?: string; // "runner789" (gsi1pk에서 파싱 가능하지만 편의를 위해)
}

/**
 * Runner 인터페이스 (간소화 버전)
 */
export interface Runner {
  pk: string; // "ORG#{organizer}#EVT#{eventId}"
  sk: string; // "BIB#{bibNumber}"
  name?: string;
  finish_time_sec?: number;
  PhotoKeys?: string[]; // StringSet
}

/**
 * DynamoDB 응답 타입
 */
export interface DynamoDBGetItemResponse<T> {
  Item?: T;
}

export interface DynamoDBQueryResponse<T> {
  Items: T[];
  Count: number;
  ScannedCount: number;
  LastEvaluatedKey?: Record<string, any>;
}

/**
 * Lambda 응답 타입
 */
export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

/**
 * 에러 타입
 */
export interface PhotoProcessingError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

export type { BaseEnvironment, RunnerItem, FaceMatch };
