/**
 * Storage 관련 인터페이스 정의
 */

export interface PhotoBucketConfig {
  bucketName?: string;
  versioned?: boolean;
  encryption?: 'S3_MANAGED' | 'KMS';
}

