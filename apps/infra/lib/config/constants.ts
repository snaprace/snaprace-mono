export const Constants = {
  PROJECT_NAME: 'snaprace',
  
  // DynamoDB 테이블 이름
  TABLES: {
    PHOTOS: 'photos',
    PHOTO_FACES: 'photo-faces',
    RUNNERS: 'runners',
    EVENTS: 'events'
  },

  // Lambda 함수 이름
  FUNCTIONS: {
    DETECT_TEXT: 'detect-text',
    INDEX_FACES: 'index-faces',
    FIND_BY_SELFIE: 'find-by-selfie'
  },

  // S3 경로 패턴
  S3_PATHS: {
    RAW_PHOTOS: '*/photos/raw/*',
    DERIVED_PHOTOS: '*/photos/derived/*'
  },

  // SQS 큐 이름
  QUEUES: {
    PHOTO_PROCESSING: 'photo-queue',
    PHOTO_DLQ: 'photo-dlq'
  },

  // API 이름
  API: {
    NAME: 'api',
    STAGE: 'v1'
  }
} as const;

