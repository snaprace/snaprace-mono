/**
 * 공통 타입 정의
 */

import { FaceMatch } from "@aws-sdk/client-rekognition";

/**
 * Rekognition FaceMatch 타입 재export
 */
export type { FaceMatch };

/**
 * 환경 변수 기본 인터페이스
 */
export interface BaseEnvironment {
  [key: string]: string | undefined;
}
