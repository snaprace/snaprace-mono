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
export function parseIntEnv(
  value: string | undefined,
  defaultValue: number
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

