/**
 * 환경 변수 검증 유틸리티
 * 타입 안전성을 보장하기 위한 환경 변수 검증 함수
 */

export interface ValidateEnvResult<T> {
  success: boolean;
  env?: T;
  error?: string;
}

/**
 * 환경 변수 검증 함수
 * 필수 필드가 누락되었는지 확인하고 타입을 검증합니다.
 */
export function validateEnv<T>(
  env: Record<string, string | undefined>,
  requiredFields: (keyof T)[]
): ValidateEnvResult<T> {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = env[field as string];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      missingFields.push(String(field));
    }
  }

  if (missingFields.length > 0) {
    return {
      success: false,
      error: `Missing required environment variables: ${missingFields.join(", ")}`,
    };
  }

  // 검증 성공 시 모든 필수 필드가 존재하므로 타입 단언 안전
  return {
    success: true,
    env: env as T,
  };
}

/**
 * 숫자 환경 변수 파싱 헬퍼
 */
export function parseFloatEnv(
  value: string | undefined,
  defaultValue: number
): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 정수 환경 변수 파싱 헬퍼
 */
export function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 불리언 환경 변수 파싱 헬퍼
 */
export function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.toLowerCase().trim();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
}

/**
 * Photo Processing Lambda 환경 변수 인터페이스
 */
export interface PhotoProcessEnv {
  // 공통
  AWS_REGION: string;
  STAGE: "dev" | "staging" | "prod";
  LOG_LEVEL?: "DEBUG" | "INFO" | "WARN" | "ERROR";

  // S3
  PHOTOS_BUCKET: string;

  // DynamoDB
  EVENT_PHOTOS_TABLE: string;
  PHOTO_BIB_INDEX_TABLE: string;
  RUNNERS_TABLE?: string; // 선택적

  // Rekognition
  REKOGNITION_COLLECTION_PREFIX: string;

  // Step Functions (Starter Lambda만)
  STATE_MACHINE_ARN?: string;

  // 설정
  BIB_NUMBER_MIN?: string; // default: "1"
  BIB_NUMBER_MAX?: string; // default: "99999"
  BIB_NUMBER_PATTERN?: string; // 정규식 패턴 (확장용)

  // 필터링 설정
  WATERMARK_FILTER_ENABLED?: string; // default: "true"
  WATERMARK_AREA_THRESHOLD?: string; // default: "0.35" (하단 35%)
  MIN_TEXT_HEIGHT_PX?: string; // default: "50"
  MIN_TEXT_CONFIDENCE?: string; // default: "90"

  // Rekognition 설정
  MIN_FACE_CONFIDENCE?: string; // default: "90"
  MAX_FACES_PER_PHOTO?: string; // default: "10"
}

/**
 * Photo Processing Lambda 환경 변수 설정 객체
 */
export interface PhotoProcessConfig {
  // 공통
  region: string;
  stage: "dev" | "staging" | "prod";
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";

  // S3
  photosBucket: string;

  // DynamoDB
  eventPhotosTable: string;
  photoBibIndexTable: string;
  runnersTable?: string;

  // Rekognition
  rekognitionCollectionPrefix: string;

  // Step Functions
  stateMachineArn?: string;

  // Bib Number 설정
  bibNumberMin: number;
  bibNumberMax: number;
  bibNumberPattern?: RegExp;

  // 필터링 설정
  watermarkFilterEnabled: boolean;
  watermarkAreaThreshold: number;
  minTextHeightPx: number;
  minTextConfidence: number;

  // Rekognition 설정
  minFaceConfidence: number;
  maxFacesPerPhoto: number;
}

/**
 * Photo Processing Lambda 환경 변수 파싱 및 설정 객체 반환
 */
export function getPhotoProcessConfig(env: Record<string, string | undefined>): PhotoProcessConfig {
  return {
    // 공통
    region: env.AWS_REGION || "us-east-1",
    stage: (env.STAGE as "dev" | "staging" | "prod") || "dev",
    logLevel: (env.LOG_LEVEL as "DEBUG" | "INFO" | "WARN" | "ERROR") || "INFO",

    // S3
    photosBucket: env.PHOTOS_BUCKET || "",

    // DynamoDB
    eventPhotosTable: env.EVENT_PHOTOS_TABLE || "",
    photoBibIndexTable: env.PHOTO_BIB_INDEX_TABLE || "",
    runnersTable: env.RUNNERS_TABLE,

    // Rekognition
    rekognitionCollectionPrefix: env.REKOGNITION_COLLECTION_PREFIX || "snaprace",

    // Step Functions
    stateMachineArn: env.STATE_MACHINE_ARN,

    // Bib Number 설정
    bibNumberMin: parseIntEnv(env.BIB_NUMBER_MIN, 1),
    bibNumberMax: parseIntEnv(env.BIB_NUMBER_MAX, 99999),
    bibNumberPattern: env.BIB_NUMBER_PATTERN ? new RegExp(env.BIB_NUMBER_PATTERN) : undefined,

    // 필터링 설정
    watermarkFilterEnabled: parseBooleanEnv(env.WATERMARK_FILTER_ENABLED, true),
    watermarkAreaThreshold: parseFloatEnv(env.WATERMARK_AREA_THRESHOLD, 0.35),
    minTextHeightPx: parseIntEnv(env.MIN_TEXT_HEIGHT_PX, 50),
    minTextConfidence: parseFloatEnv(env.MIN_TEXT_CONFIDENCE, 90),

    // Rekognition 설정
    minFaceConfidence: parseFloatEnv(env.MIN_FACE_CONFIDENCE, 90),
    maxFacesPerPhoto: parseIntEnv(env.MAX_FACES_PER_PHOTO, 10),
  };
}

/**
 * 필수 환경 변수 검증 (Photo Processing Lambda용)
 */
export function validatePhotoProcessEnv(
  env: Record<string, string | undefined>,
  requiredFields: (keyof PhotoProcessEnv)[]
): ValidateEnvResult<PhotoProcessEnv> {
  return validateEnv<PhotoProcessEnv>(env, requiredFields);
}
