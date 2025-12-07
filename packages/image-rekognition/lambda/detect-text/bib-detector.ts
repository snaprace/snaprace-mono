/**
 * Bib Detection 공통 로직
 * - Lambda와 테스트에서 동일하게 사용
 */

// ============================================
// 🎯 배번 패턴 설정 (대회에 따라 주석 처리로 전환)
// ============================================
export const BIB_PATTERNS = [
  /^[0-9]{3,6}$/, // 순수 숫자: 123, 1234
  /^[A-Z][0-9]{3,6}$/, // 접두사+숫자: A123, B1234, C12345 (필요시 활성화)
];

// 제외할 패턴 (연도, 0000 등)
export const EXCLUDED_PATTERNS = new Set([
  // "2024",
  // "2025",
  "0000",
  "00000",
  "000000",
]);

export const MIN_CONFIDENCE = 90;

export interface TextDetection {
  DetectedText?: string;
  Type?: string;
  Confidence?: number;
}

export interface BibExtractionResult {
  bibs: string[];
  bibCandidates: string[];
}

/**
 * 접두사 제거: A2539 → 2539
 */
function stripPrefix(bib: string): string {
  return bib.replace(/^[A-Z]+/i, "");
}

/**
 * TextDetection 배열에서 배번 추출
 */
export function extractBibsFromDetections(
  detections: TextDetection[]
): BibExtractionResult {
  const bibCandidates: string[] = [];

  for (const t of detections) {
    if (!t.DetectedText) continue;

    if (t.Type === "WORD" && (t.Confidence ?? 0) >= MIN_CONFIDENCE) {
      const text = t.DetectedText.toUpperCase();
      const isMatch = BIB_PATTERNS.some((pattern) => pattern.test(text));

      if (isMatch && !EXCLUDED_PATTERNS.has(text)) {
        const bib = stripPrefix(t.DetectedText);
        bibCandidates.push(bib);
      }
    }
  }

  const uniqueBibs = Array.from(new Set(bibCandidates));

  return {
    bibs: uniqueBibs,
    bibCandidates,
  };
}
