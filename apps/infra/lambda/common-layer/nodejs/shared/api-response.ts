/**
 * API Gateway 응답 헬퍼
 * CORS 헤더 및 일관된 응답 형식을 제공합니다.
 */

import { APIGatewayProxyResult } from "aws-lambda";

/**
 * 기본 CORS 헤더
 */
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/**
 * 성공 응답 생성
 */
export function successResponse(
  data: any,
  statusCode: number = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
  };
}

/**
 * 에러 응답 생성
 */
export function errorResponse(
  error: string | Error,
  statusCode: number = 500,
  additionalData?: Record<string, any>
): APIGatewayProxyResult {
  const errorMessage = error instanceof Error ? error.message : error;

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      error: errorMessage,
      ...additionalData,
    }),
  };
}

/**
 * 400 Bad Request 응답
 */
export function badRequestResponse(
  error: string,
  additionalData?: Record<string, any>
): APIGatewayProxyResult {
  return errorResponse(error, 400, additionalData);
}

/**
 * 500 Internal Server Error 응답
 */
export function internalServerErrorResponse(
  error: string | Error,
  additionalData?: Record<string, any>
): APIGatewayProxyResult {
  return errorResponse(error, 500, additionalData);
}


