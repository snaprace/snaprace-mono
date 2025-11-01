import type { BibDetailResponse } from "@/server/services/timing-service";

/**
 * 시간 문자열을 초로 변환
 * @param timeStr "MM:SS.ms" 또는 "HH:MM:SS.ms" 형식
 * @returns 초 단위 시간
 * @example
 * mmssToSeconds("2:13:52.0") // 8032
 * mmssToSeconds("13:52.0") // 832
 */
export function mmssToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");

  if (parts.length < 2) return 0;

  // HH:MM:SS.ms 형식
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if (!hours || !minutes || !seconds) return 0;
    return Number(hours) * 3600 + Number(minutes) * 60 + parseFloat(seconds);
  }

  // MM:SS.ms 형식
  const [minutes, seconds] = parts;
  if (!minutes || !seconds) return 0;
  return Number(minutes) * 60 + parseFloat(seconds);
}

/**
 * 타이밍 데이터에서 숫자 값 추출
 * @param row 타이밍 데이터 행
 * @param key 추출할 필드 키
 * @returns 초 단위 숫자 값 또는 undefined
 */
export function getRowNumber(
  row: BibDetailResponse["row"] | undefined,
  key: string,
): number | undefined {
  if (!row) return undefined;
  const value = row[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return mmssToSeconds(value);
  }
  return undefined;
}

/**
 * YouTube URL에서 비디오 ID 추출
 * @param url YouTube URL
 * @returns 비디오 ID 또는 빈 문자열
 * @example
 * getYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ") // "dQw4w9WgXcQ"
 * getYouTubeId("https://youtu.be/dQw4w9WgXcQ") // "dQw4w9WgXcQ"
 */
export function getYouTubeId(url: string): string {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = regex.exec(url);
  return match ? (match[1] ?? "") : "";
}
