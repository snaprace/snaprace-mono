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

export type { BaseEnvironment, RunnerItem, FaceMatch };


